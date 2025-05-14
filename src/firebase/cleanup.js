const { firestore, admin } = require("../config/firebase-admin");

const deleteOldExpiredPosts = async () => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1); // Remonter d'un mois

    const expiredAdsSnapshot = await firestore.collection('POSTS')
        .where('status', '==', 'expired')
        .where('updatedAt', '<=', oneMonthAgo) // Si expirée depuis plus d'un mois
        .get();

    const batch = firestore.batch();

    expiredAdsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log("Annonces expirées depuis plus d'un mois supprimées !");
};

// Envoyer une notification avant la suppression (Tous les dimanches à 8h)
const deletionReminder = async () => {
    const now = new Date();
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(now.getDate() - 21); // 21 jours après expiration

    const postsSnapshot = await firestore.collection('POSTS')
        .where("status", "==", "expired")
        .where("updatedAt", "<=", threeWeeksAgo) // Expiré depuis 21 jours
        .get();

    postsSnapshot.forEach(async (doc) => {
        const postData = doc.data();
        const userRef = firestore.collection('USERS').doc(postData.userID);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            const userData = userSnap.data();
            const notification = {
                type: 'ad_deletion',
                title: "Votre annonce expirée sera supprimée bientôt",
                message: `L'annonce "${postData.adDetails.title}" sera supprimée dans 7 jours. Republiez-la si vous souhaitez la conserver.`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isRead: false,
            }
            console.log(`🔔 Notification envoyée à ${userData.email}`);
            await userRef.collection('NOTIFICATIONS').add(notification);
        }
    });
};


const deleteOldAdminLogs = async (days = 30) => {
    try {
        console.log(`🧹 Starting cleanup of admin logs older than ${days} days...`);

        // Calculate the cutoff date (30 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const cutoffTimestamp = cutoffDate.toISOString();

        // Query for old logs
        const oldLogsQuery = await firestore.collection('ADMIN_LOGS')
            .where('timestamp', '<', cutoffTimestamp)
            .get();

        if (oldLogsQuery.empty) {
            console.log('No old logs to delete');
            return { success: true, deleted: 0, error: null };
        }

        // Delete the old logs in batches (Firestore allows max 500 operations per batch)
        const batchSize = 450; // Leave some room for other operations
        let deletedCount = 0;
        let batch = firestore.batch();
        let operationCount = 0;

        oldLogsQuery.forEach(doc => {
            batch.delete(doc.ref);
            operationCount++;
            deletedCount++;

            // If we reach the batch limit, commit and create a new batch
            if (operationCount >= batchSize) {
                console.log(`Committing batch of ${operationCount} deletions...`);
                batch.commit();
                batch = firestore.batch();
                operationCount = 0;
            }
        });

        // Commit any remaining operations
        if (operationCount > 0) {
            console.log(`Committing final batch of ${operationCount} deletions...`);
            await batch.commit();
        }

        console.log(`✅ Successfully deleted ${deletedCount} old admin logs`);
        return { success: true, deleted: deletedCount, error: null };
    } catch (error) {
        console.error('❌ Error deleting old admin logs:', error);
        return { success: false, deleted: 0, error: error.message };
    }
}

const deleteOldClientLogs = async (days = 30) => {
    try {
        console.log(`🧹 Starting cleanup of client logs older than ${days} days...`);

        // Calculate the cutoff date (30 days ago)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const cutoffTimestamp = cutoffDate.toISOString();

        // Query for old logs
        const oldLogsQuery = await firestore.collection('CLIENT_LOGS')
            .where('timestamp', '<', cutoffTimestamp)
            .get();

        if (oldLogsQuery.empty) {
            console.log('No old logs to delete');
            return { success: true, deleted: 0, error: null };
        }

        // Delete the old logs in batches (Firestore allows max 500 operations per batch)
        const batchSize = 450; // Leave some room for other operations
        let deletedCount = 0;
        let batch = firestore.batch();
        let operationCount = 0;

        oldLogsQuery.forEach(doc => {
            batch.delete(doc.ref);
            operationCount++;
            deletedCount++;

            // If we reach the batch limit, commit and create a new batch
            if (operationCount >= batchSize) {
                console.log(`Committing batch of ${operationCount} deletions...`);
                batch.commit();
                batch = firestore.batch();
                operationCount = 0;
            }
        });

        // Commit any remaining operations
        if (operationCount > 0) {
            console.log(`Committing final batch of ${operationCount} deletions...`);
            await batch.commit();
        }

        console.log(`✅ Successfully deleted ${deletedCount} old client logs`);
        return { success: true, deleted: deletedCount, error: null };
    } catch (error) {
        console.error('❌ Error deleting old client logs:', error);
        return { success: false, deleted: 0, error: error.message };
    }
};

const cleanupOldProfileVisits = async (days = 90) => {
    try {
        console.log(`🧹 Starting cleanup of profile visits older than ${days} days...`);
        
        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Get all users
        const usersSnapshot = await firestore.collection('USERS').get();
        
        if (usersSnapshot.empty) {
            console.log('No users found');
            return { success: true, usersUpdated: 0, error: null };
        }
        
        let usersUpdated = 0;
        const batch = firestore.batch();
        
        // Process each user
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            // Skip users without visit history
            if (!userData.profileVisitsHistory || !Array.isArray(userData.profileVisitsHistory) || userData.profileVisitsHistory.length === 0) {
                continue;
            }
            
            // Filter out old visits
            const newVisitsHistory = userData.profileVisitsHistory.filter(visit => {
                // Handle both timestamp formats (Date object or ISO string)
                const visitDate = visit.timestamp instanceof Date 
                    ? visit.timestamp 
                    : new Date(visit.timestamp);
                
                return visitDate >= cutoffDate;
            });
            
            // If we removed any visits, update the user document
            if (newVisitsHistory.length < userData.profileVisitsHistory.length) {
                batch.update(userDoc.ref, {
                    profileVisitsHistory: newVisitsHistory
                });
                usersUpdated++;
            }
            
            // Clean up old daily visit records
            const profileVisitsToday = userData.profileVisitsToday || {};
            const updatedVisitsToday = {};
            let visitsChanged = false;
            
            // Keep only recent daily records
            for (const [date, count] of Object.entries(profileVisitsToday)) {
                const visitDate = new Date(date);
                if (visitDate >= cutoffDate) {
                    updatedVisitsToday[date] = count;
                } else {
                    visitsChanged = true;
                }
            }
            
            // If we removed any daily records, update the user document
            if (visitsChanged) {
                batch.update(userDoc.ref, {
                    profileVisitsToday: updatedVisitsToday
                });
                
                // Make sure we count this user as updated
                if (!usersUpdated) {
                    usersUpdated++;
                }
            }
        }
        
        // Commit all the updates
        if (usersUpdated > 0) {
            await batch.commit();
            console.log(`✅ Successfully cleaned up profile visits for ${usersUpdated} users`);
        } else {
            console.log('No profile visits needed cleanup');
        }
        
        return { success: true, usersUpdated, error: null };
    } catch (error) {
        console.error('❌ Error cleaning up profile visits:', error);
        return { success: false, usersUpdated: 0, error: error.message };
    }
};

module.exports = {
    deleteOldAdminLogs,
    deleteOldClientLogs,
    deleteOldExpiredPosts,
    deletionReminder,
    cleanupOldProfileVisits,
}