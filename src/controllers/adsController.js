const { firestore } = require('../config/firebase-admin');


const getRelatedAds = async (adID, category) => {

    const adsCollection = firestore.collection('POSTS');
    const relatedAdsQuery = adsCollection
        .where('status', '==', 'approved')
        .where('category', '==', category)
        .limit(12);

    const querySnapshot = await relatedAdsQuery.get();
    const relatedAds = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ad => ad.id !== adID);

    return relatedAds;
};


const getUserAds = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const userAdsQuery = adsCollection.where('userID', '==', userID);
        const querySnapshot = await userAdsQuery.get();

        if (querySnapshot.empty) {
            console.log('Aucune annonce trouvée pour cet utilisateur.');
            return [];
        }

        const userAds = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return userAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces de l\'utilisateur:', error);
        throw error;
    }
};


const getUserActiveAds = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const userAdsQuery = adsCollection
            .where('userID', '==', userID)
            .where('status', '==', 'approved')
            .where('isActive', '==', true)
        const querySnapshot = await userAdsQuery.get();

        if (querySnapshot.empty) {
            throw new Error('Aucune annonce active et approuvée.');
        }

        const activeApprovedAds = [];
        querySnapshot.forEach(doc => {
            activeApprovedAds.push({ id: doc.id, ...doc.data() });
        });

        return activeApprovedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces actives et approuvées :', error);
    }
}


const getUserInactiveAds = async (userID) => {
    try {
        const adsCollection = firestore.collection('POSTS');
        const userAdsQuery = adsCollection
            .where('userID', '==', userID)
            .where('status', '==', 'approved')
            .where('isActive', '==', false)
        const querySnapshot = await userAdsQuery.get();

        if (querySnapshot.empty) {
            throw new Error('Aucune annonce inactive et approuvée.');
        }

        const inactiveApprovedAds = [];
        querySnapshot.forEach(doc => {
            inactiveApprovedAds.push({ id: doc.id, ...doc.data() });
        });

        return inactiveApprovedAds;
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces inactives et approuvées :', error);
    }
}




module.exports = {
    getRelatedAds,
    getUserAds,
    getUserActiveAds,
    getUserInactiveAds,
};