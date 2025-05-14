const { Pool } = require("pg");
const dotenv = require("dotenv");
const { firestore } = require("./firebase-admin");
const { monthNames, getUserProfileNumber } = require("../func");
const { formatDate } = require("date-fns");
const { formatDateISO } = require("../cron");
dotenv.config();

// Configuration de la connexion à la base de données PostgreSQL
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432,
});

const currentDate = new Date();
const profileNumber = getUserProfileNumber();

const migrateUsers = async () => {
    let client;

    try {
        client = await pool.connect();
        console.log('Connexion à PostgreSQL établie');

        // Récupérer tous les utilisateurs de Firestore
        console.log('Récupération des utilisateurs depuis Firestore...');

        const usersSnapshot = await firestore.collection('USERS').get();

        console.log(`${usersSnapshot.size} utilisateurs trouvés à migrer`);

        // Commencer la transaction
        await client.query('BEGIN');

        let userCount = 0;
        let notifCount = 0;
        let loginCount = 0;
        let verificationCount = 0

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userID = userDoc.id;

            console.log(`Migration de l'utilisateur: ${userData.email || userID}`);

            // Insérer l'utilisateur dans PostgreSQL
            await client.query(
                `INSERT INTO users (
                    id, "UserID", email, display_name, first_name, last_name, country, city,
                    address, phone_number, ads_viewed, categories_viewed, cover_url,
                    current_month, current_year, email_verified, expiration_time,
                    is_active, is_online, location, login_count, profile_type,
                    profile_viewed, profile_visits, profile_visits_today, profile_visits_by_city,
                    profile_visits_history, profile_number, profile_url, cover_changes,
                    profile_changes, ratings, reporting_count, registration_date,
                    registration_date_iso, role, reviews, search_history, social_links,
                    status, subscription, total_ads_viewed, verification_code, last_online,
                    permissions, ads_saved, device_token, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
                    $45, $46, $47, $48
                )
                ON CONFLICT (id) DO NOTHING`,
                [
                    userID,
                    userData.UserID || null,
                    userData.email || null,
                    userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
                    userData.firstName || null,
                    userData.lastName || null,
                    userData.country || null,
                    userData.city || null,
                    userData.address || null,
                    userData.phoneNumber || null,
                    JSON.stringify(userData.adsViewed || []),
                    JSON.stringify(userData.categoriesViewed || []),
                    userData.coverURL || null,
                    userData.currentMonth || monthNames[currentDate.getMonth()],
                    userData.currentYear || new Date().getFullYear(),
                    userData.emailVerified || false,
                    userData.expirationTime || null,
                    userData.isActive || true,
                    userData.isOnline || false,
                    userData.location || `${userData.country || ''}, ${userData.city || ''}, ${userData.address || ''}`.replace(/^, |, $|, , /g, ''),
                    userData.loginCount || 0,
                    userData.profileType || 'Particulier',
                    userData.profileViewed || 0,
                    userData.profileVisits || 0,
                    userData.profileVisitsToday || 0,
                    JSON.stringify(userData.profileVisitsByCity || {}),
                    JSON.stringify(userData.profileVisitsHistory || []),
                    userData.profileNumber || profileNumber,
                    userData.profileURL || null,
                    JSON.stringify(userData.coverChanges || { count: 0, lastUpdated: null }),
                    JSON.stringify(userData.profilChanges || { count: 0, lastUpdated: null }),
                    JSON.stringify(userData.ratings || {}),
                    userData.reportingCount || 0,
                    userData.registrationDate || formatDate(new Date()),
                    userData.registrationDateISO || formatDateISO(new Date()),
                    userData.role || 'user',
                    JSON.stringify(userData.reviews || {}),
                    JSON.stringify(userData.searchHistory || []),
                    JSON.stringify(userData.socialLinks || {}),
                    userData.status || 'active',
                    userData.subscription || 'free',
                    userData.totalAdsViewed || 0,
                    userData.verificationCode || null,
                    userData.lastOnline ? new Date(userData.lastOnline.toDate()) : null,
                    JSON.stringify(userData.permissions || []),
                    userData.adsSaved || [],
                    userData.deviceToken || null,
                    userData.updatedAt ? new Date(userData.updatedAt.toDate()) : new Date()
                ]
            );

            userCount++;
        }

        // Migrer les notifications de l'utilisateur
        console.log(`Migration des notifications pour ${userData.email || userID}...`);
        const notificationsSnapshot = await userDoc.ref.collection('NOTIFICATIONS').get();
        for (const notifDoc of notificationsSnapshot.docs) {
            const notifData = notifDoc.data();

            await client.query(
                `INSERT INTO user_notifications (
                  id, user_id, title, message, is_read, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING`,
                [
                    notifDoc.id,
                    userID,
                    notifData.title || null,
                    notifData.message || null,
                    notifData.isRead || false,
                    notifData.timestamp ? new Date(notifData.timestamp.toDate()) : new Date()
                ]
            );
            notifCount++;
        }

        // Migrer les activités de connexion
        console.log(`Migration des activités de connexion pour ${userData.email || userID}...`);
        const loginSnapshot = await userDoc.ref.collection('LOGIN_ACTIVITY').get();
        for (const loginDoc of loginSnapshot.docs) {
            const loginData = loginDoc.data();

            await client.query(
                `INSERT INTO login_activity (
                id, user_id, time, ip_address, device_info, location
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING`,
                [
                    loginDoc.id,
                    userID,
                    loginData.time ? new Date(loginData.time.toDate()) : new Date(),
                    loginData.ipAddress || null,
                    JSON.stringify(loginData.deviceInfo || {}),
                    JSON.stringify(loginData.location || {})
                ]
            );
            loginCount++;
        }

        // Migrer les données de vérification
        console.log(`Migration des données de vérification pour ${userData.email || userID}...`);
        const verificationSnapshot = await userDoc.ref.collection('VERIFICATION_ID').get();
        for (const verificationDoc of verificationSnapshot.docs) {
            const verificationData = verificationDoc.data();

            await client.query(
                `INSERT INTO verification_id (
            id, user_id, document_type, document_url, selfie_url, status, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING`,
                [
                    verificationDoc.id,
                    userID,
                    verificationData.documentType || null,
                    verificationData.documentUrl || null,
                    verificationData.selfieUrl || null,
                    verificationData.status || 'pending',
                    verificationData.submittedAt ? new Date(verificationData.submittedAt.toDate()) : new Date()
                ]
            );
            verificationCount++;
        }

        // Migrer les notifications admin
        console.log('Migration des notifications admin...');
        const adminNotificationsSnapshot = await firestore.collection('ADMIN_NOTIFICATIONS').get();
        let adminNotifCount = 0;
        for (const notifDoc of adminNotificationsSnapshot.docs) {
            const notifData = notifDoc.data();

            await client.query(
                `INSERT INTO admin_notifications (
          id, title, message, is_read, timestamp
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING`,
                [
                    notifDoc.id,
                    notifData.title || null,
                    notifData.message || null,
                    notifData.isRead || false,
                    notifData.timestamp ? new Date(notifData.timestamp.toDate()) : new Date()
                ]
            );
            adminNotifCount++;
        }

        // Valider la transaction
        await client.query('COMMIT');

        console.log('=== MIGRATION TERMINÉE AVEC SUCCÈS ===');
        console.log(`Utilisateurs migrés: ${userCount}`);
        console.log(`Notifications utilisateurs migrées: ${notifCount}`);
        console.log(`Activités de connexion migrées: ${loginCount}`);
        console.log(`Documents de vérification migrés: ${verificationCount}`);
        console.log(`Notifications admin migrées: ${adminNotifCount}`);

    } catch (error) {
        console.error('Erreur lors de la migration:', error);
        // Si nous utilisons un client, essayer de faire un rollback
        if (client) {
            await client.query('ROLLBACK');
        }
    } finally {
        // Libérer le client
        if (client) {
            client.release();
        }
    }
};

const migratePosts = async () => {
    let client;
    try {
        // Vérifier d'abord si les tables existent
        const checkClient = await pool.connect();
        try {
            const tableCheck = await checkClient.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'posts'
          )
        `);

            if (!tableCheck.rows[0].exists) {
                console.error('La table "posts" n\'existe pas. Veuillez exécuter le script de création des tables d\'abord.');
                return;
            }
        } finally {
            checkClient.release();
        }

        client = await pool.connect();
        console.log('Connexion à PostgreSQL établie');

        // Récupérer tous les annonces de Firestore
        console.log('Récupération des annonces depuis Firestore...');
        const postsSnapshot = await firestore.collection('POSTS').get();
        console.log(`${postsSnapshot.size} annonces trouvées à migrer`);

        // Commencer la transaction
        await client.query('BEGIN');
        let postCount = 0;

        for (const postDoc of postsSnapshot.docs) {
            const postData = postDoc.data();
            const postID = postDoc.id;
            const userID = postData.userID;
            const stats = postData.stats || {};

            console.log(`Migration de l'annonce: ${postID}`);
            postCount++;

            try {
                // Insérer l'annonce dans la table posts
                await client.query(
                    `INSERT INTO posts (
              id,
              user_id,
              details,
              category,
              subcategory,
              location,
              images,
              status,
              created_at,
              updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
            ON CONFLICT (id) DO NOTHING`,
                    [
                        postID,
                        userID,
                        JSON.stringify(postData.details || {}),
                        postData.category || null,
                        postData.subcategory || null,
                        JSON.stringify(postData.location || {}),
                        JSON.stringify(postData.images || []),
                        postData.status || 'active',
                        postData.createdAt ? new Date(postData.createdAt.toDate()) : new Date(),
                        postData.updatedAt ? new Date(postData.updatedAt.toDate()) : new Date()
                    ]
                );

                // Insérer les statistiques de l'annonce
                await client.query(
                    `INSERT INTO post_stats (
              post_id,
              views,
              clicks,
              reporting_count,
              views_per_city,
              clicks_per_city,
              report_per_city,
              views_history,
              clicks_history,
              report_history
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
            ON CONFLICT (post_id) DO NOTHING`,
                    [
                        postID,
                        stats.views || 0,
                        stats.clicks || 0,
                        stats.reportingCount || 0,
                        JSON.stringify(stats.viewsPerCity || {}),
                        JSON.stringify(stats.clicksPerCity || {}),
                        JSON.stringify(stats.reportPerCity || {}),
                        JSON.stringify(stats.viewsHistory || []),
                        JSON.stringify(stats.clicksHistory || []),
                        JSON.stringify(stats.reportHistory || [])
                    ]
                );
            } catch (insertError) {
                console.error(`Erreur lors de l'insertion de l'annonce ${postID}:`, insertError);
                // Continuer avec la prochaine annonce au lieu d'échouer toute la migration
            }
        }

        // Valider la transaction
        await client.query('COMMIT');
        console.log('=== MIGRATION TERMINÉE AVEC SUCCÈS ===');
        console.log(`Annonces migrées: ${postCount}`);
    } catch (error) {
        console.error('Erreur lors de la migration:', error);
        // Si nous utilisons un client, essayer de faire un rollback
        if (client) {
            await client.query('ROLLBACK');
        }
    } finally {
        // Libérer le client
        if (client) {
            client.release();
        }
    }
};


const verifyMigration = async () => {
    const client = await pool.connect();

    try {
        // Compter les utilisateurs
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        console.log(`Total des utilisateurs migrés: ${userCount.rows[0].count}`);

        // Compter les notifications
        const notifCount = await client.query('SELECT COUNT(*) FROM user_notifications');
        console.log(`Total des notifications utilisateurs migrées: ${notifCount.rows[0].count}`);

        // Compter les activités de connexion
        const loginCount = await client.query('SELECT COUNT(*) FROM login_activity');
        console.log(`Total des activités de connexion migrées: ${loginCount.rows[0].count}`);

        // Compter les documents de vérification
        const verificationCount = await client.query('SELECT COUNT(*) FROM verification_id');
        console.log(`Total des documents de vérification migrés: ${verificationCount.rows[0].count}`);

        // Compter les notifications admin
        const adminNotifCount = await client.query('SELECT COUNT(*) FROM admin_notifications');
        console.log(`Total des notifications admin migrées: ${adminNotifCount.rows[0].count}`);

        // Afficher quelques exemples d'utilisateurs
        const sampleUsers = await client.query('SELECT id, email, username FROM users LIMIT 5');
        console.log('\nExemples d\'utilisateurs migrés:');
        sampleUsers.rows.forEach(user => {
            console.log(`- ID: ${user.id}, Email: ${user.email}, Username: ${user.displayName}`);
        });

    } finally {
        // Libérer le client
        if (client) {
            client.release();
        }
        // Fermer le pool
        await pool.end();
    }
};

const createTables = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Créer la table posts
        await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          details JSONB DEFAULT '{}',
          category VARCHAR(100),
          subcategory VARCHAR(100),
          location JSONB DEFAULT '{}',
          images JSONB DEFAULT '[]',
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          moderated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        )
      `);

        // Créer la table post_stats
        await client.query(`
        CREATE TABLE IF NOT EXISTS post_stats (
          post_id VARCHAR(255) PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
          views INTEGER DEFAULT 0,
          clicks INTEGER DEFAULT 0,
          reporting_count INTEGER DEFAULT 0,
          views_per_city JSONB DEFAULT '{}',
          clicks_per_city JSONB DEFAULT '{}',
          report_per_city JSONB DEFAULT '{}',
          views_history JSONB DEFAULT '{}',
          clicks_history JSONB DEFAULT '{}',
          report_history JSONB DEFAULT '{}'
        )
      `);

        // Créer des index pour améliorer les performances
        await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
        CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
      `);

        await client.query('COMMIT');
        console.log('Tables créées avec succès');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la création des tables:', error);
    } finally {
        client.release();
    }
};

module.exports = {
    migrateUsers,
    migratePosts,
    verifyMigration,
    createTables,
};