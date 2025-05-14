const { admin, firestore, messaging } = require("../config/firebase-admin");


// Fonction pour vérifier et mettre à jour les périodes d'essai expirées
const checkFreeTrialExpiry = async () => {
    try {
        const usersRef = admin.firestore()
            .collection('USERS')
            .where('freeTrial.isActive', '==', true);
        const snapshot = await usersRef.get();

        snapshot.forEach(async (doc) => {
            const userData = doc.data();
            const currentDate = new Date();

            // Si la période d'essai est expirée
            if (new Date(userData.freeTrial.endDate) <= currentDate) {
                await doc.ref.update({
                    'freeTrial.isActive': false,
                    adLimits: {
                        adsPerMonth: 3,
                        photosPerAd: 5,
                        adValidity: 7 // Une semaine pour la validité des annonces
                    }
                });
                console.log(`Période d'essai expirée pour l'utilisateur ${doc.id}`);
            }
        });
    } catch (error) {
        console.error('Erreur lors de la vérification des périodes d\'essai :', error);
    }
};

const paymentStatusChecker = async () => {
    try {
        const currentDate = new Date();

        // Récupérer les paiements en cours et expirés
        const paymentsSnapshot = await firestore.collection('PAYMENTS')
            .where('status', '==', 'processing')
            .where('expireAt', '<', currentDate)
            .get();

        if (paymentsSnapshot.empty) {
            console.log('Aucun paiement en attente expiré.');
            return;
        }

        console.log(`Paiements à vérifier : ${paymentsSnapshot.size}`);

        // Mettre à jour les statuts en parallèle
        const updatePromises = paymentsSnapshot.docs.map(async (doc) => {
            const payment = doc.data();
            const now = new Date();

            try {
                if (payment.expireAt.toDate() < now) {
                    await doc.ref.update({
                        status: 'expired',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`Paiement expiré : ${doc.id}`);
                }
            } catch (updateError) {
                console.error(`Erreur lors de la mise à jour du paiement ${doc.id}:`, updateError);
            }
        });

        await Promise.all(updatePromises);
        console.log('Vérification des paiements terminée.');

    } catch (error) {
        console.error('Erreur lors de la vérification des paiements:', error);
    }
};

const markPostsAsExpired = async () => {
    const now = new Date();
    const postsSnapshot = await firestore.collection('POSTS')
        .where('expiry_date', '<=', now)
        .where('status', '==', 'active') // Filtrer les annonces encore actives
        .get();

    const batch = firestore.batch();

    postsSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
            status: 'expired',
            updatedAt: now, // Stocke la date d'expiration
        });
    });

    await batch.commit();
    console.log("Annonces expirées mises à jour !");
};

const formatDate = (date) => {
    const options = { day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString('fr-FR', options); // Format FR
};

const formatDateISO = (date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
};

const formatRegisterDate = async () => {
    try {
        const usersSnapshot = await firestore.collection('USERS').get();
        const batch = firestore.batch();
        let count = 0;

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();

            console.log(`User: ${doc.id}, CreatedAt: ${userData.createdAt}`);

            // Vérifier si les champs existent déjà
            if (!userData.createdAt || userData.registrationDateISO) return;

            // Convertir Firestore Timestamp en Date
            const createdAtDate = userData.createdAt.toDate();
            const formattedDate = formatDate(createdAtDate); // Ex: "30 mars 2025"
            const formattedDateISO = formatDateISO(createdAtDate); // Ex: "2025-03-30"

            // Vérifier si la date est bien générée
            console.log(`Mise à jour de ${doc.id} → ISO: ${formattedDateISO}, Affichage: ${formattedDate}`);

            batch.update(doc.ref, {
                registrationDate: formattedDate,
                registrationDateISO: formattedDateISO,
            });

            count++;

            // Firestore limite 500 opérations par batch
            if (count % 500 === 0) {
                batch.commit();
            }
        });

        await batch.commit();
        console.log(`✅ ${count} utilisateurs mis à jour.`);

    } catch (error) {
        console.error("Erreur lors de la mise à jour des dates d'inscription :", error);
        throw error;
    }
};

module.exports = {
    formatDate,
    formatDateISO,
    formatRegisterDate,
    checkFreeTrialExpiry,
    markPostsAsExpired,
    paymentStatusChecker,
}