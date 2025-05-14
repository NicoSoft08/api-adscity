const db = require('../config/database');
const { deleteImagesByPostID } = require('../firebase/storage');
const { formatRelativeDate, generateSlug, monthNames } = require('../func');

const makePost = async (postData, userID) => {
    const client = await db.pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

        // 1️⃣ Récupérer les données utilisateur
        const userQuery = 'SELECT * FROM users WHERE id = $1';
        const userResult = await client.query(userQuery, [userID]);

        if (userResult.rows.length === 0) {
            console.error("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }

        const userData = userResult.rows[0];
        const { is_active, plans, ads_posted_this_month, user_id: UserID } = userData;
        const { location } = postData;


        // 2️⃣ Vérifier si l'utilisateur est actif
        if (!is_active) {
            console.error("Utilisateur inactif. Veuillez contacter le support.");
            await client.query('ROLLBACK');
            return false;
        }

        // 3️⃣ Vérifier si une promotion est active
        const promotionQuery = 'SELECT * FROM promotions WHERE code = $1 AND is_active = true AND start_date <= NOW() AND end_date >= NOW()';
        const promotionResult = await client.query(promotionQuery, ['launchOffer']);

        let maxAdsPerMonth;
        if (promotionResult.rows.length > 0) {
            const promotionFeatures = promotionResult.rows[0].features;
            maxAdsPerMonth = promotionFeatures.maxAdsPerMonth || null;
        }

        // 4️⃣ Gérer les limites du plan
        const userPlans = typeof plans === 'string' ? JSON.parse(plans) : plans;
        const userPlanKey = Object.keys(userPlans).find(planKey => userPlans[planKey]?.max_ads);
        const userPlan = userPlanKey ? userPlans[userPlanKey] : null;

        if (!userPlan) {
            console.error("Plan utilisateur introuvable");
            await client.query('ROLLBACK');
            return false;
        }

        const maxAdsFromPlan = userPlan.max_ads;
        const maxAds = maxAdsPerMonth || maxAdsFromPlan; // Priorité à la promotion

        // Vérifier si l'utilisateur a atteint la limite d'annonces
        if (ads_posted_this_month >= maxAds) {
            console.error("Limite d'annonces mensuelles atteinte");
            await client.query('ROLLBACK');
            return false;
        }

        // 6️⃣ Ajouter l'annonce dans PostgreSQL

        // 📌 Récupérer le dernier ID de post
        const lastPostQuery = 'SELECT post_id FROM posts ORDER BY post_id DESC LIMIT 1';
        const lastPostResult = await client.query(lastPostQuery);

        let lastPostID = "POST000";
        if (lastPostResult.rows.length > 0) {
            lastPostID = lastPostResult.rows[0].post_id;
        }

        // 📌 Extraire le numéro et incrémenter
        const lastNumber = parseInt(lastPostID.replace("POST", ""), 10);
        const newNumber = lastNumber + 1;
        const newPostID = `POST${String(newNumber).padStart(3, "0")}`; // Format POST001, POST002

        // 🆕 Initialiser les statistiques
        const stats = {
            views: 0,
            clicks: 0,
            reportingCount: 0,
            views_per_city: {},
            clicks_per_city: {},
            report_per_city: {},
            views_history: {},
            clicks_history: {},
            report_history: {}
        };

        // 🗓️ Initialiser les vues et clics sur 7, 15, 30 jours
        const periods = [7, 15, 30];
        const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        periods.forEach(days => {
            const formattedDate = formatRelativeDate(today);
            stats.views_history[days] = { [formattedDate]: 0 };
            stats.clicks_history[days] = { [formattedDate]: 0 };
            stats.report_history[days] = { [formattedDate]: 0 };
        });

        // Insert post into database
        const insertPostQuery = `
            INSERT INTO posts (
                id, 
                user_id, 
                user_unique_id,
                post_id,
                details, 
                category, 
                subcategory, 
                location, 
                images, 
                stats,
                status, 
                updated_at,
                posted_at,
                is_active,
                is_sold,
                refusal_reason,
                conversion_rate,
                engagement_rate,
                reported,
                slug,
                type,
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            ) RETURNING id
        `;

        const postValues = [
            userID,
            UserID,
            newPostID,
            postData.details || {},
            postData.category,
            postData.subcategory,
            JSON.stringify(postData.location),
            JSON.stringify(postData.images || []),
            JSON.stringify(stats),
            'pending',
            null,
            new Date(),
            false,
            false,
            null,
            0,
            0,
            generateSlug(postData.details.title),
            'regular',
        ];

        const postResult = await client.query(insertPostQuery, postValues);
        const newPostDbId = postResult.rows[0].id;

        // 7️⃣ Gérer le compteur d'annonces mensuelles
        const currentMonthName = monthNames[new Date().getMonth()];

        if (userData.current_month !== currentMonthName) {
            // Nouveau mois : Réinitialiser le compteur mensuel
            const updateUserQuery = `
                UPDATE users 
                SET ads_posted_this_month = 1,
                    current_month = $1,
                    ads_count = ads_count + 1
                WHERE id = $2
            `;

            await client.query(updateUserQuery, [currentMonthName, userID]);
        } else {
            // Même mois : Incrémenter les compteurs
            const updateUserQuery = `
                UPDATE users 
                SET ads_posted_this_month = ads_posted_this_month + 1,
                    ads_count = ads_count + 1
                WHERE id = $1
            `;
            await client.query(updateUserQuery, [userID]);
        }

        // 8️⃣ Sauvegarder la localisation (si applicable)
        if (location && location.country && location.city) {
            const locationQuery = `
                INSERT INTO locations (country, city, count)
                VALUES ($1, $2, 1)
                ON CONFLICT (country, city)
                DO UPDATE SET count = locations.count + 1
            `;
            await client.query(locationQuery, [location.country, location.city]);
        }

        // 📢 9️⃣ Envoyer une notification à l'admin
        const adminNotificationQuery = `
            INSERT INTO admin_notifications (
                type,
                title,
                message,
                timestamp,
                is_read,
                link
            ) VALUES (
                $1, $2, $3, $4, $5, $6
            )
        `;

        const notificationValues = [
            'new_post',
            'Nouvelle annonce en attente',
            `Nouvelle annonce en attente de validation: ${postData?.details.title}`,
            new Date(),
            false,
            `/admin/dashboard/posts/${newPostID}`
        ];

        await client.query(adminNotificationQuery, notificationValues);

        // 📧 🔔 🔹 Envoi d'un email à l'admin
        sendEmailToAdmin(postData, newPostID);

        // Commit transaction
        await client.query('COMMIT');

        console.log('Annonce créée avec succès', newPostDbId);
        return true;
    } catch (error) {
        // Rollback transaction in case of error
        await client.query('ROLLBACK');
        console.error("Erreur lors de la création de l'annonce :", error);
        return false;
    } finally {
        // Release client back to pool
        client.release();
    }
};

const reportPostID = async (postID, userID, reason) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérification si l'utilisateur et l'annonce existent
        const userQuery = 'SELECT city FROM users WHERE id = $1';
        const userResult = await client.query(userQuery, [userID]);

        const postQuery = 'SELECT stats FROM posts WHERE id = $1';
        const postResult = await client.query(postQuery, [postID]);

        if (userResult.rows.length === 0 || postResult.rows.length === 0) {
            console.log('Utilisateur ou annonce non trouvé');
            await client.query('ROLLBACK');
            return false;
        }

        const { city } = userResult.rows[0];
        const { stats } = postResult.rows[0];

        // Vérifier si l'utilisateur a déjà signalé ce post
        const existingReportQuery = `
        SELECT id FROM reports 
        WHERE post_id = $1 AND user_id = $2
      `;
        const existingReportResult = await client.query(existingReportQuery, [postID, userID]);

        if (existingReportResult.rows.length > 0) {
            console.log('Signalement déjà enregistré');
            await client.query('ROLLBACK');
            return false;
        }

        // Vérifier si l'utilisateur n'a pas signalé trop d'annonces en 24h
        const recentReportsQuery = `
        SELECT COUNT(*) as report_count 
        FROM reports 
        WHERE user_id = $1 AND reported_at >= NOW() - INTERVAL '24 hours'
      `;
        const recentReportsResult = await client.query(recentReportsQuery, [userID]);

        if (parseInt(recentReportsResult.rows[0].report_count) >= 5) {
            console.log('Utilisateur a atteint la limite de signalements');
            await client.query('ROLLBACK');
            return false;
        }

        // Ajouter le signalement
        const insertReportQuery = `
        INSERT INTO reports (post_id, user_id, reason, city, reported_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
        await client.query(insertReportQuery, [postID, userID, reason, city]);

        // Incrémenter le nombre de signalements sur l'annonce
        const reportByCity = stats.report_per_city || {};
        if (city) {
            reportByCity[city] = (reportByCity[city] || 0) + 1;
        }

        const reportHistory = Array.isArray(stats.report_history) ? stats.report_history : [];
        reportHistory.push(Date.now());

        const now = Date.now();
        const updatedHistory = reportHistory.filter(timestamp =>
            now - timestamp <= 30 * 24 * 60 * 60 * 1000
        );

        // Mettre à jour les statistiques de l'annonce
        const updatePostQuery = `
        UPDATE posts 
        SET 
          stats = jsonb_set(
            jsonb_set(
              jsonb_set(
                stats::jsonb, 
                '{reportingCount}', 
                (COALESCE((stats->>'reportingCount')::int, 0) + 1)::text::jsonb
              ),
              '{report_per_city}', 
              $1::jsonb
            ),
            '{report_history}', 
            $2::jsonb
          )
        WHERE id = $3
      `;

        await client.query(updatePostQuery, [
            JSON.stringify(reportByCity),
            JSON.stringify(updatedHistory),
            postID
        ]);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors du signalement de l\'annonce:', error);
        return false;
    } finally {
        client.release();
    }
};

const validatePost = async (postID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Calculer la date d'expiration (30 jours à partir de maintenant)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        // Mettre à jour le statut de l'annonce
        const updatePostQuery = `
        UPDATE posts 
        SET 
          status = 'approved',
          is_active = true,
          moderated_at = NOW(),
          expiry_date = $1
        WHERE id = $2
        RETURNING user_id, title, posted_at
      `;

        const postResult = await client.query(updatePostQuery, [expiryDate.toISOString(), postID]);

        if (postResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        const { user_id, title, posted_at } = postResult.rows[0];

        // Récupérer les informations de l'utilisateur
        const userQuery = `
        SELECT display_name, email 
        FROM users 
        WHERE id = $1
      `;

        const userResult = await client.query(userQuery, [user_id]);

        if (userResult.rows.length === 0) {
            console.error('Utilisateur non trouvé.');
            await client.query('ROLLBACK');
            return false;
        }

        const { display_name, email } = userResult.rows[0];

        // Enregistrer la notification pour l'utilisateur
        const insertNotificationQuery = `
        INSERT INTO notifications (
          user_id, 
          type, 
          title, 
          message, 
          is_read, 
          created_at,
          link
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `;

        await client.query(insertNotificationQuery, [
            user_id,
            'ad_approval',
            'Annonce approuvée',
            `Votre annonce "${title}" a été approuvée.`,
            false,
            `/posts/post/${postID}`
        ]);

        // Envoyer l'email de notification à l'utilisateur
        await sendUserAdsApprovedEmail(display_name, email, title, posted_at);

        await client.query('COMMIT');
        console.log('Annonce approuvée avec succès et expire le :', expiryDate);
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de l\'approbation de l\'annonce :', error);
        return false;
    } finally {
        client.release();
    }
};

const rejectPost = async (postID, reason) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Mettre à jour le statut de l'annonce
        const updatePostQuery = `
        UPDATE posts 
        SET 
          status = 'refused',
          refusal_reason = $1,
          moderated_at = NOW()
        WHERE id = $2
        RETURNING user_id, title, posted_at
      `;

        const postResult = await client.query(updatePostQuery, [reason, postID]);

        if (postResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        const { user_id, title, posted_at } = postResult.rows[0];

        // Récupérer les informations de l'utilisateur
        const userQuery = `
        SELECT display_name, email 
        FROM users 
        WHERE id = $1
      `;

        const userResult = await client.query(userQuery, [user_id]);

        if (userResult.rows.length === 0) {
            console.error('Utilisateur non trouvé.');
            await client.query('ROLLBACK');
            return false;
        }

        const { display_name, email } = userResult.rows[0];

        // Enregistrer la notification pour l'utilisateur
        const insertNotificationQuery = `
        INSERT INTO notifications (
          user_id, 
          type, 
          title, 
          message, 
          is_read, 
          created_at,
          link
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `;

        await client.query(insertNotificationQuery, [
            user_id,
            'ad_refusal',
            'Annonce refusée',
            `Votre annonce "${title}" a été refusée, au regard du motif suivant: ${reason}.`,
            false,
            null
        ]);

        // Envoyer l'email de notification à l'utilisateur
        await sendUserAdsRefusedEmail(display_name, email, title, posted_at, reason);

        await client.query('COMMIT');
        console.log('Annonce refusée avec succès');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors du rejet de l\'annonce :', error);
        return false;
    } finally {
        client.release();
    }
};

const adminDeletePostByID = async (postID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si l'annonce existe
        const checkQuery = 'SELECT id FROM posts WHERE id = $1';
        const checkResult = await client.query(checkQuery, [postID]);

        if (checkResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        // Supprimer les images associées à l'annonce
        await deleteImagesByPostID(postID);

        // Supprimer les signalements associés à l'annonce
        const deleteReportsQuery = 'DELETE FROM reports WHERE post_id = $1';
        await client.query(deleteReportsQuery, [postID]);

        // Supprimer les favoris associés à l'annonce
        const deleteFavoritesQuery = 'DELETE FROM favorites WHERE post_id = $1';
        await client.query(deleteFavoritesQuery, [postID]);

        // Supprimer l'annonce
        const deletePostQuery = 'DELETE FROM posts WHERE id = $1';
        await client.query(deletePostQuery, [postID]);

        await client.query('COMMIT');
        console.log('Annonce supprimée avec succès');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la suppression de l\'annonce :', error);
        return false;
    } finally {
        client.release();
    }
};

const collectPosts = async () => {
    try {
        const query = `
        SELECT 
          id, 
          user_id, 
          title, 
          description, 
          price, 
          category, 
          location, 
          status, 
          is_active, 
          posted_at, 
          moderated_at, 
          expiry_date, 
          refusal_reason, 
          stats,
          images,
          details
        FROM posts
      `;

        const result = await db.query(query);

        const ads = result.rows;
        const pendingAds = [];
        const approvedAds = [];
        const refusedAds = [];

        // Classer les annonces par statut
        ads.forEach(ad => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof ad.stats === 'string') ad.stats = JSON.parse(ad.stats);
            if (typeof ad.details === 'string') ad.details = JSON.parse(ad.details);
            if (typeof ad.images === 'string') ad.images = JSON.parse(ad.images);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            const formattedAd = {
                id: ad.id,
                userID: ad.user_id,
                title: ad.title,
                description: ad.description,
                price: ad.price,
                category: ad.category,
                location: ad.location,
                status: ad.status,
                isActive: ad.is_active,
                posted_at: ad.posted_at,
                moderated_at: ad.moderated_at,
                expiry_date: ad.expiry_date,
                refusal_reason: ad.refusal_reason,
                stats: ad.stats,
                images: ad.images,
                details: ad.details
            };

            // Classer par statut
            if (ad.status === 'pending') pendingAds.push(formattedAd);
            if (ad.status === 'approved') approvedAds.push(formattedAd);
            if (ad.status === 'refused') refusedAds.push(formattedAd);
        });

        return {
            allAds: ads,
            pendingAds,
            approvedAds,
            refusedAds
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces:', error);
        return {
            allAds: [],
            pendingAds: [],
            approvedAds: [],
            refusedAds: []
        };
    }
};

const collectPendingPosts = async () => {
    try {
        const query = `
        SELECT 
          id, 
          user_id AS "userID", 
          title, 
          description, 
          price, 
          category, 
          location, 
          status, 
          is_active AS "isActive", 
          posted_at, 
          moderated_at, 
          expiry_date, 
          refusal_reason, 
          stats,
          images,
          details
        FROM posts
        WHERE status = 'pending'
      `;

        const result = await db.query(query);

        // Formater les données pour correspondre à la structure attendue
        const pendingAds = result.rows.map(ad => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof ad.stats === 'string') ad.stats = JSON.parse(ad.stats);
            if (typeof ad.details === 'string') ad.details = JSON.parse(ad.details);
            if (typeof ad.images === 'string') ad.images = JSON.parse(ad.images);

            return ad;
        });

        return pendingAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces en attente:', error);
        return [];
    }
};

const collectApprovedPosts = async () => {
    try {
        const query = `
        SELECT 
          id, 
          user_id AS "userID", 
          title, 
          description, 
          price, 
          category, 
          location, 
          status, 
          is_active AS "isActive", 
          posted_at, 
          moderated_at, 
          expiry_date, 
          refusal_reason, 
          stats,
          images,
          details
        FROM posts
        WHERE status = 'approved'
        ORDER BY moderated_at DESC
      `;

        const result = await db.query(query);

        // Formater les données pour correspondre à la structure attendue
        const approvedAds = result.rows.map(ad => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof ad.stats === 'string') ad.stats = JSON.parse(ad.stats);
            if (typeof ad.details === 'string') ad.details = JSON.parse(ad.details);
            if (typeof ad.images === 'string') ad.images = JSON.parse(ad.images);

            return ad;
        });

        return approvedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces approuvées:', error);
        return false;
    }
};

const collectRejectedPosts = async () => {
    try {
        const query = `
        SELECT 
          id, 
          user_id AS "userID", 
          title, 
          description, 
          price, 
          category, 
          location, 
          status, 
          is_active AS "isActive", 
          posted_at, 
          moderated_at, 
          expiry_date, 
          refusal_reason, 
          stats,
          images,
          details
        FROM posts
        WHERE status = 'refused'
      `;

        const result = await db.query(query);

        // Formater les données pour correspondre à la structure attendue
        const refusedAds = result.rows.map(ad => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof ad.stats === 'string') ad.stats = JSON.parse(ad.stats);
            if (typeof ad.details === 'string') ad.details = JSON.parse(ad.details);
            if (typeof ad.images === 'string') ad.images = JSON.parse(ad.images);

            return ad;
        });

        return refusedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces refusées:', error);
        return [];
    }
};

const collectDataFromPostID = async (post_id) => {
    try {
        const PostID = post_id?.toUpperCase();

        const query = `
        SELECT *
        FROM posts
        WHERE UPPER("PostID") = $1
        LIMIT 1
      `;

        const result = await db.query(query, [PostID]);

        if (result.rows.length === 0) {
            console.log('Aucune annonce trouvée avec cet ID.');
            return null;
        }

        const postData = result.rows[0];

        // Convertir les champs JSON en objets JavaScript si nécessaire
        if (typeof postData.stats === 'string') postData.stats = JSON.parse(postData.stats);
        if (typeof postData.details === 'string') postData.details = JSON.parse(postData.details);
        if (typeof postData.images === 'string') postData.images = JSON.parse(postData.images);
        if (typeof postData.location === 'string') postData.location = JSON.parse(postData.location);

        // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
        return {
            id: postData.id,
            userID: postData.user_id,
            PostID: postData.PostID,
            title: postData.title,
            description: postData.description,
            price: postData.price,
            category: postData.category,
            location: postData.location,
            status: postData.status,
            isActive: postData.is_active,
            posted_at: postData.posted_at,
            moderated_at: postData.moderated_at,
            expiry_date: postData.expiry_date,
            refusal_reason: postData.refusal_reason,
            stats: postData.stats,
            images: postData.images,
            details: postData.details
        };
    } catch (error) {
        console.error(`Erreur lors de la récupération de l'annonce avec ${post_id}:`, error);
        throw error;
    }
};

const collectPostByID = async (postID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE id = $1
      `;

        const result = await db.query(query, [postID]);

        if (result.rows.length === 0) {
            return false;
        }

        const adData = result.rows[0];

        if (adData.status !== 'approved') {
            return false;
        }

        // Convertir les champs JSON en objets JavaScript si nécessaire
        if (typeof adData.stats === 'string') adData.stats = JSON.parse(adData.stats);
        if (typeof adData.details === 'string') adData.details = JSON.parse(adData.details);
        if (typeof adData.images === 'string') adData.images = JSON.parse(adData.images);
        if (typeof adData.location === 'string') adData.location = JSON.parse(adData.location);

        // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
        return {
            id: adData.id,
            userID: adData.user_id,
            title: adData.title,
            description: adData.description,
            price: adData.price,
            category: adData.category,
            location: adData.location,
            status: adData.status,
            isActive: adData.is_active,
            posted_at: adData.posted_at,
            moderated_at: adData.moderated_at,
            expiry_date: adData.expiry_date,
            refusal_reason: adData.refusal_reason,
            stats: adData.stats,
            images: adData.images,
            details: adData.details
        };
    } catch (error) {
        console.error(`Erreur lors de la récupération de l'annonce avec ${postID}:`, error);
        return false;
    }
};

const collectPostsByUserID = async (userID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE user_id = $1
      `;

        const result = await db.query(query, [userID]);

        if (result.rows.length === 0) {
            console.log('Aucune annonce trouvée pour cet utilisateur.');
            return {
                allAds: [],
                pendingAds: [],
                approvedAds: [],
                refusedAds: []
            };
        }

        const ads = [];
        const pendingAds = [];
        const approvedAds = [];
        const refusedAds = [];

        result.rows.forEach(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            const ad = {
                id: row.id,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };

            ads.push(ad);

            if (row.status === 'pending') pendingAds.push(ad);
            if (row.status === 'approved') approvedAds.push(ad);
            if (row.status === 'refused') refusedAds.push(ad);
        });

        return {
            allAds: ads,
            pendingAds,
            approvedAds,
            refusedAds
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces de l\'utilisateur:', error);
        return {
            allAds: [],
            pendingAds: [],
            approvedAds: [],
            refusedAds: []
        };
    }
};

const collectPendingPostsByUserID = async (userID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE user_id = $1
        AND status = 'pending'
      `;

        const result = await db.query(query, [userID]);

        if (result.rows.length === 0) {
            return [];
        }

        const pendingAds = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return pendingAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces en attente:', error);
        return [];
    }
};

const collectApprovedPostsByUserID = async (userID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE user_id = $1
        AND status = 'approved'
      `;

        const result = await db.query(query, [userID]);

        if (result.rows.length === 0) {
            return [];
        }

        const approvedAds = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return approvedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces approuvées:', error);
        return [];
    }
};

const collectRejectedPostsByUserID = async (userID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE user_id = $1
        AND status = 'refused'
      `;

        const result = await db.query(query, [userID]);

        if (result.rows.length === 0) {
            return [];
        }

        const refusedAds = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return refusedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces refusées:', error);
        return [];
    }
};

const collectActivePostsByUserID = async (UserID) => {
    console.log(UserID);
    try {
        const user_id = UserID?.toUpperCase();

        const query = `
        SELECT *
        FROM posts
        WHERE status = 'approved'
        AND UPPER("UserID") = $1
      `;

        const result = await db.query(query, [user_id]);

        if (result.rows.length === 0) {
            console.log('Aucune annonce active trouvée pour cet utilisateur.');
            return [];
        }

        const activeApprovedPost = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                UserID: row.UserID,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return activeApprovedPost;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces actives :', error);
        return [];
    }
};

const collectOutdatedPostsByUserID = async (userID) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE user_id = $1
        AND status = 'approved'
        AND is_active = false
      `;

        const result = await db.query(query, [userID]);

        if (result.rows.length === 0) {
            console.log('Aucune annonce inactive trouvée pour cet utilisateur.');
            return [];
        }

        const inactiveApprovedAds = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return inactiveApprovedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces inactives :', error);
        return [];
    }
};

const collectPostsByCategoryName = async (categoryName) => {
    try {
        // Requête PostgreSQL équivalente à la requête Firestore
        const query = `
        SELECT *
        FROM posts
        WHERE category = $1
        AND status = 'approved'
        AND is_active = true
        ORDER BY moderated_at DESC
      `;

        const result = await db.pool.query(query, [categoryName]);

        if (result.rows.length === 0) {
            return [];
        }

        // Transformer les résultats pour maintenir la même structure que Firestore
        const ads = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
            const images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
            const location = typeof row.location === 'string' ? JSON.parse(row.location) : row.location;

            // Retourner un objet avec la même structure que dans Firestore
            return {
                id: row.id,
                userID: row.user_id,
                title: row.title || details?.title,
                description: row.description || details?.description,
                price: row.price || details?.price,
                category: row.category,
                subcategory: row.subcategory,
                location: location,
                status: row.status,
                isActive: row.is_active,
                moderated_at: row.moderated_at,
                posted_at: row.created_at,
                updated_at: row.updated_at,
                expiry_date: row.expiry_date,
                images: images,
                details: details
            };
        });

        return ads;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces:', error);
        return [];
    }
};

const collectRelatedPosts = async (post_id, category) => {
    try {
        const query = `
        SELECT *
        FROM posts
        WHERE status = 'approved'
        AND category = $1
        AND "postID" != $2
        LIMIT 12
      `;

        const result = await db.query(query, [category, post_id]);

        const relatedAds = result.rows.map(row => {
            // Convertir les champs JSON en objets JavaScript si nécessaire
            if (typeof row.stats === 'string') row.stats = JSON.parse(row.stats);
            if (typeof row.details === 'string') row.details = JSON.parse(row.details);
            if (typeof row.images === 'string') row.images = JSON.parse(row.images);
            if (typeof row.location === 'string') row.location = JSON.parse(row.location);

            // Convertir les noms de colonnes snake_case en camelCase pour maintenir la compatibilité
            return {
                id: row.id,
                postID: row.postID,
                userID: row.user_id,
                title: row.title,
                description: row.description,
                price: row.price,
                category: row.category,
                location: row.location,
                status: row.status,
                isActive: row.is_active,
                posted_at: row.posted_at,
                moderated_at: row.moderated_at,
                expiry_date: row.expiry_date,
                refusal_reason: row.refusal_reason,
                stats: row.stats,
                images: row.images,
                details: row.details
            };
        });

        return relatedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces liées:', error);
        return [];
    }
};

const updatePostByID = async (postID, updateData, userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si l'annonce existe et appartient à l'utilisateur
        const checkQuery = `
        SELECT * FROM posts 
        WHERE id = $1
      `;
        const checkResult = await client.query(checkQuery, [postID]);

        if (checkResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        const postData = checkResult.rows[0];

        if (postData.user_id !== userID) {
            console.error('Vous n\'êtes pas autorisé à modifier cette annonce.');
            await client.query('ROLLBACK');
            return false;
        }

        // Préparer les données à mettre à jour
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        // Ajouter les champs à mettre à jour
        for (const [key, value] of Object.entries(updateData)) {
            // Convertir les clés camelCase en snake_case pour PostgreSQL
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

            // Traiter les objets JSON
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                setClause.push(`${dbKey} = $${paramIndex}`);
                values.push(JSON.stringify(value));
            } else {
                setClause.push(`${dbKey} = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }

        // Ajouter le timestamp de mise à jour
        setClause.push(`updated_at = $${paramIndex}`);
        values.push(new Date());

        // Ajouter l'ID de l'annonce comme dernier paramètre
        values.push(postID);

        // Construire et exécuter la requête de mise à jour
        const updateQuery = `
        UPDATE posts 
        SET ${setClause.join(', ')} 
        WHERE id = $${paramIndex + 1}
      `;

        await client.query(updateQuery, values);
        await client.query('COMMIT');

        console.log('Annonce mise à jour avec succès.');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la mise à jour de l\'annonce:', error);
        return false;
    } finally {
        client.release();
    }
};

const deletePostByID = async (postID, userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si l'annonce existe et appartient à l'utilisateur
        const checkQuery = `
        SELECT * FROM posts 
        WHERE id = $1
      `;
        const checkResult = await client.query(checkQuery, [postID]);

        if (checkResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        const postData = checkResult.rows[0];

        if (postData.user_id !== userID) {
            console.error('Vous n\'êtes pas autorisé à supprimer cette annonce.');
            await client.query('ROLLBACK');
            return false;
        }

        // Supprimer les signalements associés à l'annonce
        const deleteReportsQuery = 'DELETE FROM reports WHERE post_id = $1';
        await client.query(deleteReportsQuery, [postID]);

        // Supprimer les favoris associés à l'annonce
        const deleteFavoritesQuery = 'DELETE FROM favorites WHERE post_id = $1';
        await client.query(deleteFavoritesQuery, [postID]);

        // Supprimer l'annonce
        const deletePostQuery = 'DELETE FROM posts WHERE id = $1';
        await client.query(deletePostQuery, [postID]);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la suppression de l\'annonce:', error);
        return false;
    } finally {
        client.release();
    }
};

const suspendPostByID = async (postID, reason) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si l'annonce existe
        const checkQuery = `
        SELECT id FROM posts 
        WHERE id = $1
      `;
        const checkResult = await client.query(checkQuery, [postID]);

        if (checkResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        // Suspendre l'annonce
        const updateQuery = `
        UPDATE posts 
        SET 
          is_active = false,
          status = 'suspended',
          suspended_at = $1,
          suspended_reason = $2
        WHERE id = $3
      `;

        await client.query(updateQuery, [
            new Date(),
            reason || 'Non spécifié',
            postID
        ]);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la suspension de l\'annonce:', error);
        return false;
    } finally {
        client.release();
    }
};

const markPostSold = async (userID, postID) => {
    console.log(postID);
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si l'annonce existe et appartient à l'utilisateur
        const checkQuery = `
        SELECT * FROM posts 
        WHERE id = $1
      `;
        const checkResult = await client.query(checkQuery, [postID]);

        if (checkResult.rows.length === 0) {
            console.error('Annonce non trouvée.');
            await client.query('ROLLBACK');
            return false;
        }

        const postData = checkResult.rows[0];

        if (postData.user_id !== userID) {
            console.error('Vous n\'êtes pas autorisé à marquer cette annonce comme vendue.');
            await client.query('ROLLBACK');
            return false;
        }

        // Marquer l'annonce comme vendue
        const updateQuery = `
        UPDATE posts 
        SET 
          is_sold = true,
          updated_at = $1
        WHERE id = $2
      `;

        await client.query(updateQuery, [new Date(), postID]);

        await client.query('COMMIT');
        console.log('Annonce marquée comme vendue');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.log('Erreur lors de la mise à jour de l\'annonce:', error);
        return false;
    } finally {
        client.release();
    }
};

module.exports = {
    makePost,
    reportPostID,
    validatePost,
    rejectPost,
    adminDeletePostByID,
    collectPosts,
    collectPendingPosts,
    collectApprovedPosts,
    collectRejectedPosts,
    collectDataFromPostID,
    collectPostByID,
    collectPostsByUserID,
    collectPendingPostsByUserID,
    collectApprovedPostsByUserID,
    collectRejectedPostsByUserID,
    collectActivePostsByUserID,
    collectOutdatedPostsByUserID,
    collectPostsByCategoryName,
    collectRelatedPosts,
    updatePostByID,
    deletePostByID,
    suspendPostByID,
    markPostSold
};