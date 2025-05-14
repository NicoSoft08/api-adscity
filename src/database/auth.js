const db = require('../config/database');
const { auth, firestore, admin } = require('../config/firebase-admin');
const { formatDate } = require('../cron');
const { sendCode, sendAdminEmail } = require('../controllers/emailController');
const { monthNames, generateVerificationCode, getUserProfileNumber, logAdminAction } = require('../func');

const createUser = async (address, city, country, email, password, firstName, lastName, phoneNumber, displayName) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const userRecord = await auth.createUser({
            email: email,
            password: password,
            disabled: false,
            emailVerified: false,
            phoneNumber: phoneNumber,
            displayName: `${firstName} ${lastName}`
        });

        const code = generateVerificationCode();
        const profileNumber = getUserProfileNumber();

        // Récupération de la promotion active
        const promotionsRef = firestore.collection('PROMOTIONS').doc('launchOffer');
        const promotionDoc = await promotionsRef.get();

        let maxAds = 3;
        let maxPhotos = 3;
        let expiryDate = null;

        if (promotionDoc.exists) {
            const promotion = promotionDoc.data();
            const now = new Date();

            if (promotion.enabled && promotion.startDate.toDate() <= now && now <= promotion.endDate.toDate()) {
                console.log("Promotion active, application des limites promotionnelles.");
                maxAds = promotion.features.maxAdsPerMonth;
                maxPhotos = promotion.features.maxPhotosPerAd;
                expiryDate = promotion.endDate;
            }
        }

        // Insert new user
        await client.query(
            `INSERT INTO users (
            id, email, first_name, last_name, display_name, phone_number,
            address, city, country, location, profile_type, verification_code,
            expiration_time, registration_date, registration_date_iso,
            current_month, current_year, is_active, is_online, email_verified,
            role, status, subscription
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
            [
                id,
                email,
                firstName,
                lastName,
                `${firstName} ${lastName}`,
                phoneNumber,
                address,
                city,
                country,
                `${country}, ${city}, ${address}`,
                profileType || 'Particulier',
                verificationCode,
                expirationTime,
                formatDate(currentDate),
                currentDate.toISOString(),
                monthNames[currentDate.getMonth()],
                currentDate.getFullYear(),
                true,
                false,
                false,
                'user',
                'active',
                'free'
            ]
        );

        // Insert user plan
        await client.query(
            `INSERT INTO user_plans (
            user_id, plan_type, is_active, max_ads, max_photos,
            subscription_date, expiry_date
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [
                id,
                'individual',
                true,
                maxAds,
                maxPhotos,
                expiryDate
            ]
        );

        // Initialize user ratings
        await client.query(
            `INSERT INTO user_ratings (user_id, average_rating, total_rating, rating_count)
         VALUES ($1, 0, 0, 0)`,
            [id]
        );

        // Initialize rating distribution
        for (let i = 1; i <= 5; i++) {
            await client.query(
                `INSERT INTO rating_distribution (user_id, rating_value, count)
             VALUES ($1, $2, 0)`,
                [id, i]
            );
        }

        await client.query('COMMIT');

        // Envoi du code de vérification par email
        sendCode(displayName, email, code)
            .then(() => console.log('Code de vérification envoyé avec succès:', code))
            .catch(error => console.error('Erreur:', error.message));

        console.log('Utilisateur enregistré avec succès', userRecord.uid);

        return { userRecord, code };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);

        if (error.code === '23505') { // Unique violation in PostgreSQL
            return false;
        }

        return false;
    } finally {
        client.release();
    }
}

const signinUser = async (userID, deviceInfo) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Check if user exists
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: false, message: "Utilisateur introuvable." };
        }

        const userData = userResult.rows[0];
        const { role, login_count = 0 } = userData;

        // Check if device is already registered
        const existingDeviceResult = await client.query(
            `SELECT * FROM user_login_activity 
             WHERE user_id = $1 
             AND device_info->>'browser' = $2 
             AND device_info->>'os' = $3 
             AND device_info->>'device' = $4 
             AND device_info->>'ip' = $5`,
            [userID, deviceInfo.browser, deviceInfo.os, deviceInfo.device, deviceInfo.ip]
        );

        const isDeviceRegistered = existingDeviceResult.rows.length > 0;

        if (!isDeviceRegistered) {
            // Register new device
            await client.query(
                `INSERT INTO user_login_activity 
                 (user_id, ip_address, user_agent, device_info, login_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                    userID,
                    deviceInfo.ip,
                    deviceInfo.userAgent,
                    JSON.stringify(deviceInfo)
                ]
            );
            console.log("✅ Nouvel appareil enregistré :", deviceInfo);
        } else {
            console.log("🔹 Appareil déjà enregistré :", deviceInfo);
        }

        // Update user information after login
        await client.query(
            `UPDATE users 
             SET login_count = login_count + 1, 
                 is_online = true, 
                 updated_at = NOW(),
                 last_login_at = NOW()
             WHERE id = $1`,
            [userID]
        );

        await client.query('COMMIT');

        console.log("✅ Connexion réussie :", userID);
        return {
            success: true,
            message: login_count === 0 ? "Connexion réussie (première connexion)." : "Connexion réussie.",
            role,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur dans signinUser :", error.message);
        return false
    } finally {
        client.release();
    }
};

const logoutUser = async (userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        console.log(`🟢 Début de la déconnexion pour ${userID}`);

        // 🔹 Vérifie si l'utilisateur existe dans Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            console.error(`❌ Utilisateur ${userID} introuvable dans Firebase Authentication.`);
            return false;
        }

        console.log(`✅ Utilisateur trouvé : ${userRecord.email}`);

        // 🔹 Révocation des tokens
        await auth.revokeRefreshTokens(userID);
        console.log(`🔄 Tokens Firebase révoqués pour ${userID}`);

        // 🔹 Vérifie si l'utilisateur existe dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );
        if (userResult.rows.length === 0) {
            console.error(`❌ Utilisateur ${userID} introuvable dans PostgreSQL.`);
            return false;
        }
        console.log(`✅ Utilisateur ${userID} trouvé dans PostgreSQL : ${userResult.rows[0].email}`);

        // 🔹 Mise à jour de PostgreSQL
        await client.query(
            'UPDATE users SET is_online = false, last_logout_at = NOW() WHERE id = $1',
            [userID]
        );

        console.log(`🚀 Déconnexion réussie pour ${userID}`);
        await client.query('COMMIT');
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la déconnexion :", error);
        return false;
    } finally {
        client.release();
    }
};

const deletionUser = async (userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`🟢 Début de la suppression de l'utilisateur ${userID}`);

        // 🔹 Suppression de l'utilisateur dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );

        // 🔹 Vérifie si l'utilisateur existe dans PostgreSQL
        if (userResult.rows.length === 0) {
            console.error(`❌ Utilisateur ${userID} introuvable dans PostgreSQL.`);
            return false;
        }
        console.log(`✅ Utilisateur ${userID} trouvé dans PostgreSQL : ${userResult.rows[0].email}`);

        // 🔹 Suppression de l'utilisateur dans PostgreSQL
        await client.query(
            'DELETE FROM users WHERE id = $1',
            [userID]
        );
        // 🔹 Suppression de l'utilisateur dans Firebase Authentication
        await auth.deleteUser(userID);

        console.log(`🚀 Suppression réussie de l'utilisateur ${userID}`);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        return false;
    } finally {
        client.release();
    }
}

const disableUser = async (userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`🟢 Début de la désactivation de l'utilisateur ${userID}`);

        // 🔹 Vérifie si l'utilisateur existe dans Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            console.error(`❌ Utilisateur ${userID} introuvable dans Firebase Authentication.`);
            return false;
        }

        console.log(`✅ Utilisateur ${userID} trouvé dans Firebase Authentication : ${userRecord.email}`);
        // 🔹 Désactive l'utilisateur dans Firebase Authentication
        await auth.updateUser(userID, { disabled: true });

        // 🔹 Vérifie si l'utilisateur existe dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            console.error(`❌ Utilisateur ${userID} introuvable dans PostgreSQL.`);
            return false;
        }
        console.log(`✅ Utilisateur ${userID} trouvé dans PostgreSQL : ${userResult.rows[0].email}`);
        // 🔹 Désactive l'utilisateur dans PostgreSQL
        await client.query(
            'UPDATE users SET is_active = false, last_logout_at = NOW() WHERE id = $1',
            [userID]
        );

        console.log(`🚀 Désactivation réussie de l'utilisateur ${userID}`)
        await client.query('COMMIT');
        return true;
    } catch (error) {
        console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
        return false;
    } finally {
        client.release();
    }
}

const restoreUser = async (userID) => {
    const client = await db.pool.connect();

    try {
        console.log(`🟢 Début de la désactivation de l'utilisateur ${userID}`);

        // 🔹 Vérifie si l'utilisateur existe dans Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            console.error(`❌ Utilisateur ${userID} introuvable dans Firebase Authentication.`);
            return false;
        }

        console.log(`✅ Utilisateur ${userID} trouvé dans Firebase Authentication : ${userRecord.email}`);
        // 🔹 Active l'utilisateur dans Firebase Authentication
        await auth.updateUser(userID, { disabled: false });

        // 🔹 Vérifie si l'utilisateur existe dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            console.error(`❌ Utilisateur ${userID} introuvable dans PostgreSQL.`);
            return false;
        }
        console.log(`✅ Utilisateur ${userID} trouvé dans PostgreSQL : ${userResult.rows[0].email}`);
        // 🔹 Active l'utilisateur dans PostgreSQL
        await client.query(
            'UPDATE users SET is_active = true, last_logout_at = NOW() WHERE id = $1',
            [userID]
        );

        console.log(`🚀 Activation réussie de l'utilisateur ${userID}`)
        await client.query('COMMIT');
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'activation de l\'utilisateur:', error);
        return false;
    } finally {
        client.release();
    }
};

const verifyCode = async (email, code) => {
    try {
        // Verifie l'utilisateur dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            console.error(`❌ Utilisateur ${email} introuvable dans PostgreSQL.`);
            return false;
        }

        // Vérifie le code et l'expiration de code dans PostgreSQL
        const codeResult = await client.query(
            'SELECT * FROM verification_code WHERE user_id = $1 AND code = $2',
            [userResult.rows[0].id, code]
        );
    } catch (error) {

    }
};

const addNewAdmin = async (displayName, firstName, lastName, email, phoneNumber, password, permissions, address, city, country, captchaToken) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`🟢 Début de la création de l'utilisateur ${email}`);
        // 🔹 Vérifie si l'utilisateur existe déjà dans Firebase Authentication
        const userRecord = await auth.getUserByEmail(email);
        if (userRecord) {
            console.error(`❌ L'utilisateur ${email} existe déjà dans Firebase Authentication.`);
            return false;
        }

        // 🔹 Vérifie si l'utilisateur existe déjà dans PostgreSQL
        const userResult = await client.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length > 0) {
            console.error(`❌ L'utilisateur ${email} existe déjà dans PostgreSQL.`);
            return false;
        }

        const profileNumber = getUserProfileNumber();

        // 🔹 Crée l'utilisateur dans Firebase Authentication
        const user = await auth.createUser({
            displayName,
            email,
            password,
            phoneNumber,
            emailVerified: true
        });

        console.log(`✅ Utilisateur ${email} créé dans Firebase Authentication : ${user.uid}`);
        // 🔹 Crée l'utilisateur dans PostgreSQL
        const userID = user.uid;
        const createdAt = admin.firestore.FieldValue.serverTimestamp();
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),

            await client.query(
                `INSERT INTO users (
                display_name,
                first_name,
                last_name,
                email,
                phone_number,
                is_online,
                last_activity,
                permissions,
                user_id,
                city,
                country,
                address,
                email_verified,
                is_active,
                location,
                profile_url,
                role,
                profile_number,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) RETURNING id`,
                [
                    `${firstName} ${lastName}`,
                    firstName,
                    lastName,
                    email,
                    phoneNumber,
                    false,
                    lastActivity,
                    permissions,
                    userID,
                    city,
                    country,
                    address,
                    true,
                    true,
                    `${address} ${city} ${country}`,
                    null,
                    'user',
                    profileNumber,
                    createdAt,
                ]
            );

        console.log(`✅ Utilisateur ${email} créé dans PostgreSQL : ${userID}`);

        // 🔹 Envoi des identifiants par email
        await sendAdminEmail(email, password, displayName);

        return true;
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        return false;
    }
};

module.exports = {
    addNewAdmin,
    createUser,
    deletionUser,
    disableUser,
    logoutUser,
    restoreUser,
    signinUser,
};