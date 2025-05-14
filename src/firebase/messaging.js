const { firestore, messaging } = require("../config/firebase-admin");

// Fonction pour envoyer une notification
const sendNotification = async () => {
    try {
        console.log("🔔 Envoi de notification en cours...");

        // Récupération des utilisateurs avec des tokens
        const usersSnapshot = await firestore.collection("USERS").get();

        const tokens = [];
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.deviceToken) {
                tokens.push(userData.deviceToken);
            }
        });

        if (tokens.length === 0) {
            console.log("⚠️ Aucun utilisateur avec un deviceToken trouvé.");
            return;
        }

        const payload = {
            notification: {
                title: "🔔 Rappel automatique",
                body: "Ceci est un test de notification envoyée toutes les 5 minutes.",
            },
            tokens, // Liste des tokens des utilisateurs
        };

        const response = await messaging.sendEachForMulticast(payload);
        console.log(`✅ Notifications envoyées à ${response.successCount} utilisateurs.`);

        if (response.failureCount > 0) {
            console.warn(`⚠️ ${response.failureCount} échecs lors de l'envoi.`);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi des notifications :", error);
    }
};

const sendPromotionEndNotifications = async () => {
    try {
        const promotionsRef = firestore.collection('PROMOTIONS').doc('launchOffer');
        const promotionDoc = await promotionsRef.get();

        if (!promotionDoc.exists) {
            console.error("La promotion n'existe pas dans Firestore.");
            return;
        };

        const promotion = promotionDoc.data();
        if (!promotion.enabled) {
            console.log("La promotion n'est pas active.");
            return;
        };

        const now = new Date();
        const endDate = promotion.endDate.toDate();
        const daysBeforeNotification = 7; // Envoyer la notification 7 jours avant la fin
        const notificationDate = new Date(endDate);
        notificationDate.setDate(notificationDate.getDate() - daysBeforeNotification);

        if (now >= notificationDate && now < endDate) {
            console.log("Nous sommes dans la période de notification.");

            // Récupérer les utilisateurs avec cette promotion
            const usersRef = await firestore.collection('USERS')
                .where('plans.individual.expiryDate', '==', promotion.endDate)
                .get();

            const messages = [];

            usersRef.forEach(doc => {
                const userData = doc.data();
                if (userData.deviceToken) {
                    messages.push({
                        token: userData.deviceToken,
                        notification: {
                            title: "Votre promotion expire bientôt !",
                            body: `Profitez de votre offre avant le ${endDate.toLocaleDateString()}`,
                        },
                    });
                };
            });

            if (messages.length > 0) {
                console.log(`Envoi de ${messages.length} notifications...`);
                const response = await messaging.sendEachForMulticast({ tokens: messages.map(msg => msg.token), notification: messages[0].notification });
            
                console.log(`Notifications envoyées : ${response.successCount} succès, ${response.failureCount} échecs.`);
            } else {
                console.log("Aucun token de notification valide.");
            }
        } else {
            console.log("Ce n'est pas encore le moment d'envoyer la notification.");
        }
    } catch (error) {
        console.error("Erreur lors de l'envoi des notifications :", error);
    };
};

module.exports = {
    sendNotification,
    sendPromotionEndNotifications,
};
