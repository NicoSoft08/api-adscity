const { auth, firestore, admin } = require('../config/firebase-admin');
const { sendCode, sendAdminEmail, sendNewDeviceAlert, sendPasswordResetEmail } = require('../controllers/emailController');
const { formatDate, formatDateISO } = require('../cron');
const { monthNames, generateVerificationCode, getUserProfileNumber, logAdminAction } = require('../func');
const { trackUserDevice } = require('../services/apiServices');
const crypto = require('crypto');

const currentDate = new Date();
const expirationTime = new Date().setMinutes(currentDate.getMinutes() + 15); // Ajouter 15 minutes
const oneMonthLater = new Date(currentDate);
oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);


const createUser = async (address, city, country, email, password, firstName, lastName, phoneNumber, displayName) => {
    try {
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            disabled: false,
            emailVerified: false,
            phoneNumber: phoneNumber,
            displayName: `${firstName} ${lastName}`
        });

        console.log('Utilisateur créé avec succès:', userRecord.uid);

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

        // Ajouter les informations de l'utilisateur dans Firestore
        const userRef = firestore.collection('USERS');

        // 📌 Récupérer le dernier utilisateur créé (triée par userID)
        const lastUserSnapshot = await userRef.orderBy('UserID', 'desc').limit(1).get();
        let lastUserID = "USER000";
        if (!lastUserSnapshot.empty) {
            lastUserID = lastUserSnapshot.docs[0].data().UserID;
        }

        // 📌 Extraire le numéro et incrémenter
        const lastNumber = parseInt(lastUserID.replace("USER", ""), 10);
        const newNumber = lastNumber + 1;
        const newUserID = `USER${String(newNumber).padStart(3, "0")}`; // Format PUB001, PUB002
        const newUserRef = userRef.doc(userRecord.uid);


        await newUserRef.set({
            address,
            adHistory: [],
            adsClicked: [],
            adsCount: 0,
            adsPostedThisMonth: 0,
            adsSaved: [],
            adsViewed: [],
            categoriesViewed: [],
            city,
            clicksOnAds: 0,
            country,
            coverChanges: { count: 0, lastUpdated: null },
            coverURL: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            currentMonth: monthNames[currentDate.getMonth()],
            currentYear: new Date().getFullYear(),
            displayName: `${firstName} ${lastName}`,
            email,
            emailVerified: false,
            expirationTime: expirationTime,
            firstName,
            isActive: true,
            isOnline: false,
            lastName,
            location: `${country}, ${city}, ${address}`,
            loginCount: 0,
            phoneNumber,
            plans: {
                individual: {
                    max_ads: maxAds,
                    max_photos: maxPhotos,
                    isActive: true,
                    type: 'individual',
                    subscriptionDate: admin.firestore.FieldValue.serverTimestamp(),
                    expiryDate: expiryDate,
                },
            },
            profilChanges: { count: 0, lastUpdated: null },
            profileType: "Particulier",
            profileViewed: 0,
            profileVisits: 0, // Total des visites
            profileVisitsToday: 0, // Visites du jour
            profileVisitsByCity: {}, // Objet { 'Moscow': 0, 'St-Petersbourg': 0, ... }
            profileVisitsHistory: [], // Historique des visites
            profileNumber: profileNumber,
            profilURL: null,
            ratings: {
                average: 0,
                total: 0,
                count: 0,
                distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            },
            reportingCount: 0,
            registrationDate: formatDate(new Date()),
            registrationDateISO: formatDateISO(new Date()),
            role: 'user',
            reviews: {
                received: [],
                given: [],
                lastReviewDate: null,
                totalReviews: 0,
                pendingReviews: [],
                reportedReviews: [],
                verifiedReviews: 0,
                helpfulVotes: 0,
            },
            searchHistory: [],
            socialLinks: null,
            status: 'active', // suspended, banned
            subscription: 'free', // free, pro, business
            timeSpent: 0,
            totalAdsViewed: 0,
            UserID: newUserID,
            userID: userRecord.uid,
            verificationCode: code,
        });

        // Envoi du code de vérification par email
        sendCode(displayName, email, code)
            .then(() => console.log('Code de vérification envoyé avec succès:', code))
            .catch(error => console.error('Erreur:', error.message));

        console.log('Utilisateur enregistré avec succès', userRecord.uid);

        return { userRecord, code };
    } catch (error) {
        console.error("Erreur lors de la création de l'utilisateur:", error);
    }
};


const signinUser = async (userID, deviceInfo) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const loginActivityRef = userRef.collection("LOGIN_ACTIVITY");
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return { success: false, message: "Utilisateur introuvable." };
        }

        const userData = userDoc.data();
        const { role, loginCount = 0 } = userData;

        // 🔍 Vérifier si l'appareil est déjà enregistré (basé sur le navigateur, l'OS et l'IP)
        const existingDevices = await loginActivityRef
            .where("deviceInfo.browser", "==", deviceInfo.browser)
            .where("deviceInfo.os", "==", deviceInfo.os)
            .where("deviceInfo.device", "==", deviceInfo.device)
            .get();

        let isDeviceRegistered = false;
        existingDevices.forEach((doc) => {
            if (doc.data().deviceInfo.ip === deviceInfo.ip) {
                isDeviceRegistered = true;
            }
        });

        if (isDeviceRegistered) {
            console.log("🔹 Appareil déjà enregistré :", deviceInfo);
        } else {
            // 📌 Enregistrer le nouvel appareil
            await loginActivityRef.add({
                deviceInfo,
                time: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log("✅ Nouvel appareil enregistré :", deviceInfo);
        }

        // 🔹 Mise à jour des informations utilisateur après connexion
        await userRef.update({
            loginCount: admin.firestore.FieldValue.increment(1),
            isOnline: true,
            lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("✅ Connexion réussie :", userID);
        return {
            success: true,
            message: loginCount === 0 ? "Connexion réussie (première connexion)." : "Connexion réussie.",
            role,
        };
    } catch (error) {
        console.error("❌ Erreur dans signinUser :", error.message);
        return false
    }
};

const logoutUser = async (userID) => {
    try {
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

        // 🔹 Vérifie si l'utilisateur existe dans Firestore
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.error(`⚠️ Aucune donnée Firestore trouvée pour ${userID}`);
            return false;
        }

        console.log(`✅ Données Firestore trouvées pour ${userID}, mise à jour en cours...`);

        // 🔹 Mise à jour de Firestore
        await userRef.update({
            isOnline: false,
            lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`🚀 Déconnexion réussie pour ${userID}`);
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la déconnexion :", error);
        return false;
    }
};

const deletionUser = async (userID) => {
    try {
        const userSnapshot = await firestore.collection('USERS')
            .where('userID', '==', userID)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            console.log('Utilisateur non trouvé');
            return false;
        }
        const userDocID = userSnapshot.docs[0].id;
        await auth.revokeRefreshTokens(userID);
        await firestore.collection('USERS').doc(userDocID).delete();
        await auth.deleteUser(userID);
        console.log('Utilisateur supprimé avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        return false;
    }
};

const disableUser = async (userID) => {
    try {
        // Vérifie si l'utilisateur existe dans Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            console.log('Utilisateur non trouvé');
            return false;
        }
        await auth.updateUser(userID, {
            disabled: true,
        });

        // Vérifie si l'utilisateur existe dans Firestore
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return false;
        }
        await userRef.update({
            isActive: false,
            lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
        return false;
    }
};

const restoreUser = async (userID) => {
    try {
        // Vérifie si l'utilisateur existe dans Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            console.log('Utilisateur non trouvé');
            return false;
        }
        await auth.updateUser(userID, {
            disabled: false,
        });

        // Vérifie si l'utilisateur existe dans Firestore
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return false;
        }
        await userRef.update({
            isActive: true,
            lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error('Erreur lors de la restauration de l\'utilisateur:', error);
        return false;
    }
}

const verifyCode = async (email, code) => {
    try {
        // Recherche l'utilisateur dans Firestore par email
        const userSnapshot = await firestore.collection('USERS')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            console.log('Utilisateur non trouvé');
            return false;
        }

        console.log('Utilisateur trouvé');

        // Récupère le document de l'utilisateur
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
        const { verificationCode, expirationTime } = userData

        console.log('Code stocké dans la base de données:', verificationCode);
        console.log('Code fourni par l\'utilisateur:', code);

        // Comparer le code fourni avec le code stocké
        if (verificationCode !== parseInt(code)) {
            console.error('Code incorrect');
            throw new Error('Code incorrect');
        }

        // Check expiration using Timestamp comparison
        const currentTime = Date.now();
        const expirationMillis = expirationTime._seconds * 1000;

        if (currentTime > expirationMillis) {
            throw new Error('Code expiré');
        }

        // Si tout est correct
        console.log('Code vérifié avec succès');

        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, {
            emailVerified: true,
        });


        await firestore.collection('USERS').doc(userDoc.id).update({
            emailVerified: true,
            verificationCode: null,
            expirationTime: null,
        });

        console.log('Utilisateur mis à jour avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la vérification du code:', error);
        return false;
    }
};

const updatePassword = async (email, newPassword) => {
    try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, {
            password: newPassword,
        });
        console.log('Mot de passe mis à jour avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la mise à jour du mot de passe:', error);
        return false;
    };
};

const addNewAdmin = async (displayName, firstName, lastName, email, phoneNumber, password, permissions, address, city, country, captchaToken) => {
    try {
        // Ajouter les informations de l'utilisateur dans Firestore
        const userRef = firestore.collection('USERS');
        userRef.where('email', '==', email).limit(1);

        const userSnapshot = await userRef.get();
        if (userSnapshot.empty) {
            console.log('Utilisateur déjà existant');
            return false;
        }

        const profileNumber = getUserProfileNumber();

        const user = await auth.createUser({
            email: email,
            emailVerified: true,
            password: password,
            displayName: `${firstName} ${lastName}`,
            phoneNumber: phoneNumber,
            disabled: false,
        });

        // 📌 Récupérer le dernier utilisateur créé (triée par userID)
        const lastUserSnapshot = await userRef.orderBy('UserID', 'desc').limit(1).get();
        let lastUserID = "USER000";
        if (!lastUserSnapshot.empty) {
            lastUserID = lastUserSnapshot.docs[0].data().UserID;
        }

        // 📌 Extraire le numéro et incrémenter
        const lastNumber = parseInt(lastUserID.replace("USER", ""), 10);
        const newNumber = lastNumber + 1;
        const newUserID = `USER${String(newNumber).padStart(3, "0")}`; // Format PUB001, PUB002
        const newUserRef = userRef.doc(user.uid);

        await newUserRef.set({
            userID: user.uid,
            displayName: `${firstName} ${lastName}`,
            firstName: firstName,
            lastName: lastName,
            email: email,
            phoneNumber: phoneNumber,
            isOnline: false,
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
            permissions: permissions,
            UserID: newUserID,  // 🔥 Ajout de l'ID généré
            city: null,
            country: null,
            address: null,
            emailVerified: true,
            isActive: true,
            isOnline: false,
            location: null,
            profilURL: null,
            role: 'admin',
            profileNumber: profileNumber,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Utilisateur admin créé avec succès');

        // 🔹 Envoi des identifiants par email
        await sendAdminEmail(email, password, `${firstName} ${lastName}`);

        return true;
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur admin:', error);
        return false;
    };
};

const requestPasswordResetEmail = async (email) => {
    try {
        // Check if user exists
        const usersRef = firestore.collection('USERS');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();
        if (snapshot.empty) {
            console.log('Utilisateur non trouvé');
            return false;
        }

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set token expiration (1 hour from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        // Store the token in the database
        const userDoc = snapshot.docs[0];
        const userID = userDoc.id;

        const userData = userDoc.data();
        const { firstName, lastName } = userData;

        // Create or update password reset document
        const resetRef = firestore.collection('PASSWORD_RESETS').doc(userID);
        await resetRef.set({
            email: email,
            token: tokenHash,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // const resetLink = await auth.generatePasswordResetLink(email, { url: `${process.env.PUBLIC_URL}/auth/reset-password/${resetToken}` });

        // Create reset URL with the unhashed token
        const resetUrl = `${process.env.PUBLIC_URL}/auth/reset-password/${resetToken}`;

        // Send email with reset link
        await sendPasswordResetEmail(email, firstName, lastName, resetUrl);
        return true;
    } catch (error) {
        console.error('Erreur lors de la demande de réinitialisation du mot de passe:', error);
        return false;
    }
};

// Verify that the token is valid and matches the email
const verifyPasswordResetToken = async (email, token) => {
    try {
        // Query the PASSWORD_RESETS collection for matching token
        const resetSnapshot = await firestore.collection('PASSWORD_RESETS')
            .where('token', '==', token)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (resetSnapshot.empty) {
            console.log('Token invalide ou expiré');
            return false;
        }

        const resetDoc = resetSnapshot.docs[0];
        const resetData = resetDoc.data();
        console.log('Token trouvé dans la base de données:', resetData);
        const { createdAt, expiresAt } = resetData;

        // Check if the token is expired
        if (expiresAt.toDate() < new Date()) {
            console.log('Le lien de réinitialisation a expiré');
            return false;
        }

        return true;
    } catch (error) {
        console.error("Erreur lors de la vérification du token:", error);
        return false;
    }
};

// Delete the token after successful password reset
const deletePasswordResetToken = async (email, token) => {
    try {
        const resetSnapshot = await firestore.collection('PASSWORD_RESETS')
            .where('token', '==', token)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!resetSnapshot.empty) {
            await resetSnapshot.docs[0].ref.delete();
        }

        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression du token:", error);
        return false;
    }
};

const verifyResetTokenValidity = async (token) => {
    try {
        // Hash the token to compare with stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find the reset record
        const resetSnapshot = await firestore.collection('PASSWORD_RESETS')
            .where('token', '==', tokenHash)
            .limit(1)
            .get();

        if (resetSnapshot.empty) {
            console.log('Token invalide ou expiré');
            return false;
        }

        const resetDoc = resetSnapshot.docs[0];
        const resetData = resetDoc.data();

        // Check if token is expired
        const expiresAt = resetData.expiresAt.toDate();

        if (expiresAt < new Date()) {
            // Delete expired token
            await resetDoc.ref.delete();

            console.log('Le lien de réinitialisation a expiré');
            return false;
        }

        // Token is valid
        console.log('Le lien de réinitialisation est valide');
        return {
            email: resetData.email,
        };
    } catch (error) {
        console.error('Erreur lors de la vérification de la validité du token de réinitialisation:', error);
        return false;
    }
};

const authorizeDevice = async (deviceID, verificationToken, userID) => {
    try {
        const tokenDoc = await firestore.collection('DEVICE_VERIFY_TOKENS').doc(deviceID).get();
        if (!tokenDoc.exists) {
            return {
                success: false,
                message: 'Token invalide',
            };
        }

        const tokenData = tokenDoc.data();
        if (tokenData.token !== verificationToken) {
            return {
                success: false,
                message: 'Token invalide',
            };
        }

        if (tokenData.expiresAt < new Date()) {
            return {
                success: false,
                message: 'Token expiré',
            };
        }

        await firestore.collection('DEVICE_VERIFY_TOKENS').doc(deviceID).delete();

        await firestore.collection('USERS').doc(userID).collection('DEVICES').doc(deviceID).update({
            verified: true,
        });

        console.log('Périphérique autorisé avec succès');

        return {
            success: true,
            message: 'Périphérique autorisé avec succès',
        };
    } catch (error) {
        console.error('Erreur lors de l\'autorisation du périphérique:', error);
        return false;
    }
};

const desableDevice = async (deviceID, verificationToken, userID) => {
    try {
        const tokenDoc = await firestore.collection('DEVICE_VERIFY_TOKENS').doc(deviceID).get();
        if (!tokenDoc.exists) {
            return {
                success: false,
                message: 'Token invalide',
            };
        };

        const tokenData = tokenDoc.data();
        if (tokenData.token !== verificationToken) {
            return {
                success: false,
                message: 'Token invalide',
            };
        };

        if (tokenData.expiresAt < new Date()) {
            return {
                success: false,
                message: 'Token expiré',
            };
        };

        await firestore.collection('DEVICE_VERIFY_TOKENS').doc(deviceID).delete();
        await firestore.collection('USERS').doc(userID).collection('DEVICES').doc(deviceID).delete();

        console.log('Périphérique désactivé avec succès');
        return {
            success: true,
            message: 'Périphérique désactivé avec succès',
        };
    } catch (error) {

    }
};

module.exports = {
    addNewAdmin,
    requestPasswordResetEmail,
    authorizeDevice,
    createUser,
    desableDevice,
    signinUser,
    logoutUser,
    deletionUser,
    disableUser,
    restoreUser,
    updatePassword,
    verifyCode,
    verifyResetTokenValidity,
    verifyPasswordResetToken,
    deletePasswordResetToken,
};