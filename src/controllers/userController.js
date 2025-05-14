const { firestore, messaging } = require("../config/firebase-admin");
// const { fetchMyData } = require("../database/user");
const {
    getUser,
    setUserOnlineStatus,
    collectUserPermissions,
    updateUserFields,
    addRemoveFavorites,
    collectUserFavorites,
    collectUserNotifications,
    markNotificationAsRead,
    storeDeviceToken,
    collectAllUsersWithStatus,
    collectInterlocutorProfile,
    collectUserUnreadNotifications,
    collectUserData,
    searchHistoryUpdate,
    collectAnyUserData,
    collectUserLoginActivity,
    markAllNotificationsAsRead,
    clearUserNotification,
    clearUserAllNotifications,
    getUsersData,
    collectAdminNotifications,
    markAdminNotificationAsRead,
    markAllAdminNotificationsAsRead,
    clearAdminNotification,
    clearAdminAllNotifications,
    collectUserIDLoginActivity,
    fetchUserLocations,
    collectUserVerificationData,
    updateUserVerificationStatus,
    fetchMyData
} = require("../firebase/user");


const fetchMe = async (req, res) => {
    const user = req.user;
    const userID = user.uid;

    try {
        const data = await fetchMyData(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucune donnée de l'utilisateur trouvée"
            })
        }
        res.status(200).json({
            success: true,
            message: "Données de l'utilisateur récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plustard"
        });
    }
}

const getAllUsersWithStatus = async (req, res) => {
    try {
        const { allUsers, onlineUsers, offlineUsers } = await collectAllUsersWithStatus();
        res.status(200).json({
            success: true,
            message: "Utilisateurs récupérés avec succès",
            allUsers: allUsers,
            onlineUsers: onlineUsers,
            offlineUsers: offlineUsers
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs avec status:", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const getUsers = async (req, res) => {
    try {
        const users = await getUsersData();
        if (!users) {
            return res.status(404).json({
                success: false,
                message: "Aucun utilisateur trouvé"
            });
        };
        res.status(200).json({
            success: true,
            message: "Données des utilisateurs récupérées avec succès",
            users: users,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données utilisateur"
        });
    }
};

const getUserLocations = async (req, res) => {
    try {
        const locations = await fetchUserLocations();
        if (!locations) {
            return res.status(404).json({
                success: false,
                message: "Aucune localisation trouvée"
            });
        }
        res.status(200).json({
            success: true,
            message: "Données de localisation des utilisateurs récupérées avec succès",
            locations: locations
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données de localisation des utilisateurs :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données de localisation des utilisateurs"
        });
    }
}

const getDataFromUserID = async (req, res) => {
    const { user_id } = req.params;

    try {
        const data = await collectUserData(user_id);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucun utilisateur trouvé"
            });
        }
        res.status(200).json({
            success: true,
            message: "Données de l'utilisateur récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données utilisateur"
        });
    };
}

const getAnyUserData = async (req, res) => {

    console.log(userID)

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur manquant"
        });
    };

    try {
        const data = await collectAnyUserData(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé"
            });
        };
        res.status(200).json({
            success: true,
            message: "Données de l'utilisateur récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard",
        });
    }
};

const getUserData = async (req, res) => {
    const { userID } = req.params;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur manquant"
        });
    };

    try {
        const data = await getUser(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé"
            });
        };
        res.status(200).json({
            success: true,
            message: "Données de l'utilisateur récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données utilisateur"
        });
    }
};

const setUserOnline = async (req, res) => {
    const { userID, isOnline } = req.body;

    if (!userID || isOnline === undefined) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur ou statut en ligne manquant"
        });
    };

    try {
        const isOnlineUpdated = await setUserOnlineStatus(userID, isOnline);
        if (!isOnlineUpdated) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé"
            });
        };
        res.status(200).json({
            success: true,
            message: "Statut en ligne de l'utilisateur mis à jour avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du statut en ligne de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la mise à jour du statut en ligne de l'utilisateur"
        });
    }
};

const sendUserNotification = async (userID, title, message) => {
    try {
        // Récupère le token FCM de l'utilisateur
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log(`Utilisateur ${userID} introuvable.`);
            return;
        }

        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
            console.log(`Aucun token FCM pour l'utilisateur ${userID}`);
            return;
        }

        // Créer le message de notification
        const messagePayload = {
            notification: {
                title: title,
                body: message,
            },
            token: fcmToken,
        };

        // Envoie la notification via Firebase Cloud Messaging
        const response = await messaging.send(messagePayload);
        console.log('Notification envoyée avec succès:', response);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification:', error);
    }
};

const updateInteractionByUserID = async (userID, postID) => { };

const getUserPermissions = async (req, res) => {
    const { userID } = req.params;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur manquant"
        });
    };

    try {
        const userPermissions = await collectUserPermissions(userID);
        if (!userPermissions) {
            return res.status(404).json({
                success: false,
                message: "Permissions de l'utilisateur non trouvées"
            });
        };
        res.status(200).json({
            success: true,
            message: "Permissions de l'utilisateur récupérées avec succès",
            userPermissions: userPermissions
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des permissions de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des permissions de l'utilisateur"
        });

    }
};

const modifyUserFields = async (req, res) => {
    const { userID } = req.params;
    const { field } = req.body;

    try {
        const fieldsUpdated = await updateUserFields(userID, field);
        if (!fieldsUpdated) {
            return res.status(404).json({
                success: false,
                message: "Champs de l'utilisateur non trouvés"
            });
        };
        res.status(200).json({
            success: true,
            message: "Champs de l'utilisateur modifiés avec succès",
        });
    } catch (error) {
        console.error("Erreur lors de la modification des champs de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const toggleFavorites = async (req, res) => {
    const { userID } = req.params;
    const { postID } = req.body;

    try {
        const status = await addRemoveFavorites(postID, userID);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la mise à jour des favoris"
            });
        };
        res.status(200).json({
            success: true,
            message: "Favoris mis à jour avec succès"
        });
    } catch (error) {
        console.error("Erreur réseau lors de la mise à jour des favoris :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const getUserFavorites = async (req, res) => {
    const { userID } = req.params;

    try {
        const postsSaved = await collectUserFavorites(userID);
        if (!postsSaved) {
            return res.status(404).json({
                success: false,
                message: "Aucun favori trouvé pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Favoris récupérés avec succès",
            postsSaved: postsSaved
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des favoris de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const getAdminNotifications = async (req, res) => {

    try {
        const data = await collectAdminNotifications();
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notifications récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const getUserNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const data = await collectUserNotifications(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notifications récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const getUserUnreadNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const data = await collectUserUnreadNotifications(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification non lue trouvée pour cet utilisateur"
            });
        }
        res.status(200).json({
            success: true,
            message: "Notifications non lues récupérées avec succès",
            data: data
        });
    } catch (error) {
        consolee.error("Erreur lors de la récupération des notifications non lues de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const readAdminNotification = async (req, res) => {
    const { userID, notificationID } = req.params;

    try {
        const isRead = await markAdminNotificationAsRead(userID, notificationID);
        if (!isRead) {
            return res.status(404).json({
                success: false,
                message: "Notification non trouvée"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notification marquée comme lue avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la lecture de la notification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const readUserNotification = async (req, res) => {
    const { userID, notificationID } = req.params;

    try {
        const isRead = await markNotificationAsRead(userID, notificationID);
        if (!isRead) {
            return res.status(404).json({
                success: false,
                message: "Notification non trouvée"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notification marquée comme lue avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la lecture de la notification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const readUserAllNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const areRead = await markAllNotificationsAsRead(userID);
        if (!areRead) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Toutes les notifications marquées comme lues avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la lecture de toutes les notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const readAdminAllNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const areRead = await markAllAdminNotificationsAsRead(userID);
        if (!areRead) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Toutes les notifications marquées comme lues avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la lecture de toutes les notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const deleteUserNotification = async (req, res) => {
    const { userID, notificationID } = req.params;
    try {
        const isDeleted = await clearUserNotification(userID, notificationID);
        if (!isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Notification non trouvée"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notification supprimée avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la suppression de la notification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const deleteAdminNotification = async (req, res) => {
    const { userID, notificationID } = req.params;

    try {
        const isDeleted = await clearAdminNotification(userID, notificationID);
        if (!isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Notification non trouvée"
            });
        };
        res.status(200).json({
            success: true,
            message: "Notification supprimée avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la suppression de la notification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const deleteUserAllNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const areDeleted = await clearUserAllNotifications(userID);
        if (!areDeleted) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Toutes les notifications supprimées avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });

    }
};

const deleteAdminAllNotifications = async (req, res) => {
    const { userID } = req.params;

    try {
        const areDeleted = await clearAdminAllNotifications(userID);
        if (!areDeleted) {
            return res.status(404).json({
                success: false,
                message: "Aucune notification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Toutes les notifications supprimées avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const updateDeviceToken = async (req, res) => {
    const user = req.user;
    const { userID } = user;
    const { deviceToken } = req.body;
    console.log(deviceToken);
    try {
        const isTokenStored = await storeDeviceToken(deviceToken, userID);
        if (!isTokenStored) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la mise à jour du token d'un utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Token d'un utilisateur mis à jour avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du token d'un utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    };
};

const fetchInterlocutorProfile = async (req, res) => {
    const { userID } = req.params;

    try {
        const profile = await collectInterlocutorProfile(userID);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la récupération du profil de l'interlocuteur"
            });
        }
        res.status(200).json({
            success: true,
            message: "Profil de l'interlocuteur récupéré avec succès",
            profile: profile
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du profil de l\'interlocuteur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const updateSearchHistory = async (req, res) => {
    const { userID } = req.params;
    const { query } = req.body;

    try {
        const result = await searchHistoryUpdate(userID, query);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la mise à jour de l'historique de recherche"
            });
        }
        res.status(200).json({
            success: true,
            message: "Historique mis à jour.",
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'historique de recherche:", error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
};

const getUserLoginActivity = async (req, res) => {
    const { userID } = req.params;

    try {
        const activity = await collectUserLoginActivity(userID);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Aucune activité de connexion trouvée pour cet utilisateur"
            });
        }
        res.status(200).json({
            success: true,
            message: "Activité de connexion récupérée avec succès",
            activity: activity
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'activité de connexion de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plustard"
        });
    }
};

const getUserIDLoginActivity = async (req, res) => {
    const { UserID } = req.params;

    try {
        const activity = await collectUserIDLoginActivity(UserID);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Aucune activité de connexion trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Activité de connexion récupérée avec succès",
            activity: activity
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'activité de connexion de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plustard"
        });
    }
};

const getUserVerificationData = async (req, res) => {
    const { userID } = req.params;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur manquant dans la requête"
        });
    }

    try {
        const data = await collectUserVerificationData(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucune donnée de vérification trouvée pour cet utilisateur"
            });
        }
        res.status(200).json({
            success: true,
            message: "Données de vérification récupérées avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données de vérification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plustard"
        });

    }
};

const updateUserVerificationData = async (req, res) => {
    const { userID } = req.params;
    const { updateData } = req.body;

    // Vérifier si userID est fourni
    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID de l'utilisateur manquant"
        });
    }

    // Vérifier si les données de mise à jour sont valides
    if (!updateData || (updateData.verificationStatus !== 'approved' &&
        updateData.verificationStatus !== 'rejected')) {
        return res.status(400).json({
            success: false,
            message: "Données de mise à jour invalides"
        });
    }

    // Si le statut est 'rejected', vérifier qu'un motif de rejet est fourni
    if (updateData.verificationStatus === 'rejected' && !updateData.rejectionReason) {
        return res.status(400).json({
            success: false,
            message: "Motif de rejet requis"
        });
    }

    try {
        const isUpdated = await updateUserVerificationStatus(userID, updateData);
        if (!isUpdated) {
            return res.status(404).json({
                success: false,
                message: "Aucune donnée de vérification trouvée pour cet utilisateur"
            });
        };
        res.status(200).json({
            success: true,
            message: "Données de vérification mises à jour avec succès",
            data: isUpdated
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour des données de vérification de l'utilisateur :", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plustard"
        });
    }
};

module.exports = {
    fetchMe,
    getUserLocations,
    getAdminNotifications,
    getAnyUserData,
    getDataFromUserID,
    fetchInterlocutorProfile,
    getAllUsersWithStatus,
    getUsers,
    getUserData,
    getUserFavorites,
    getUserNotifications,
    getUserUnreadNotifications,
    getUserVerificationData,
    deleteUserNotification,
    deleteAdminNotification,
    deleteUserAllNotifications,
    deleteAdminAllNotifications,
    getUserPermissions,
    getUserLoginActivity,
    getUserIDLoginActivity,
    modifyUserFields,
    readUserNotification,
    readAdminNotification,
    readUserAllNotifications,
    readAdminAllNotifications,
    setUserOnline,
    sendUserNotification,
    toggleFavorites,
    updateInteractionByUserID,
    updateDeviceToken,
    updateSearchHistory,
    updateUserVerificationData,
};