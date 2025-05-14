const { firestore } = require("../config/firebase-admin")

const collectPromotionLimits = async () => {
    try {
        const promotionsRef = firestore.collection('PROMOTIONS').doc('launchOffer');
        const promotionDoc = await promotionsRef.get();
        
        if (!promotionDoc.exists) {
            console.log('La promotion introuvable');
            return null;
        }

        const { features } = promotionDoc.data();
        return features;
    } catch (error) {
        console.error('Erreur lors de la récupération des limites de promotion:', error);
        return null;
    };
};

const isPromotionActive = async () => {
    try {
        const promotionsRef = firestore.collection('PROMOTIONS').doc('launchOffer');
        const promotionDoc = await promotionsRef.get();

        if (promotionDoc.exists) {
            const { enabled, endDate} = promotionDoc.data();

            // Vérifie si la promotion est toujours active en fonction de la date d'expiration
            const now = new Date();
            const isExpired = endDate && new Date(endDate) < now;

            return enabled && !isExpired;
        };

        return false;
    } catch (error) {
        console.error('Erreur lors de la vérification de la promotion active:', error);
        return false;
    };
};

module.exports = {
    collectPromotionLimits,
    isPromotionActive
};