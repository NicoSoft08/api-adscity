const { admin, firestore, auth } = require("../config/firebase-admin");
const { sendUserAdsApprovedEmail, sendUserAdsRefusedEmail, sendEmailToAdmin } = require("../controllers/emailController");
const { monthNames, generateSlug, formatRelativeDate } = require("../func");
const { post } = require("../routes/apiRoutes");
const { saveLocation } = require("./firestore");
const { isPromotionActive } = require("./promotion");
const { deleteImagesByPostID } = require("./storage");

const makePost = async (postData, userID) => {
    try {
        // 1️⃣ Récupérer les données utilisateur
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.error("Utilisateur non trouvé");
            return false;
        }

        const userData = userDoc.data();
        const { isActive, plans, adsPostedThisMonth, UserID } = userData;
        const { location } = postData;

        // 2️⃣ Vérifier si l'utilisateur est actif
        if (!isActive) {
            console.error("Utilisateur inactif. Veuillez contacter le support.");
            return false;
        }

        // 3️⃣ Vérifier si une promotion est active
        const promotionActive = await isPromotionActive();
        let maxAdsPerMonth;

        if (promotionActive) {
            const promotionsRef = firestore.collection('PROMOTIONS').doc('launchOffer');
            const promotionDoc = await promotionsRef.get();

            if (promotionDoc.exists) {
                const promotionFeatures = promotionDoc.data().features;
                maxAdsPerMonth = promotionFeatures.maxAdsPerMonth || null;
            }
        }

        // 4️⃣ Gérer les limites du plan
        const userPlanKey = Object.keys(plans).find(planKey => plans[planKey]?.max_ads);
        const userPlan = plans[userPlanKey];

        if (!userPlan) {
            console.error("Plan utilisateur introuvable");
            return false;
        }

        const maxAdsFromPlan = userPlan.max_ads;
        const maxAds = maxAdsPerMonth || maxAdsFromPlan; // Priorité à la promotion

        // Vérifier si l'utilisateur a atteint la limite d'annonces
        if (adsPostedThisMonth >= maxAds) {
            console.error("Limite d'annonces mensuelles atteinte");
            return false;
        }

        // 6️⃣ Ajouter l'annonce dans Firestore
        const postRef = firestore.collection('POSTS')

        // 📌 Récupérer le dernier utilisateur créé (trié par userID)
        const lastPostSnapshot = await postRef.orderBy('PostID', 'desc').limit(1).get();
        let lastPostID = "POST000";
        if (!lastPostSnapshot.empty) {
            lastPostID = lastPostSnapshot.docs[0].data().PostID;
        }

        // 📌 Extraire le numéro et incrémenter
        const lastNumber = parseInt(lastPostID.replace("POST", ""), 10);
        const newNumber = lastNumber + 1;
        const newPostID = `POST${String(newNumber).padStart(3, "0")}`; // Format PUB001, PUB002
        const newPostRef = postRef.doc();

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

        await newPostRef.set({
            userID: userID,
            UserID: UserID,
            ...postData,
            expiry_date: null,
            stats, // Ajout des statistiques
            interactedUsers: [],
            contact_clicks: 0,
            favorites: 0,
            shares: 0,
            comments: 0,
            postID: newPostRef.id,
            PostID: newPostID,
            posted_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: null,
            isActive: false,
            isSold: false,
            status: 'pending',
            refusal_reason: null,
            conversion_rate: 0,
            engagement_rate: 0,
            report_reason: null,
            reported: false,
            slug: generateSlug(postData?.details.title),
            type: 'regular',
        });

        // 7️⃣ Gérer le compteur d'annonces mensuelles
        const currentMonthName = monthNames[new Date().getMonth()];

        if (userData.currentMonth !== currentMonthName) {
            // Nouveau mois : Réinitialiser le compteur mensuel
            await userRef.update({
                adsPostedThisMonth: 1,
                currentMonth: currentMonthName,
                adsCount: admin.firestore.FieldValue.increment(1),
            });
        } else {
            // Même mois : Incrémenter les compteurs
            await userRef.update({
                adsPostedThisMonth: admin.firestore.FieldValue.increment(1),
                adsCount: admin.firestore.FieldValue.increment(1),
            });
        }

        // 8️⃣ Sauvegarder la localisation (si applicable)
        if (location && location.country && location.city) {
            await saveLocation(location.country, location.city);
        }

        // 📢 9️⃣ Envoyer une notification à l'admin
        const adminNotificationRef = firestore.collection('ADMIN_NOTIFICATIONS').doc();
        await adminNotificationRef.set({
            type: 'new_post',
            title: 'Nouvelle annonce en attente',
            message: `Nouvelle annonce en attente de validation: ${postData?.details.title}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            link: `/admin/dashboard/posts/${newPostID}`, // Lien vers l'annonce dans le tableau de bord
        });

        // 📧 🔔  🔹 Envoi d'un email à l'admin
        sendEmailToAdmin(postData, newPostID);

        console.log('Annonce créée avec succès', postRef.id);
        return true;
    } catch (error) {
        console.error("Erreur lors de la création de l'annonce :", error);
        return false;
    }
};

const reportPostID = async (postID, userID, reason) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const userRef = firestore.collection('USERS').doc(userID);

        // Vérification si l'utilisateur et l'annonce existent
        const [userDoc, postDoc] = await Promise.all([userRef.get(), postRef.get()]);
        if (!userDoc.exists || !postDoc.exists) {
            console.log('Utilisateur ou annonce non trouvé');
            return false;
        }

        const userData = userDoc.data();
        const { city } = userData;

        const postData = postDoc.data();
        const { stats } = postData;

        const reportByCity = stats.report_per_city || {};
        const reportHistory = Array.isArray(stats.report_history) ? stats.report_history : [];

        // Vérifier si l'utilisateur a déjà signalé ce post
        const existingReportQuery = await firestore
            .collection('REPORTS')
            .where('postID', '==', postID)
            .where('userID', '==', userID)
            .get();

        if (!existingReportQuery.empty) {
            console.log('Signalement déjà enregistré');
            return false;
        }

        // Vérifier si l'utilisateur n'a pas signalé trop d'annonces en 24h
        const recentReportsQuery = await firestore
            .collection('REPORTS')
            .where('userID', '==', userID)
            .where('reported_at', '>=', admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000))
            .get();

        if (recentReportsQuery.size >= 5) {
            console.log('Utilisateur a atteint la limite de signalements');
            return false;
        }

        // Ajouter le signalement
        await firestore.collection('REPORTS').add({
            postID,
            userID,
            reason,
            city,
            reported_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Incrémenter le nombre de signalements sur l'annonce
        await postRef.update({
            'stats.reportingCount': admin.firestore.FieldValue.increment(1),
        });

        if (city) {
            reportByCity[city] = (reportByCity[city] || 0) + 1;
        }

        reportHistory.push(Date.now());

        const now = Date.now();
        const updatedHistory = reportHistory.filter(timestamp => now - timestamp <= 30 * 24 * 60 * 60 * 1000);

        // 🔹 Mettre à jour Firestore (POSTS)
        await postRef.update({
            'stats.report_per_city': reportByCity,
            'stats.report_history': updatedHistory,
        });

        return true;
    } catch (error) {
        console.error('Erreur lors du signalement de l\'annonce:', error);
        return false;
    };
};

const validatePost = async (postID) => {
    try {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        await firestore.collection('POSTS').doc(postID).update({
            status: 'approved',
            isActive: true,
            moderated_at: admin.firestore.FieldValue.serverTimestamp(),
            expiry_date: expiryDate.toISOString(),
        });

        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        }

        const postData = postDoc.data();
        const { details: { title }, posted_at, userID } = postData;

        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.error('Utilisateur non trouvé.');
            return false;
        }

        const { displayName, email } = userDoc.data();

        // Enregistrer la notification pour l'utilisateur
        const notification = {
            type: 'ad_approval',
            title: 'Annonce approuvée',
            message: `Votre annonce "${title}" a été approuvée.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            link: `/posts/post/${postID}`, // Lien vers l'annonce dans le tableau de bord
        };

        await userRef.collection('NOTIFICATIONS').add(notification);

        await sendUserAdsApprovedEmail(displayName, email, title, posted_at);

        console.log('Annonce approuvée avec succès et expire le :', expiryDate)
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'approbation de l\'annonce :', error);
        return false;
    }
};

const rejectPost = async (postID, reason) => {
    try {
        await firestore.collection('POSTS').doc(postID).update({
            status: 'refused',
            refusal_reason: reason,
            moderated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        }

        const postData = postDoc.data();
        const { details: { title }, posted_at, userID } = postData;


        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.error('Utilisateur non trouvé.');
            return false;
        }

        const { displayName, email } = userDoc.data();

        // Enregistrer la notification pour l'utilisateur
        const notification = {
            type: 'ad_refusal',
            title: 'Annonce refusée',
            message: `Votre annonce "${title}" a été refusée, au regard du motif suivant: ${reason}.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            link: null, // Lien vers l'annonce dans le tableau de bord
        };

        await userRef.collection('NOTIFICATIONS').add(notification);

        // Envoi de l'email de notification à l'utilisateur
        await sendUserAdsRefusedEmail(displayName, email, title, posted_at, reason);
        console.log('Annonce refusée avec succès')
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'approbation de l\'annonce :', error);
        return false;
    }
};

const adminDeletePostByID = async (postID) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        }

        await deleteImagesByPostID(postID);

        await postRef.delete();
        console.log('Annonce supprimée avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'annonce :', error);
        return false;
    }
};

const collectPosts = async () => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('POSTS');

        const querySnapshot = await adsCollection.get();

        const ads = [];
        const pendingAds = [];
        const approvedAds = [];
        const refusedAds = [];

        querySnapshot.forEach(doc => {
            const ad = { id: doc.id, ...doc.data() };

            ads.push(ad);
            if (ad.status === 'pending') pendingAds.push(ad);
            if (ad.status === 'approved') approvedAds.push(ad);
            if (ad.status === 'refused') refusedAds.push(ad);
        });

        return {
            allAds: ads,
            pendingAds,
            approvedAds,
            refusedAds
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces:', error);
        return [];
    }
};

const collectPendingPosts = async () => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('POSTS');
        const querySnapshot = await adsCollection
            .where('status', '==', 'pending')
            .get();

        const pendingAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return pendingAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces en attente:', error);
        return [];
    }
};

const collectApprovedPosts = async () => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('POSTS');
        const querySnapshot = await adsCollection
            .where('status', '==', 'approved')
            .orderBy('moderated_at', 'desc') // Orders from newest to oldest
            .get();

        const approvedAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return approvedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces approuvées:', error);
        return false;
    }
};

const collectRejectedPosts = async () => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('POSTS');
        const querySnapshot = await adsCollection
            .where('status', '==', 'refused')
            .get();

        const refusedAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return refusedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces refusées:', error);
        return [];
    };
};

const collectPostBySlug = async (category, subcategory, slug) => {
    try {
        const postRef = firestore.collection('POSTS');
        const query = await postRef
            .where('category', '==', category)
            .where('slug', '==', slug)
            .where('status', '==', 'approved')
            .where('subcategory', '==', subcategory)
            .get();

        if (query.empty) {
            return false;
        };
        const postData = query.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        return postData;
    } catch (error) {
        console.error(`Erreur lors de la récupération de l\'annonce avec ${slug}:`, error);
        return false;
    };
};

const collectDataFromPostID = async (post_id) => {
    try {
        const PostID = post_id?.toUpperCase();
        const postRef = firestore.collection('POSTS');
        const postSnap = await postRef
            .where('PostID', '==', PostID)
            .limit(1)
            .get();

        if (postSnap.empty) {
            console.log('Aucune annonce trouvée avec cet ID.');
            return null;
        }

        const postData = postSnap.docs[0].data();
        return postData;
    } catch (error) {
        console.error(`Erreur lors de la récupération de l\'annonce avec ${post_id}:`, error);
        throw error;
    }
};

const collectPostByID = async (postID) => {
    try {
        const adDoc = await firestore.collection('POSTS').doc(postID).get();

        if (!adDoc.exists) {
            return false;
        }

        const adData = adDoc.data();
        if (adData.status !== 'approved') {
            return false;
        }

        return adData;
    } catch (error) {
        console.error(`Erreur lors de la récupération de l\'annonce avec ${postID}:`, error);
        return false;
    };
};

const collectPostsByUserID = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const userAdsQuery = adsCollection.where('userID', '==', userID);
        const querySnapshot = await userAdsQuery.get();

        if (querySnapshot.empty) {
            console.log('Aucune annonce trouvée pour cet utilisateur.');
            return [];
        }

        const ads = [];
        const pendingAds = [];
        const approvedAds = [];
        const refusedAds = [];

        querySnapshot.forEach(doc => {
            const ad = { id: doc.id, ...doc.data() };

            ads.push(ad);
            if (ad.status === 'pending') pendingAds.push(ad);
            if (ad.status === 'approved') approvedAds.push(ad);
            if (ad.status === 'refused') refusedAds.push(ad);
        });

        return {
            allAds: ads,
            pendingAds,
            approvedAds,
            refusedAds
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces de l\'utilisateur:', error);
        return [];
    };
};

const collectPendingPostsByUserID = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const pendingAdsQuery = adsCollection
            .where('userID', '==', userID) // Filtrer par l'ID de l'utilisateur
            .where('status', '==', 'pending'); // Filtrer par le statut "pending"

        const querySnapshot = await pendingAdsQuery.get();
        if (querySnapshot.empty) {
            return [];
        }

        const pendingAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return pendingAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces en attente:', error);
        return [];
    };
};

const collectApprovedPostsByUserID = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const approvedAdsQuery = adsCollection
            .where('userID', '==', userID) // Filtrer par l'ID de l'utilisateur
            .where('status', '==', 'approved'); // Filtrer par le statut "pending"

        const querySnapshot = await approvedAdsQuery.get();
        if (querySnapshot.empty) {
            return [];
        }

        const approvedAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return approvedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces approuvées:', error);
        return [];
    };
};

const collectRejectedPostsByUserID = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const refusedAdsQuery = adsCollection
            .where('userID', '==', userID) // Filtrer par l'ID de l'utilisateur
            .where('status', '==', 'refused'); // Filtrer par le statut "pending"

        const querySnapshot = await refusedAdsQuery.get();
        if (querySnapshot.empty) {
            return [];
        }

        const refusedAds = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return refusedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces refusées:', error);
        return [];
    };
};

const collectActivePostsByUserID = async (UserID) => {
    console.log(UserID)
    try {
        const user_id = UserID?.toUpperCase();
        // const userRecord = auth
        const adsCollection = firestore.collection('POSTS');
        const userPostsQuery = adsCollection
            // .where('isActive', '==', true)
            .where('status', '==', 'approved')
            .where('UserID', '==', user_id)
        const querySnapshot = await userPostsQuery.get();

        if (querySnapshot.empty) {
            console.log('Aucune annonce active trouvée pour cet utilisateur.');
            return [];
        }

        const activeApprovedPost = [];
        querySnapshot.forEach(doc => {
            const postData = doc.data();
            activeApprovedPost.push({
                id: doc.id,
                ...postData
            });
        });

        return activeApprovedPost;

        // return activeApprovedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces actives :', error);
        return [];
    };
};

const collectOutdatedPostsByUserID = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const userAdsQuery = adsCollection
            .where('userID', '==', userID)
            .where('status', '==', 'approved')
            .where('isActive', '==', false)
        const querySnapshot = await userAdsQuery.get();

        if (querySnapshot.empty) {
            console.log('Aucune annonce inactive trouvée pour cet utilisateur.');
            return [];
        }

        const inactiveApprovedAds = [];
        querySnapshot.forEach(doc => {
            inactiveApprovedAds.push({ id: doc.id, ...doc.data() });
        });

        return inactiveApprovedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces inactives :', error);
        return [];
    };
};

const collectPostsByCategoryName = async (categoryName) => {
    try {
        const adsSnapshot = firestore.collection('POSTS')
            .where('category', '==', categoryName) // Filtrer par catégorie
            .where('status', '==', 'approved') // Optionnel : ajouter une condition pour ne récupérer que les annonces approuvées
            .where('isActive', '==', true)
            .orderBy('moderated_at', 'desc'); // Orders from newest to oldest


        const adsSnapshotDoc = await adsSnapshot.get();

        if (adsSnapshotDoc.empty) {
            return [];
        }

        const ads = [];
        adsSnapshotDoc.forEach(doc => {
            ads.push({ id: doc.id, ...doc.data() })
        })

        return ads;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces:', error);
        return [];
    };
};

const collectRelatedPosts = async (post_id, category) => {
    const adsCollection = firestore.collection('POSTS');
    const relatedAdsQuery = adsCollection
        .where('status', '==', 'approved')
        .where('category', '==', category)
        .limit(12);

    const querySnapshot = await relatedAdsQuery.get();
    const relatedAds = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ad => ad.postID !== post_id);

    return relatedAds;
};

const updatePostByID = async (postID, updateData, userID) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        };

        const postData = postDoc.data();
        if (postData.userID !== userID) {
            console.error('Vous n\'êtes pas autorisé à modifier cette annonce.');
            return false;
        };

        await postRef.update({
            ...updateData,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Annonce mise à jour avec succès.');
        return true;
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'annonce:', error);
        return false;
    };
};

const deletePostByID = async (postID, userID) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        };

        const postData = postDoc.data();
        if (postData.userID !== userID) {
            console.error('Vous n\'êtes pas autorisé à supprimer cette annonce.');
            return false;
        };

        await postRef.delete();
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'annonce:', error);
        return false;
    };
};

const suspendPostByID = async (postID, reason) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        };

        await postRef.update({
            isActive: false,
            status: 'suspended',
            suspended_at: admin.firestore.FieldValue.serverTimestamp(),
            suspended_reason: reason || 'Non spécifié',
        });

        return true;
    } catch (error) {
        console.error('Erreur lors de la suspension de l\'annonce:', error);
        return false;
    };
};

const markPostSold = async (userID, postID) => {
    console.log(postID);
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        };

        const postData = postDoc.data();
        if (postData.userID !== userID) {
            console.error('Vous n\'êtes pas autorisé à marquer cette annonce comme vendue.');
            return false;
        };
        await postRef.update({
            isSold: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Annonce marquée comme vendue');
        return true;
    } catch (error) {
        console.log('Erreur lors de la mise à jor de l\'annonce:', error);
        return false;
    }
};

const fetchNearbyPostsByLocation = async (country, city) => {
    try {
        const postsCollection = firestore.collection('POSTS');
        const query = postsCollection
            .where('status', '==', 'approved')
            .where('location.country', '==', country)
            .where('location.city', '==', city)
            .orderBy('posted_at', 'desc');

        const querySnapshot = await query.get();

        if (querySnapshot.empty) {
            console.warn('⚠️ Aucune annonce trouvée pour cette localisation.');
            return [];
        }

        const posts = [];
        querySnapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        return posts;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces par proximité:', error);
        return [];
    }
};

const repostPost = async (userID, postID, postData) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.error('Annonce non trouvée.');
            return false;
        };
        const data = postDoc.data();
        if (data.userID !== userID) {
            console.error('Vous n\'êtes pas autorisé à répposter cette annonce.');
            return false;
        }

        const repostedAt = new Date();
        const expiryDate = new Date(repostedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 jours
        const newPostData = {
            ...postData,
            reposted_at: repostedAt,
            expiry_date: expiryDate,
        };

        await postRef.update(newPostData);
        console.log('Annonce répposter avec succès.');
        return true;
    } catch (error) {
        console.error('Erreur lors de la répposte de l\'annonce:', error);
        return false;
    }
}

module.exports = {
    adminDeletePostByID,
    collectActivePostsByUserID,
    collectApprovedPosts,
    collectApprovedPostsByUserID,
    collectPendingPosts,
    collectPendingPostsByUserID,
    collectPostsByCategoryName,
    collectPostByID,
    collectPostBySlug,
    collectPostsByUserID,
    collectPosts,
    collectOutdatedPostsByUserID,
    collectRejectedPostsByUserID,
    collectRejectedPosts,
    collectRelatedPosts,
    deletePostByID,
    fetchNearbyPostsByLocation,
    makePost,
    markPostSold,
    rejectPost,
    validatePost,
    reportPostID,
    suspendPostByID,
    updatePostByID,
    collectDataFromPostID,
    repostPost,
};