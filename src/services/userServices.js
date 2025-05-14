const express = require('express');
const router = express.Router();
const { firestore, admin } = require("../config/firebase-admin");
const { getUserData, setUserOnlineStatus } = require('../controllers/userController');
const { getUserDevices } = require('../firebase/firestore');


// Route pour récupérer tous les utilisateurs
router.get('/all', async (req, res) => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('USERS').orderBy('createdAt', 'desc');

        const querySnapshot = await adsCollection.get();

        const allUsers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(allUsers);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
    }
});


// Route pour récupérer tous les utilisateurs en ligne
router.get('/online', async (req, res) => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('USERS');
        const querySnapshot = await adsCollection.where('isOnline', '==', true).get();

        const usersOnline = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(usersOnline);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs en ligne:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs en ligne.' });
    }
});


// Route pour récupérer tous les utilisateurs offline
router.get('/offline', async (req, res) => {
    try {
        // Utilisation correcte de Firebase Admin SDK
        const adsCollection = firestore.collection('USERS');
        const querySnapshot = await adsCollection.where('isOnline', '==', false).get();

        const usersOffline = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json(usersOffline);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs offline:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs offline.' });
    }
});


// Route pour récupérer les données d'un Utilisateur
router.get('/user/:userID', async (req, res) => {
    const { userID } = req.params;

    try {
        const userData = await getUserData(userID);
        res.status(200).json(userData);
    } catch (error) {
        console.error('Erreur lors de la récupération des données utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des données utilisateur.'
        });
    }
});


// Route pour mettre à jour le status d'un Utilisateur
router.post('/user/status', async (req, res) => {
    const { userID, isOnline } = req.body;

    try {
        await setUserOnlineStatus(userID, isOnline);
        res.status(200).send({ success: true });
    } catch (error) {
        res.status(500).send({ error: "Erreur lors de la mise à jour de l'état." });
    }
});


// Route pour récupérer les notifications d'un utilisateur
router.get('/:userID/notifications', async (req, res) => {
    const { userID } = req.params;

    try {
        const notificationsSnapshot = await firestore
            .collection('USERS')
            .doc(userID)
            .collection('NOTIFICATIONS')
            .orderBy('timestamp', 'desc')
            .get();

        const notifications = notificationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).send({
            success: true,
            message: 'Notifications récupérées avec succès',
            notifications: notifications,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des notifications :', error);
        res.status(500).send({ message: 'Erreur lors de la récupération des notifications' });
    }
})


// Route pour marquer une notification comme lue
router.post('/:userID/notifications/:notificationID/read', async (req, res) => {
    const { userID, notificationID } = req.params;

    try {
        const notificationRef = firestore
            .collection('USERS')
            .doc(userID)
            .collection('NOTIFICATIONS')
            .doc(notificationID);

        await notificationRef.update({ isRead: true });

        res.status(200).send({ 
            success: true,
            message: 'Notification marquée comme lue' 
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la notification :', error);
        res.status(500).send({ 
            success: false, 
            message: 'Erreur lors de la mise à jour de la notification' 
        });
    }
})



router.get('/auth/verify-device/:deviceId/:token', async (req, res) => {
    const { deviceId, token } = req.params;

    const tokenDoc = await admin.firestore()
        .collection('DEVICE_VERIFY_TOKENS')
        .doc(deviceId)
        .get();

    if (!tokenDoc.exists || tokenDoc.data().token !== token) {
        return res.status(400).json({
            success: false,
            message: 'Token invalide'
        });
    }

    if (tokenDoc.data().used || tokenDoc.data().expiresAt.toDate() < new Date()) {
        return res.status(400).json({
            success: false,
            message: 'Token expiré ou déjà utilisé'
        });
    }

    await admin.firestore()
        .collection('DEVICE_VERIFY_TOKENS')
        .doc(deviceId)
        .update({
            used: true,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });

    return res.status(200).json({
        success: true,
        message: 'Appareil vérifié avec succès'
    });
});



router.get('/auth/decline-device/:deviceId/:token', async (req, res) => {
    const { deviceId, token } = req.params;

    // Mark device as suspicious and notify security team
    await admin.firestore()
        .collection('SUSPICIOUS_DEVICES')
        .add({
            deviceId,
            reportedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'reported'
        });

    return res.status(200).json({
        success: true,
        message: 'Signalement enregistré'
    });
});


// Route pour collecter les résultats d'une recherche
router.get('/search-results', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'La requête de recherche est vide.' });
    }

    try {
        const adsSnapshot = await firestore.collection('POSTS')
            .where('status', '==', 'approved')
            .where('formData.title', '>=', query)
            .where('formData.title', '<=', query + '\uf8ff') // Recherche "LIKE" en Firestore
            .get();


        const ads = [];
        adsSnapshot.forEach(doc => ads.push(doc.data()));

        if (ads.length === 0) {
            return res.status(404).json({ message: 'Aucun résultat trouvé.' });
        }

        return res.json(ads);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        return res.status(500).json({ error: 'Erreur lors de la recherche.' });
    }
});


router.put('/update-profile', async (req, res) => {
    const { userID, updatedFields } = req.body;

    console.log('Received request to update profile:', userID, updatedFields);

    if (!userID) {
        res.status(400).send({
            success: false,
            message: 'L\'ID de l\'utilisateur est requis.'
        })
    };

    try {
        const userRef = firestore.collection('USERS').doc(userID);
        await userRef.update({
            ...updatedFields,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).send({
            success: true,
            message: 'Profil mis à jour avec succès.'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil :', error);
        res.status(500).send({
            success: false,
            message: 'Erreur lors de la mise à jour du profil.'
        });
        
    }
});


router.get('/devices/:userID', async (req, res) => {
    const { userID } = req.params;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur manquant'
        });
    }

    const response = await getUserDevices(userID);

    if (response.success) {
        res.status(200).json({
            success: true,
            message: response.message,
            devices: response.devices
        });
    } else {
        res.status(500).json({
            success: false,
            message: response.message,
        });
    }
});



module.exports = router;