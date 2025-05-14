const db = require('../config/database');
const { auth } = require('../config/firebase-admin');
const { snakeCaseKey } = require('../helpers');

const fetchMyData = async (userID) => {
    console.log('fetchMyData called with userID:', userID);
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const userData = userResult.rows[0];
        return userData;
    } catch (error) {
        console.error('Erreur lors de la récupération des données utilisateur:', error);
        throw error;
    }
}

const getUsersData = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Query all users from PostgreSQL
        const usersResult = await client.query('SELECT * FROM users');
        const querySnapshot = usersResult.rows;

        if (querySnapshot.length === 0) {
            await client.query('COMMIT');
            return [];
        }

        const users = [];
        const onlineUsers = [];
        const offlineUsers = [];

        // Process each user row
        querySnapshot.forEach(user => {
            // In PostgreSQL, the row data is directly accessible
            // No need for .data() method
            users.push(user);

            if (user.is_online === true) {
                onlineUsers.push(user);
            }

            if (user.is_online === false) {
                offlineUsers.push(user);
            }
        });

        await client.query('COMMIT');

        return {
            allUsers: users,
            onlineUsers,
            offlineUsers
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
};

const fetchUserLocations = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Query all users from PostgreSQL
        const usersCollection = await client.query('SELECT * FROM users');
        const querySnapshot = usersCollection.rows;

        let cityCounts = {};

        // Process each user row
        querySnapshot.forEach(userData => {
            // In PostgreSQL, the row data is directly accessible
            const city = userData.city || 'Inconnu';

            if (cityCounts[city]) {
                cityCounts[city]++;
            } else {
                cityCounts[city] = 1;
            }
        });

        await client.query('COMMIT');

        return Object.entries(cityCounts).map(([city, count]) => ({ city, count }));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
};

const getUser = async (userID) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch user data from Firebase Authentication
        const userRecord = await auth.getUser(userID);
        if (!userRecord) {
            await client.query('ROLLBACK');
            return null;
        }

        // Query user data from PostgreSQL
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userID]);

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const userData = userResult.rows[0];

        // Commit the transaction
        await client.query('COMMIT');

        return userData;
    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des données utilisateur :', error);
        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
};

const collectUserData = async (user_id) => {
    const UserID = user_id?.toUpperCase();
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Query user data from PostgreSQL where UserID matches
        const userResult = await client.query(
            'SELECT * FROM users WHERE "UserID" = $1 LIMIT 1',
            [UserID]
        );

        if (userResult.rows.length === 0) {
            await client.query('COMMIT');
            return null;
        }

        const userData = userResult.rows[0];

        await client.query('COMMIT');
        return userData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des données utilisateur :', error);
        throw error;
    } finally {
        client.release();
    }
};

const collectAllUsersWithStatus = async () => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Query all users from PostgreSQL
        const usersResult = await client.query('SELECT * FROM users');

        const allUsers = [];
        const onlineUsers = [];
        const offlineUsers = [];

        // Process each user row
        for (const user of usersResult.rows) {
            // Add the user to the appropriate arrays based on online status
            allUsers.push(user);

            if (user.is_online) {
                onlineUsers.push(user);
            } else {
                offlineUsers.push(user);
            }
        }

        await client.query('COMMIT');

        return { allUsers, onlineUsers, offlineUsers };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
};

const collectUserPermissions = async (userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Query user data from PostgreSQL
        const userResult = await client.query(
            'SELECT permissions FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            console.log(`Utilisateur ${userID} introuvable.`);
            await client.query('COMMIT');
            return null;
        }

        // Get permissions from user data
        // Note: This assumes permissions are stored as a JSONB array in PostgreSQL
        const userData = userResult.rows[0];
        const permissions = userData.permissions || [];

        await client.query('COMMIT');
        return permissions;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la récupération des permissions de l\'utilisateur :', error);
        throw error;
    } finally {
        client.release();
    }
};

const setUserOnlineStatus = async (userID, isOnline) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Update user's online status
        const updateResult = await client.query(
            `UPDATE users 
             SET is_online = $1, 
                 last_online = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [isOnline, userID]
        );

        if (updateResult.rows.length === 0) {
            // No user found with this ID
            await client.query('ROLLBACK');
            return false;
        }

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour de l'état en ligne :", error);
        return false;
    } finally {
        client.release();
    }
};

const updateUserFields = async (userID, field) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // First check if the user exists
        const userCheck = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );

        if (userCheck.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }

        // Build the SET clause dynamically based on the field object
        const setEntries = Object.entries(field);
        const setClause = setEntries.map((entry, index) =>
            `${snakeCaseKey(entry[0])} = $${index + 2}`
        ).join(', ');

        // Add updated_at to the SET clause
        const fullSetClause = `${setClause}, updated_at = NOW()`;

        // Build the parameter array with userID as the first parameter
        const params = [userID, ...setEntries.map(entry => entry[1])];

        // Execute the update query
        await client.query(
            `UPDATE users SET ${fullSetClause} WHERE id = $1`,
            params
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour des champs de l'utilisateur :", error);
        return false;
    } finally {
        client.release();
    }
};

const updateUserInteraction = async (userID, adID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Check if the user exists and get current interaction data
        const userResult = await client.query(
            'SELECT id, ads_clicked FROM users WHERE id = $1',
            [userID]
        );

        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }

        const userData = userResult.rows[0];
        const adsClicked = userData.ads_clicked || [];

        // If user has already clicked on this ad, don't update counters
        if (adsClicked.includes(adID)) {
            console.log("L'utilisateur a déjà cliqué sur cette annonce");
            await client.query('ROLLBACK');
            return false;
        }

        // Add the ad ID to the ads_clicked array
        adsClicked.push(adID);

        // Update user interactions
        await client.query(
            `UPDATE users 
             SET clicks_on_ads = clicks_on_ads + 1,
                 total_ads_viewed = total_ads_viewed + 1,
                 ads_clicked = $2
             WHERE id = $1`,
            [userID, JSON.stringify(adsClicked)]
        );

        console.log("Interaction de l'utilisateur mise à jour");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour des interactions utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const addRemoveFavorites = async (postID, userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Check if user and post exist
        const userResult = await client.query('SELECT id FROM users WHERE id = $1', [userID]);
        const postResult = await client.query('SELECT id, favorited_by, favorites FROM posts WHERE id = $1', [postID]);

        if (userResult.rows.length === 0 || postResult.rows.length === 0) {
            console.log("Utilisateur ou annonce non trouvé");
            await client.query('ROLLBACK');
            return false;
        }

        const postData = postResult.rows[0];
        const favoritedBy = postData.favorited_by || [];
        const isFavorite = favoritedBy.includes(userID);

        // Check if the post is already in favorites
        if (isFavorite) {
            // Remove from favorites

            // 1. Remove user from post's favorited_by array
            const updatedFavoritedBy = favoritedBy.filter(id => id !== userID);

            // 2. Update post data
            await client.query(
                `UPDATE posts 
                 SET favorited_by = $1, 
                     favorites = favorites - 1 
                 WHERE id = $2`,
                [JSON.stringify(updatedFavoritedBy), postID]
            );

            // 3. Remove post from user's ads_saved
            await client.query(
                `UPDATE users 
                 SET ads_saved = (
                     SELECT ARRAY_REMOVE(ads_saved, $1::text)
                     FROM users
                     WHERE id = $2
                 )
                 WHERE id = $2`,
                [postID, userID]
            );

            console.log("Annonce retirée des favoris");
        } else {
            // Add to favorites

            // 1. Add user to post's favorited_by array
            favoritedBy.push(userID);

            // 2. Update post data
            await client.query(
                `UPDATE posts 
                 SET favorited_by = $1, 
                     favorites = favorites + 1 
                 WHERE id = $2`,
                [JSON.stringify(favoritedBy), postID]
            );

            // 3. Add post to user's ads_saved
            await client.query(
                `UPDATE users 
                 SET ads_saved = (
                     SELECT ARRAY_APPEND(COALESCE(ads_saved, '{}'), $1::text)
                     FROM users
                     WHERE id = $2
                 )
                 WHERE id = $2`,
                [postID, userID]
            );

            console.log("Annonce ajoutée aux favoris");
        }

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour des favoris de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const collectUserFavorites = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get user data and check if user exists
        const userResult = await client.query(
            'SELECT ads_saved FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        const userData = userResult.rows[0];
        const postsSaved = userData.ads_saved || [];
        
        if (postsSaved.length === 0) {
            console.log("Aucune annonce enregistrée.");
            await client.query('COMMIT');
            return [];
        }
        
        // Get posts data for the saved post IDs
        // Using ANY with an array parameter for the IN clause
        const favoritesResult = await client.query(
            'SELECT * FROM posts WHERE id = ANY($1)',
            [postsSaved]
        );
        
        if (favoritesResult.rows.length === 0) {
            console.log("Aucune annonce trouvée.");
            await client.query('COMMIT');
            return [];
        }
        
        // Return the favorite posts
        const favoritePosts = favoritesResult.rows;
        
        await client.query('COMMIT');
        return favoritePosts;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la récupération des favoris de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const collectAdminNotifications = async () => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get admin notifications ordered by timestamp in descending order
        const notificationResult = await client.query(
            `SELECT * FROM admin_notifications 
             ORDER BY timestamp DESC`
        );
        
        if (notificationResult.rows.length === 0) {
            console.log("Aucune notification trouvée.");
            await client.query('COMMIT');
            return [];
        }
        
        const notifs = notificationResult.rows;
        
        // Filter unread notifications
        const unReadNotifs = notifs.filter(notification => notification.is_read === false);
        
        await client.query('COMMIT');
        return {
            notifications: notifs,
            unReadNotifs
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la récupération des notifications", error);
        return [];
    } finally {
        client.release();
    }
};

const collectUserNotifications = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Get user notifications ordered by timestamp in descending order
        const notificationResult = await client.query(
            `SELECT * FROM user_notifications 
             WHERE user_id = $1 
             ORDER BY timestamp DESC`,
            [userID]
        );
        
        const notifs = notificationResult.rows;
        
        // Filter unread notifications
        const unReadNotifs = notifs.filter(notification => notification.is_read === false);
        
        await client.query('COMMIT');
        return {
            notifications: notifs,
            unReadNotifs
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la récupération des notifications de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const collectUserUnreadNotifications = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Get unread notifications for the user
        const notificationResult = await client.query(
            `SELECT * FROM user_notifications 
             WHERE user_id = $1 AND is_read = false`,
            [userID]
        );
        
        await client.query('COMMIT');
        return notificationResult.rows;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la récupération des notifications non lues de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const markAdminNotificationAsRead = async (userID, notificationID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Check if notification exists and get its current status
        const notificationResult = await client.query(
            'SELECT id, is_read FROM admin_notifications WHERE id = $1',
            [notificationID]
        );
        
        if (notificationResult.rows.length === 0) {
            console.error("Notification non trouvée");
            await client.query('ROLLBACK');
            return false;
        }
        
        const notificationData = notificationResult.rows[0];
        
        if (notificationData.is_read) {
            console.log("La notification est déjà marquée comme lue");
            await client.query('COMMIT');
            return true;
        }
        
        // Mark notification as read
        await client.query(
            'UPDATE admin_notifications SET is_read = true WHERE id = $1',
            [notificationID]
        );
        
        console.log("Notification marquée comme lue avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour de la notification", error);
        return false;
    } finally {
        client.release();
    }
};

const markNotificationAsRead = async (userID, notificationID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Check if notification exists and belongs to the user
        const notificationResult = await client.query(
            'SELECT id FROM user_notifications WHERE id = $1 AND user_id = $2',
            [notificationID, userID]
        );
        
        if (notificationResult.rows.length === 0) {
            console.error("Notification non trouvée");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Mark notification as read
        await client.query(
            'UPDATE user_notifications SET is_read = true WHERE id = $1',
            [notificationID]
        );
        
        console.log("Notification marquée comme lue avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la lecture de la notification de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const markAllNotificationsAsRead = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Mark all user's notifications as read
        await client.query(
            'UPDATE user_notifications SET is_read = true WHERE user_id = $1',
            [userID]
        );
        
        console.log("Toutes les notifications ont été marquées comme lues avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la lecture de toutes les notifications de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const markAllAdminNotificationsAsRead = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Mark all admin notifications as read
        await client.query(
            'UPDATE admin_notifications SET is_read = true'
        );
        
        console.log("Toutes les notifications ont été marquées comme lues avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la mise à jour des notifications de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const clearAdminNotification = async (userID, notificationID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Check if notification exists
        const notificationResult = await client.query(
            'SELECT id FROM admin_notifications WHERE id = $1',
            [notificationID]
        );
        
        if (notificationResult.rows.length === 0) {
            console.error("Notification non trouvée");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Delete the notification
        await client.query(
            'DELETE FROM admin_notifications WHERE id = $1',
            [notificationID]
        );
        
        console.log("Notification supprimée avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression de la notification", error);
        return false;
    } finally {
        client.release();
    }
};

const clearUserNotification = async (userID, notificationID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Check if notification exists and belongs to the user
        const notificationResult = await client.query(
            'SELECT id FROM user_notifications WHERE id = $1 AND user_id = $2',
            [notificationID, userID]
        );
        
        if (notificationResult.rows.length === 0) {
            console.error("Notification non trouvée");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Delete the notification
        await client.query(
            'DELETE FROM user_notifications WHERE id = $1',
            [notificationID]
        );
        
        console.log("Notification supprimée avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression de la notification de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const clearAllAdminNotifications = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Delete all admin notifications
        await client.query('DELETE FROM admin_notifications');
        
        console.log("Toutes les notifications ont été supprimées avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression de toutes les notifications", error);
        return false;
    } finally {
        client.release();
    }
};

const clearUserAllNotifications = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Delete all user's notifications
        await client.query(
            'DELETE FROM user_notifications WHERE user_id = $1',
            [userID]
        );
        
        console.log("Toutes les notifications ont été supprimées avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const clearAdminAllNotifications = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé");
            await client.query('ROLLBACK');
            return false;
        }
        
        // Delete all admin notifications
        await client.query('DELETE FROM admin_notifications');
        
        console.log("Toutes les notifications ont été supprimées avec succès !");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erreur lors de la suppression de toutes les notifications de l'utilisateur", error);
        return false;
    } finally {
        client.release();
    }
};

const collectInterlocutorProfile = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Note: The original function has an issue - 'chat' is not defined
        // We need to know which chat we're looking at to determine the interlocutor
        // Assuming chat ID is passed or available in context
        
        // First, get the chat to determine the interlocutor
        const chatResult = await client.query(
            'SELECT sender_id, receiver_id FROM chats WHERE id = $1',
            [chatID] // This parameter needs to be passed to the function
        );
        
        if (chatResult.rows.length === 0) {
            console.error(`❌ Chat introuvable`);
            await client.query('ROLLBACK');
            return null;
        }
        
        const chat = chatResult.rows[0];
        
        // Determine the interlocutor (the other user in the conversation)
        const interlocutorID = chat.sender_id === userID ? chat.receiver_id : chat.sender_id;
        
        // Get the interlocutor's profile data
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [interlocutorID]
        );
        
        if (userResult.rows.length === 0) {
            console.error(`❌ Profil de l'interlocuteur introuvable pour l'ID : ${interlocutorID}`);
            await client.query('ROLLBACK');
            return null;
        }
        
        // Return the interlocutor's profile data
        const userData = userResult.rows[0];
        
        await client.query('COMMIT');
        return userData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la récupération du profil de l'interlocuteur :", error);
        return null;
    } finally {
        client.release();
    }
};

const searchHistoryUpdate = async (userID, query) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get user data
        const userResult = await client.query(
            'SELECT search_history FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            console.log("Utilisateur non trouvé.");
            await client.query('ROLLBACK');
            return null;
        }
        
        const userData = userResult.rows[0];
        let searchHistory = userData.search_history || [];
        
        // Check if the search already exists
        if (!searchHistory.includes(query)) {
            // Add the new search to the beginning of the array
            searchHistory.unshift(query);
            
            // Limit to 10 stored searches
            searchHistory = searchHistory.slice(0, 10);
            
            // Update the search history in PostgreSQL
            await client.query(
                'UPDATE users SET search_history = $1 WHERE id = $2',
                [JSON.stringify(searchHistory), userID]
            );
        }
        
        console.log("Historique mis à jour.");
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la mise à jour de l'historique de recherche:", error);
        return null;
    } finally {
        client.release();
    }
};

const collectAnyUserData = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get user data
        const userResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        
        const userData = userResult.rows[0];
        
        await client.query('COMMIT');
        return userData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la récupération des données utilisateur :", error);
        return null;
    } finally {
        client.release();
    }
};

const collectUserLoginActivity = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        
        // Get login activity data
        const loginResult = await client.query(
            `SELECT * FROM login_activity 
             WHERE user_id = $1 
             ORDER BY time DESC`,
            [userID]
        );
        
        const loginData = loginResult.rows;
        
        await client.query('COMMIT');
        return loginData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la récupération des données de connexion utilisateur :", error);
        return null;
    } finally {
        client.release();
    }
};

const collectUserIDLoginActivity = async (UserID) => {
    const client = await db.pool.connect();
    const user_id = UserID?.toUpperCase();
    
    try {
        await client.query('BEGIN');
        
        // Find user by UserID
        const userResult = await client.query(
            'SELECT id FROM users WHERE "UserID" = $1 LIMIT 1',
            [user_id]
        );
        
        if (userResult.rows.length === 0) {
            console.log("❌ Aucun utilisateur trouvé avec l'UserID spécifié.");
            await client.query('ROLLBACK');
            return null;
        }
        
        const userID = userResult.rows[0].id;
        
        // Get login activity data
        const loginResult = await client.query(
            `SELECT * FROM login_activity 
             WHERE user_id = $1 
             ORDER BY time DESC`,
            [userID]
        );
        
        const loginData = loginResult.rows;
        
        await client.query('COMMIT');
        return loginData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la récupération des données de connexion utilisateur :", error);
        return null;
    } finally {
        client.release();
    }
};

const collectUserVerificationData = async (userID) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userID]
        );
        
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        
        // Get verification data from the verification_id table
        const verificationResult = await client.query(
            'SELECT * FROM verification_id WHERE user_id = $1',
            [userID]
        );
        
        const verificationData = verificationResult.rows;
        
        await client.query('COMMIT');
        return verificationData;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la récupération des données de vérification utilisateur :", error);
        return null;
    } finally {
        client.release();
    }
};

module.exports = {
    fetchMyData,

    addRemoveFavorites,

    clearAdminNotification,
    clearAllAdminNotifications,
    clearAdminAllNotifications,
    clearUserAllNotifications,

    collectUserLoginActivity,
    collectUserIDLoginActivity,
    clearUserNotification,
    collectAdminNotifications,
    collectAllUsersWithStatus,
    collectAnyUserData,
    collectUserData,
    collectUserNotifications,
    collectUserFavorites,
    collectUserPermissions,
    collectUserUnreadNotifications,
    collectUserVerificationData,

    fetchUserLocations,

    getUser,
    getUsersData,

    markAllAdminNotificationsAsRead,
    markAdminNotificationAsRead,
    markAllNotificationsAsRead,
    markNotificationAsRead,

    searchHistoryUpdate,
    setUserOnlineStatus,
    
    updateUserFields,
    updateUserInteraction,
};