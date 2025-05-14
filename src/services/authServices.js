const express = require('express');
const router = express.Router();
const { firestore, admin, auth } = require('../config/firebase-admin');
const { createUser, createAdmin } = require("../firebase/auth");
const { sendWelcomeEmail, sendNewDeviceAlert, sendCode } = require('../controllers/emailController');
const { verifyToken, signinUser, getUserData } = require('../controllers/userController');
const { generateVerificationCode } = require('../func');
const verificationCodes = new Map(); // Stocke les codes temporairement


// Route pour créer un administrateur
router.post('/add-new-admin', async (req, res) => {
    const { firstName, lastName, email, phoneNumber, password, permissions } = req.body;
    try {
        const newUser = await createAdmin(firstName, lastName, email, phoneNumber, password, permissions);
        res.status(200).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            user: newUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
        });
    }
});


// Route pour créer un utilisateur
router.post('/create/user', async (req, res) => {
    const { address, city, country, email, password, firstName, lastName, phoneNumber, displayName } = req.body;

    try {
        const newUser = await createUser(address, city, country, email, password, firstName, lastName, phoneNumber, displayName);
        res.status(200).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            user: newUser.userRecord,
            code: newUser.code
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: 'Erreur lors de la création de l\'utilisateur'
        });
    }
});


// Route pour désactiver une utilisateur
router.post('/disable/user/:userID', async (req, res) => {
    const { userID } = req.params;

    try {
        await admin.auth().updateUser(userID, {
            disabled: true,
        });
        console.log(`Utilisateur désactivé avec succès`);
        res.status(200).send('Utilisateur désactivé avec succès');
    } catch (error) {
        console.error("Erreur lors de la désactivation de l'utilisateur:", error);
        res.status(500).send({ message: "Erreur lors de la désactivation de l'utilisateur:", error: error.message });
    }
});



// Route pour connecter un utlisateur
router.post('/signin', async (req, res) => {
    const { email } = req.body;

    try {
        const result = await signinUser(email);

        if (result) {
            res.status(200).json({ message: 'Connexion réussie' });
        } else {
            res.status(400).json({ message: 'Erreur lors de la connexion' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
    }
});


router.post('/check-email-availability', async (req, res) => {
    const { email } = req.body;

    try {
        // Vérifier si l'email existe dans Firebase Authentication
        const isEmailUsed = await auth.getUserByEmail(email);

        if (isEmailUsed) {
            return res.status(200).json({
                success: false,
                message: "L'email est déjà utilisé.",
            });
        }

        // Vérifier si l'email existe dans la collection Firestore USERS (facultatif)
        const userSnapshot = await firestore
            .collection('USERS')
            .where('email', '==', email)
            .get();

        if (!userSnapshot.empty) {
            return res.status(200).json({
                success: false,
                message: "L'email est déjà utilisé.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "L'email est disponible.",
        });
    } catch (error) {
        console.error("Erreur lors de la vérification de l'email :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur interne du serveur.",
        });
    }
});


// Route pour vérifier le Token d'un utilisateur
router.post('/verify/user-token', verifyToken, async (req, res) => {
    try {
        const user = req.user;

        if (!user || !user.uid) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non authentifié',
            });
        }

        if (user.disabled) {
            return res.status(403).json({
                success: false,
                message: 'Compte désactivé',
            });
        }


        const userID = user.uid;
        const userDoc = await firestore.collection('USERS').doc(userID).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable',
            });
        }

        const userData = userDoc.data();
        const { email, displayName, loginCount = 0, role } = userData;

        // Si c'est la première connexion
        if (loginCount === 0) {
            try {
                console.log('Appel à sendWelcomeEmail...');
                await sendWelcomeEmail(displayName, email);
                console.log('Email envoyé.');
            } catch (error) {
                console.error('Erreur lors de l\'envoi de l\'email de bienvenue :', error);
            }

            await admin.firestore().collection('USERS').doc(userID).update({
                loginCount: 1,
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return res.status(200).json({
                success: true,
                message: 'Bienvenue sur votre compte',
                user: { email, displayName, role },
            });
        }

        // Mettre à jour loginCount et lastLoginAt
        await admin.firestore().collection('USERS').doc(userID).update({
            loginCount: admin.firestore.FieldValue.increment(1),
            lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
            success: true,
            message: 'Connexion réussie',
            user: { email, displayName, role },
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du jeton utilisateur :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur',
        });
    }
});


// Route pour autoriser un appareil
// router.post('/verify-device/:deviceID/:verificationToken', verifyToken, async (req, res) => {
//     try {
//         const { deviceID, verificationToken } = req.params;
//         const user = req.user;

//         if (!user || !user.uid) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Utilisateur non authentifié',
//             });
//         }

//         const userID = user.uid;
//         const userDoc = await admin.firestore().collection('USERS').doc(userID).get();

//         if (!userDoc.exists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Utilisateur introuvable',
//             });
//         }

//         const tokenDoc = await admin.firestore().collection('DEVICE_VERIFY_TOKENS').doc(deviceID).get();
//         if (!tokenDoc.exists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Token de vérification introuvable',
//             });
//         }

//         const tokenData = tokenDoc.data();
//         if (tokenData.token !== verificationToken) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Token de vérification invalide',
//             });
//         }

//         if (tokenData.expiresAt < new Date()) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Token de vérification expiré',
//             });
//         }

//         // Désactiver le compte utilisateur
//         await admin.auth().updateUser(userID, { disabled: true });

//         // Approuver l'appareil
//         await admin.firestore()
//             .collection('USERS')
//             .doc(userID)
//             .collection('DEVICES')
//             .doc(deviceID)
//             .update({ isTrusted: true });

//         // Marquer le token comme utilisé
//         await tokenDoc.ref.update({ used: true });

//         res.status(200).json({
//             success: true,
//             message: 'Appareil approuvé avec succès',
//         });
//     } catch (error) {
//         console.error('Erreur lors de la vérification du jeton utilisateur :', error);
//         res.status(500).json({
//             success: false,
//             message: 'Erreur interne du serveur',
//         });
//     }
// });


// Route pour refuser un appareil
// router.post('/decline-device/:deviceID/:verificationToken', verifyToken, async (req, res) => {
//     try {
//         const { deviceID, verificationToken } = req.params;
//         const user = req.user;

//         if (!user || !user.uid) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Utilisateur non authentifié',
//             });
//         }

//         const userID = user.uid;
//         const userDoc = await admin.firestore().collection('USERS').doc(userID).get();

//         if (!userDoc.exists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Utilisateur introuvable',
//             });
//         }

//         const tokenDoc = await admin.firestore().collection('DEVICE_VERIFY_TOKENS').doc(deviceID).get();
//         if (!tokenDoc.exists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Token de vérification introuvable',
//             });
//         }

//         const tokenData = tokenDoc.data();
//         if (tokenData.token !== verificationToken) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Token de vérification invalide',
//             });
//         }

//         if (tokenData.expiresAt < new Date()) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Token de vérification expiré',
//             });
//         }

//         // Désactiver le compte utilisateur
//         await admin.auth().updateUser(userID, { disabled: true });

//         // Marquer le token comme utilisé
//         await tokenDoc.ref.update({ used: true });

//         res.status(200).json({
//             success: true,
//             message: 'Appareil rejeté. Compte sécurisé.',
//         });
//     } catch (error) {
//         console.error('Erreur lors de la vérification du jeton utilisateur :', error);
//         res.status(500).json({
//             success: false,
//             message: 'Erreur interne du serveur',
//         });
//     }
// })


// Route pour supprimer un utilisateur


router.delete('/delete/user/:userID', async (req, res) => {
    const { userID } = req.params;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur manquant',
        });
    };

    try {
        const userRef = firestore.collection('USERS').doc(userID);

        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable',
            });
        };

        await auth.deleteUser(userID);
        await userRef.delete();
        res.status(200).json({
            success: true,
            message: 'Utilisateur supprimé avec succès',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur',
        });
    }
});


// Route pour activer une utilisateur
router.post('/enable/user/:userID', async (req, res) => {
    const { userID } = req.params;

    try {
        await admin.auth().updateUser(userID, {
            disabled: false,
        });
        console.log(`Utilisateur activé avec succès`);
        res.status(200).send('Utilisateur activé avec succès');
    } catch (error) {
        console.error("Erreur lors de la activation de l'utilisateur:", error);
        res.status(500).send({ message: "Erreur lors de la activation de l'utilisateur:", error: error.message });
    }
});


// Route pour déconnecter
router.post('/logout/user', verifyToken, async (req, res) => {
    const user = req.user;
    const userID = user.uid;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur manquant'
        });
    }

    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        await userRef.update({
            lastLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await auth.revokeRefreshTokens(userID);
        console.log(`Déconnexion réussie pour l'utilisateur ${userID}`);

        res.status(200).json({
            success: true,
            message: 'Déconnexion réussie'
        });
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la déconnexion',
            error: error.message
        });
    }
});


// Mettre à jour le mot de passe
router.post('/update-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Email et le nouveau mot de passe sont requis'
        });
    };

    try {
        // Vérifier si l'utilisateur existe
        const userRef = firestore.collection('USERS').where('email', '==', email).limit(1);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Récupérer l'ID de l'utilisateur
        const userID = userDoc.docs[0].id;
        
        // Mettre à jour le mot de passe dans Firebase Authentication
        await auth.updateUser(userID, { password: newPassword });

        res.status(200).json({
            success: true,
            message: 'Mot de passe mis à jour avec succès'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du mot de passe',
            error: error.message
        });
    }
});


router.post('/send-verification-code', async (req, res) => {
    const { userID, newEmail } = req.body;

    if (!userID || !newEmail) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur et l\'adresse e-mail sont requis'
        });
    }

    try {
        const userData = await getUserData(userID);
        const { displayName } = userData;
        const code = generateVerificationCode();
        verificationCodes.set(userID, { newEmail, code });
        await sendCode(displayName, newEmail, code);

        res.status(200).json({
            success: true,
            message: 'Code de vérification envoyé avec succès'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du code de vérification'
        });
    }
});


router.post('/verify-code-and-update-email', async (req, res) => {
    const { userID, verificationCode, newEmail } = req.body;

    if (!userID || !verificationCode) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur et code de vérification manquants'
        });
    }

    const savedCode = verificationCodes.get(userID);
    if (!savedCode || savedCode.code !== verificationCode) {
        res.status(400).send({
            success: false,
            message: "Code de vérification invalide."
        });
    }

    try {
        // Mettre à jour l'email dans Firebase Authentication
        await admin.auth().updateUser(userID, { email: newEmail });

        // Mettre à jour l'email dans Firestore
        const userRef = firestore.collection('USERS').doc(userID);
        await userRef.update({ email: newEmail });

        // Supprimer le code de vérification après succès
        verificationCodes.delete(userID);

        res.status(200).json({
            success: true,
            message: 'Email mis à jour avec succès'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'email'
        });
    }
});




module.exports = router;
