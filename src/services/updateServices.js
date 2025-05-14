const express = require('express');
const router = express.Router();
const { admin, firestore } = require("../config/firebase-admin");
const { updateUserByField } = require('../firebase/firestore');


// Update Interaction
router.post('/update/interaction', async (req, res) => {
    const { postID, userID, category } = req.body;

    if (!postID || !userID) {
        return res.status(400).json({
            success: false,
            message: "Identifiants requis"
        });
    }

    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const userRef = firestore.collection('USERS').doc(userID);

        const postDoc = await postRef.get();

        const postData = postDoc.data();
        const userData = userDoc.data();

        // Vérifier si l'utilisateur a déjà vu l'annonce
        const hasAlreadyViewed = postData.interactedUsers?.includes(userID);

        if (!hasAlreadyViewed) {
            // Ajouter l'utilisateur à la liste des utilisateurs ayant vu l'annonce
            const uniqueInteractedUsers = new Set([
                ...(postData.interactedUsers || []),
                userID
            ]);

            await adRef.update({
                clicks: admin.firestore.FieldValue.increment(1),
                views: admin.firestore.FieldValue.increment(1),
                interactedUsers: Array.from(uniqueInteractedUsers)
            });
        }

        // Ajouter l'annonce à la liste des annonces vues par l'utilisateur
        const uniqueViewedIDs = new Set([
            ...(userData.adsViewed || []),
            postID
        ]);

        await userRef.update({
            totalAdsViewed: admin.firestore.FieldValue.increment(1),
            adsViewed: Array.from(uniqueViewedIDs),
            categoriesViewed: admin.firestore.FieldValue.arrayUnion(category)
        });

        return res.status(200).json({
            success: true,
            message: "Interaction enregistrée"
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour des interactions'
        });
    }
});



// Route pour mettre à jour Contact Click
router.post('/update/contact-click', async (req, res) => {
    const { userID } = req.body;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "Identifiant requis"
        });
    }

    try {
        const userRef = firestore.collection('USERS').doc(userID);

        await userRef.update({
            profileViewed: admin.firestore.FieldValue.increment(1),
        });
        return res.status(200).json({
            success: true,
            message: "Contact Click enregistré"
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des interactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour des interactions'
        });

    }
});


// Route pour mettre à jour les champs d'un utilisateur
router.put('/update/user/:userID/:field', async (req, res) => {
    const { userID, field } = req.params;
    const { value } = req.body;

    try {
        const result = updateUserByField(userID, field, value)

        if (result) {
            res.status(200).json({ message: 'Mise à jour réussie' });
        } else {
            res.status(400).json({ message: 'Mise à jour a échouée' });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour' });
    }
});



// Route pour vérifier le status de l'utilisateur
router.get('/check/:userID/free-trial-status', async (req, res) => {
    const { userID } = req.params;

    try {
        const userDoc = await firestore.collection('USERS').doc(userID).get();

        if (!userDoc.exists) {
            console.log(`Utilisateur avec l'ID ${userID} non trouvé.`);
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const currentDate = new Date();
        const userData = userDoc.data();
        if (userData.freeTrial && userData.freeTrial.isActive) {
            const endDate = new Date(userData.freeTrial.endDate.seconds * 1000); // Conversion du timestamp Firestore en date JavaScript

            // Vérifier si l'essai est toujours actif
            const isFreeTrialActive = currentDate < endDate;

            // Retourner le statut de la période d'essai
            return res.status(200).json({ isFreeTrialActive });
        } else {
            // Si l'utilisateur n'a pas d'essai gratuit ou si ce n'est plus actif
            return res.status(200).json({ isFreeTrialActive: false });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de la période d\'essai:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


module.exports = router;
