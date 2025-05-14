const { admin, firestore } = require("../config/firebase-admin");

const createStatusData = async (statusData, userID) => {
    try {
        // Generate a unique ID for the status
        const statusRef = firestore.collection('STATUSES').doc();
        const statusID = statusRef.id;

        // Add additional metadata to the status
        const enhancedStatusData = {
            ...statusData,
            userID: userID,
            statusID: statusID,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            viewCount: 0,
            viewers: [],
            isActive: true,
            expiresAt: admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            )
        };

        // Create the status document
        await statusRef.set(enhancedStatusData);
        return true;
    } catch (error) {
        console.error("Erreur lors de la création du statut :", error);
        throw error;
    }
};

const getAllStatusesData = async () => {
    try {
        const statusRef = firestore.collection('STATUSES');
        const querySnapshot = await statusRef.get();
        const statusData = [];
        querySnapshot.forEach((doc) => {
            statusData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return statusData;
    } catch (error) {
        console.error("Erreur lors de la récupération des données de statut :", error);
        throw error;
    }
};

const getStatusData = async (userID) => {
    try {
        const statusRef = firestore.collection('STATUSES');
        const querySnapshot = await statusRef.where('userID', '==', userID).get();
        const statusData = [];
        querySnapshot.forEach((doc) => {
            statusData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return statusData;
    } catch (error) {
        console.error("Erreur lors de la récupération des données de statut :", error);
        throw error;
    }
};

module.exports = {
    createStatusData,
    getAllStatusesData,
    getStatusData,
};