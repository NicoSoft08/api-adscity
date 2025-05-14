const { auth, firestore, admin } = require("../config/firebase-admin");

const fetchMyData = async (userID) => {
    try {
        const userDoc = await firestore.collection('USERS').doc(userID).get();
        if (!userDoc.exists) {
            return false;
        }
        return userDoc.data();
    } catch (error) {
        console.error("Erreur lors de la récupération des données de l'utilisateur", error);
        return false;
    }
};

const getUsersData = async () => {
    try {
        const adsCollection = firestore.collection('USERS').orderBy('createdAt', 'desc');

        const querySnapshot = await adsCollection.get();

        if (querySnapshot.empty) {
            return [];
        };

        const users = [];
        const onlineUsers = [];
        const offlineUsers = [];

        querySnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            users.push(user);
            if (user.isOnline === true) onlineUsers.push(user);
            if (user.isOnline === false) offlineUsers.push(user);
        });

        return {
            allUsers: users,
            onlineUsers,
            offlineUsers
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    }
};

const fetchUserLocations = async () => {
    try {
        const usersCollection = firestore.collection('USERS');
        const querySnapshot = await usersCollection.get();
        let cityCounts = {};

        querySnapshot.forEach(doc => {
            const userData = doc.data();
            const city = userData.city || 'Inconnu';
            if (cityCounts[city]) {
                cityCounts[city]++;
            } else {
                cityCounts[city] = 1;
            }
        });
        return Object.entries(cityCounts).map(([city, count]) => ({ city, count }));
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    }
}

const getUser = async (userID) => {
    try {
        const userRecord = await auth.getUser(userID);
        const userRef = firestore.collection('USERS').doc(userRecord.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return null;
        }

        const userData = userDoc.data();
        return userData;
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    }
};

const collectUserData = async (user_id) => {
    const UserID = user_id?.toUpperCase();
    try {
        const userRef = firestore.collection('USERS');
        const userSnap = await userRef
            .where('UserID', '==', UserID)
            .limit(1)
            .get();

        if (userSnap.empty) {
            return null;
        };
        const userData = userSnap.docs[0].data();
        return userData;
    } catch (error) {
        console.error('Erreur lors de la récupération des données utilisateur :', error);
        throw error;
    };
};

const collectAllUsersWithStatus = async () => {
    try {
        const usersSnapshot = await firestore.collection('USERS').get();
        const allUsers = [];
        const onlineUsers = [];
        const offlineUsers = [];

        usersSnapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            allUsers.push(user);

            if (user.isOnline) onlineUsers.push(user);
            else offlineUsers.push(user);
        });

        return { allUsers, onlineUsers, offlineUsers };
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    }
};

const collectUserPermissions = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log(`Utilisateur ${userID} introuvable.`);
            return;
        };

        const userData = userDoc.data();
        const permissions = userData.permissions || [];
        return permissions;
    } catch (error) {
        console.error('Erreur lors de la récupération des permissions de l\'utilisateur :', error);
        throw error;
    }
};

const setUserOnlineStatus = async (userID, isOnline) => {
    try {
        await firestore
            .collection('USERS')
            .doc(userID)
            .update({
                isOnline: isOnline,
                lastOnline: admin.firestore.FieldValue.serverTimestamp()
            });
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'état en ligne :", error);
        return false;
    }
};

const updateUserFields = async (userID, field) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        await userRef.update({
            ...field,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour des champs de l'utilisateur :", error);
        return false;
    }
};

const updateUserInteraction = async (userID, adID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        }

        const userData = userDoc.data();
        const adsClicked = userData.adsClicked || [];

        // Si l'utilisateur a déjà cliqué sur cette annonce, ne pas mettre à jour les compteurs
        if (adsClicked.includes(adID)) {
            console.log("L'utilisateur a déjà cliqué sur cette annonce");
            return false;
        }

        // Mise à jour des interactions
        await userRef.update({
            clicksOnAds: admin.firestore.FieldValue.increment(1),
            totalAdsViewed: admin.firestore.FieldValue.increment(1),
            adsClicked: admin.firestore.FieldValue.arrayUnion(adID) // Ajouter l'ID de l'annonce
        });

        console.log("Interaction de l'utilisateur mise à jour");
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour des interactions utilisateur", error);
        return false;
    }
};

const addRemoveFavorites = async (postID, userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const postRef = firestore.collection('POSTS').doc(postID);

        const [userDoc, postDoc] = await Promise.all([userRef.get(), postRef.get()]);

        if (!userDoc.exists || !postDoc.exists) {
            console.log("Utilisateur ou annonce non trouvé");
            return false;
        };

        const isFavorite = (postDoc.data().favoritedBy || []).includes(userID);

        if (isFavorite) {
            await Promise.all([
                postRef.update({
                    favoritedBy: admin.firestore.FieldValue.arrayRemove(userID),
                    favorites: admin.firestore.FieldValue.increment(-1)
                }),
                userRef.update({
                    adsSaved: admin.firestore.FieldValue.arrayRemove(postID)
                })
            ]);
            console.log("Annonce retirée des favoris");
        } else {
            await Promise.all([
                postRef.update({
                    favoritedBy: admin.firestore.FieldValue.arrayUnion(userID),
                    favorites: admin.firestore.FieldValue.increment(1)
                }),
                userRef.update({
                    adsSaved: admin.firestore.FieldValue.arrayUnion(postID)
                })
            ]);
            console.log("Annonce ajoutée aux favoris");
        }
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour des favoris de l'utilisateur", error);
        return false;
    };
};

const collectUserFavorites = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const userData = userDoc.data();
        const postsSaved = userData.adsSaved || [];

        if (postsSaved.length === 0) {
            console.log("Aucune annonce enregistrée.");
            return [];
        }

        // Récupérer les annonces à partir des IDs stockés
        const postsCollection = firestore.collection('POSTS');
        const favoritesQuery = await postsCollection
            .where(admin.firestore.FieldPath.documentId(), 'in', postsSaved)
            .get();

        if (favoritesQuery.empty) {
            console.log("Aucune annonce trouvée.");
            return [];
        }

        const favoritePosts = [];
        favoritesQuery.forEach(doc => {
            favoritePosts.push({ id: doc.id, ...doc.data() });
        });

        return favoritePosts;
    } catch (error) {
        console.error("Erreur lors de la récupération des favoris de l'utilisateur", error);
        return false;
    };
};

const collectAdminNotifications = async () => {
    try {
        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS').orderBy('timestamp', 'desc');
        const snapshot = await notificationRef.get();

        if (snapshot.empty) {
            console.log("Aucune notification trouvée.");
            return [];
        }
        const notifs = [];
        const unReadNotifs = [];

        snapshot.docs.forEach(doc => {
            const notification = { id: doc.id, ...doc.data() };
            notifs.push(notification);

            if (notification.isRead === false) unReadNotifs.push(notification);
        });

        return {
            notifications: notifs,
            unReadNotifs
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications", error);
        return [];
    }
};

const collectUserNotifications = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };
        const notifs = [];
        const unReadNotifs = [];

        const notificationRef = userRef.collection('NOTIFICATIONS').orderBy('timestamp', 'desc');
        const snapshot = await notificationRef.get();
        snapshot.docs.map(doc => {
            const notification = { id: doc.id, ...doc.data() };
            notifs.push(notification);
            if (notification.isRead === false) unReadNotifs.push(notification);
        });
        return {
            notifications: notifs,
            unReadNotifs
        };
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications de l'utilisateur", error);
        return false;
    };
};

const collectUserUnreadNotifications = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = userRef.collection('NOTIFICATIONS').where('isRead', '==', false);
        const snapshot = await notificationRef.get();
        const unreadNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return unreadNotifications;
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications non lues de l'utilisateur", error);
        return false;
    }
};

const markAdminNotificationAsRead = async (userID, notificationID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        }

        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS').doc(notificationID);
        const notificationDoc = await notificationRef.get();
        if (!notificationDoc.exists) {
            console.error("Notification non trouvée");
            return false;
        }
        const notificationData = notificationDoc.data();
        if (notificationData.isRead) {
            console.log("La notification est déjà marquée comme lue");
            return true;
        }
        await notificationRef.update({ isRead: true });
        console.log("Notification marquée comme lue avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la notification", error);
        return false;
    }
};

const markNotificationAsRead = async (userID, notificationID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = userRef.collection('NOTIFICATIONS').doc(notificationID);
        const notificationDoc = await notificationRef.get();
        if (!notificationDoc.exists) {
            console.error("Notification non trouvée");
            return false;
        };

        console.log("Notification marquée comme lue avec succès !");
        await notificationRef.update({ isRead: true });
        return true;
    } catch (error) {
        console.error("Erreur lors de la lecture de la notification de l'utilisateur", error);
        return false;
    };
};

const markAllNotificationsAsRead = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = userRef.collection('NOTIFICATIONS');
        const snapshot = await notificationRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
        console.log("Toutes les notifications ont été marquées comme lues avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la lecture de toutes les notifications de l'utilisateur", error);
        return false;
    }
};

const markAllAdminNotificationsAsRead = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        }
        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS');
        const snapshot = await notificationRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
        console.log("Toutes les notifications ont été marquées comme lues avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour des notifications de l'utilisateur", error);
        return false;
    }
};

const clearAdminNotification = async (userID, notificationID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS').doc(notificationID);
        const notificationDoc = await notificationRef.get();
        if (!notificationDoc.exists) {
            console.error("Notification non trouvée");
            return false;
        }
        await notificationRef.delete();
        console.log("Notification supprimée avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression de la notification", error);
        return false;
    }
};

const clearUserNotification = async (userID, notificationID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = userRef.collection('NOTIFICATIONS').doc(notificationID);
        const notificationDoc = await notificationRef.get();
        if (!notificationDoc.exists) {
            console.error("Notification non trouvée");
            return false;
        };

        await notificationRef.delete();
        console.log("Notification supprimée avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression de la notification de l'utilisateur", error);
        return false;
    }
};


const clearAllAdminNotifications = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS');
        const snapshot = await notificationRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("Toutes les notifications ont été supprimées avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les notifications", error);
        return false;
    }
};

const clearUserAllNotifications = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        };

        const notificationRef = userRef.collection('NOTIFICATIONS');
        const snapshot = await notificationRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("Toutes les notifications ont été supprimées avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur", error);
        return false;
    }
};

const clearAdminAllNotifications = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé");
            return false;
        }

        const notificationRef = firestore.collection('ADMIN_NOTIFICATIONS');
        const snapshot = await notificationRef.get();
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("Toutes les notifications ont été supprimées avec succès !");
        return true;
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur", error);
        return false;
    }
};

const storeDeviceToken = async (deviceToken, userID) => {
    try {
        console.log("✅ Début de la fonction storeDeviceToken");
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé dans Firestore.");
            return false;
        }

        await userRef.update({ deviceToken: deviceToken });
        console.log("✅ Token de l'utilisateur mis à jour avec succès !");
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour du token :", error);
        return false;
    };
};

const collectInterlocutorProfile = async (userID) => {
    try {
        // 📌 Déterminer l'interlocuteur (l'autre utilisateur dans la conversation)
        const interlocutorID = chat.senderID === userID ? chat.receiverID : chat.senderID;

        // 🔍 Récupérer les infos du profil depuis Firestore
        const userDoc = await firestore.collection('USERS').doc(interlocutorID).get();
        if (!userDoc.exists) {
            console.error(`❌ Profil de l'interlocuteur introuvable pour l'ID : ${interlocutorID}`);
            return null;
        }

        // 📦 Retourner les données du profil de l'interlocuteur
        const userData = userDoc.data();
        return userData
    } catch (error) {
        console.error("❌ Erreur lors de la récupération du profil de l'interlocuteur :", error);
        return null;
    }
};

const searchHistoryUpdate = async (userID, query) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log("Utilisateur non trouvé.");
            return null;
        }

        const userData = userDoc.data();
        let searchHistory = userData.searchHistory || [];

        // Vérifier si la recherche existe déjà
        if (!searchHistory.includes(query)) {
            // Ajouter la nouvelle recherche au début du tableau
            searchHistory.unshift(query);
            // Limiter à 10 recherches stockées
            searchHistory = searchHistory.slice(0, 10);

            // Mettre à jour l'historique dans Firestore
            await userRef.update({ searchHistory });
        }

        console.log("Historique mis à jour.");
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour de l'historique de recherche:", error);
        return null;
    }
};

const collectAnyUserData = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return null;
        }

        const userData = userDoc.data();
        return userData;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données utilisateur :", error);
        return null;
    }
};

const collectUserLoginActivity = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return null;
        }

        const loginRef = userRef.collection('LOGIN_ACTIVITY');
        const loginQuery = await loginRef.orderBy('time', 'desc').get();
        const loginData = loginQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return loginData;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données de connexion utilisateur :", error);
        return null;
    }
};

const collectUserIDLoginActivity = async (UserID) => {
    const user_id = UserID?.toUpperCase();
    try {
        const userSnapshot = await firestore.collection('USERS').where('UserID', '==', user_id).limit(1).get();
        if (userSnapshot.empty) {
            console.log("❌ Aucun utilisateur trouvé avec l'UserID spécifié.");
            return null;
        }
        const userDoc = userSnapshot.docs[0];
        const userID = userDoc.id;

        const loginRef = firestore.collection('USERS').doc(userID).collection('LOGIN_ACTIVITY');
        const loginQuery = await loginRef.orderBy('time', 'desc').get();
        const loginData = loginQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return loginData
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données de connexion utilisateur :", error);
        return null;
    }
};

const collectUserVerificationData = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return null;
        }

        const verificationDocRef = userRef.collection('VERIFICATION_ID');
        const verificationQuery = await verificationDocRef.get();
        const verificationData = verificationQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return verificationData;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données de vérification utilisateur :", error);
        return null;
    }
};

const updateUserVerificationStatus = async (userID, updateData) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return null;
        }

        await userRef.update({
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const notificationRef = userRef.collection('NOTIFICATIONS');
        const notificationData = {
            type: 'verification_status',
            title: updateData.verificationStatus === 'approved'
                ? "Vérification approuvée"
                : "Vérification rejetée",
            message: updateData.verificationStatus === 'approved'
                ? "Votre vérification d'identité a été approuvée."
                : `Votre vérification d'identité a été rejetée. Motif: ${updateData.rejectionReason}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false
        }

        await notificationRef.add(notificationData);
        console.log(`✅ Notification de ${updateData.verificationStatus} envoyée à l'utilisateur ${userID}`);

        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des données de vérification utilisateur :", error);
        return null;
    }
};

module.exports = {
    fetchMyData,
    
    addRemoveFavorites,
    collectAnyUserData,
    collectInterlocutorProfile,
    collectUserLoginActivity,
    collectUserIDLoginActivity,
    collectUserFavorites,
    getUser,
    getUsersData,
    collectUserData,
    collectAllUsersWithStatus,
    collectUserVerificationData,

    fetchUserLocations,

    collectAdminNotifications,
    collectUserNotifications,

    clearUserAllNotifications,
    clearAllAdminNotifications,
    clearAdminAllNotifications,

    collectUserUnreadNotifications,
    collectUserPermissions,

    markNotificationAsRead,
    markAdminNotificationAsRead,

    markAllNotificationsAsRead,
    markAllAdminNotificationsAsRead,
    markAllAdminNotificationsAsRead,

    clearUserNotification,
    clearAdminNotification,

    setUserOnlineStatus,
    storeDeviceToken,
    updateUserFields,
    updateUserInteraction,
    searchHistoryUpdate,

    updateUserVerificationStatus,
};