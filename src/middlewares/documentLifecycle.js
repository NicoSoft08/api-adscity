const { firestore, storage, admin } = require("../config/firebase-admin");

/**
 * Scheduled function to clean up verification documents
 * This should be run on a schedule (e.g., daily)
 */
const cleanupVerificationDocuments = async () => {
    try {
        console.log("Starting verification documents cleanup process");

        // Get users with completed verifications older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const usersSnapshot = await firestore.collection('USERS')
            .where('verificationStatus', 'in', ['approved', 'rejected'])
            .where('updatedAt', '<', thirtyDaysAgo)
            .get();

        if (usersSnapshot.empty) {
            console.log("No documents to clean up");
            return;
        }

        console.log(`Found ${usersSnapshot.size} users with old verification documents`);

        // Process each user
        const batch = firestore.batch();
        let deletedCount = 0;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const userID = doc.id;

            // Delete files from storage
            if (userData.documents && userData.documents.identityDocument) {
                try {
                    // Extract file path from URL
                    const urlPath = userData.documents.identityDocument;
                    const fileName = `DOCS/VERIFICATIONS/${userID}/_document`;
                    await storage.bucket().file(fileName).delete();
                    console.log(`Deleted document file for user ${userID}`);
                } catch (fileError) {
                    console.error(`Error deleting document file for user ${userID}:`, fileError);
                }
            }

            if (userData.documents && userData.documents.selfie) {
                try {
                    const fileName = `DOCS/VERIFICATIONS/${userID}/_selfie`;
                    await storage.bucket().file(fileName).delete();
                    console.log(`Deleted selfie file for user ${userID}`);
                } catch (fileError) {
                    console.error(`Error deleting selfie file for user ${userID}:`, fileError);
                }
            }

            // Update user document to remove sensitive URLs but keep verification status
            batch.update(doc.ref, {
                'documents.identityDocument': admin.firestore.FieldValue.delete(),
                'documents.selfie': admin.firestore.FieldValue.delete(),
                'documents.cleanedAt': admin.firestore.FieldValue.serverTimestamp()
            });

            deletedCount++;
        }

        // Commit all database updates
        await batch.commit();
        console.log(`Successfully cleaned up documents for ${deletedCount} users`);

    } catch (error) {
        console.error("Error in verification documents cleanup:", error);
    }
};

/**
 * Function to immediately delete verification documents after rejection
 */
const deleteRejectedVerificationDocuments = async (userID) => {
    try {
        console.log(`Deleting rejected verification documents for user ${userID}`);

        // Delete files from storage
        const documentFile = `DOCS/VERIFICATIONS/${userID}/_document`;
        const selfieFile = `DOCS/VERIFICATIONS/${userID}/_selfie`;

        try {
            await storage.bucket().file(documentFile).delete();
            await storage.bucket().file(selfieFile).delete();
        } catch (fileError) {
            console.error(`Error deleting files for user ${userID}:`, fileError);
        }

        // Update user document
        await firestore.collection('USERS').doc(userID).update({
            'documents.identityDocument': admin.firestore.FieldValue.delete(),
            'documents.selfie': admin.firestore.FieldValue.delete(),
            'documents.deletedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Successfully deleted verification documents for user ${userID}`);
        return true;
    } catch (error) {
        console.error(`Error deleting verification documents for user ${userID}:`, error);
        return false;
    }
};

module.exports = {
    cleanupVerificationDocuments,
    deleteRejectedVerificationDocuments
};