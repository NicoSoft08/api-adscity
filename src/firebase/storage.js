const { storage, firestore, admin } = require("../config/firebase-admin");


const collectUserProfilePhoto = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return null;
        };
        const userData = userDoc.data();
        const { profilURL } = userData;
        if (profilURL === null) {
            return null;
        }
        return profilURL;
    } catch (error) {
        console.error('Erreur lors de la récupération de la photo de profil :', error);
        return null;
    };
};

const uploadUserProfilePicture = async (file, userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        // Vérification de l'existence de l'utilisateur
        if (!userDoc.exists) {
            return {
                success: false,
                message: 'Utilisateur non trouvé',
            };
        }

        const userData = userDoc.data();
        const profilChanges = userData.profilChanges || { count: 0, lastUpdated: null };

        const now = new Date();
        const lastUpdateDate = profilChanges.lastUpdated ? new Date(profilChanges.lastUpdated) : null;
        const isSameMonth = lastUpdateDate && now.getMonth() === lastUpdateDate.getMonth() && now.getFullYear() === lastUpdateDate.getFullYear();

        // Vérification de la limite de changements de profil pour le mois en cours
        if (isSameMonth && profilChanges.count >= 3) {
            return {
                success: false,
                message: 'Vous avez atteint la limite de changement de photo de profil pour ce mois.',
            };
        };

        // Formatage de la date et de l'heure
        const formattedDate = now.toISOString().slice(0, 10); // Format: YYYY-MM-DD
        const formattedTime = now.toTimeString().slice(0, 5).replace(':', '-'); // Format: HH-MM
        const uniqueFolderID = userID;
        const folderPath = `PHOTOS/PROFILES/${formattedDate}_${formattedTime}/${uniqueFolderID}/`;

        // Définir le chemin et le fichier dans Firebase Storage
        const storageRef = storage.bucket().file(`${folderPath}${file.originalname}`);

        await storageRef.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });

        const [publicUrl] = await storageRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });


        // Rendre le fichier public et récupérer l'URL publique
        // const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

        // Mettre à jour les données utilisateur dans Firestore
        await userRef.update({
            profilURL: publicUrl,
            profilChanges: {
                count: isSameMonth ? profilChanges.count + 1 : 1,
                lastUpdated: now.toISOString(),
            },
        });

        return publicUrl;
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la photo de profil :', error);
        return {
            success: false,
            message: 'Erreur lors du téléchargement de la photo de profil.',
            error: error.message,
        };
    };
};

const uploadUserCoverPicture = async (file, userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        // Vérification de l'existence de l'utilisateur
        if (!userDoc.exists) {
            return {
                success: false,
                message: 'Utilisateur non trouvé',
            };
        }

        const userData = userDoc.data();
        const coverChanges = userData.coverChanges || { count: 0, lastUpdated: null };
        const now = new Date();

        const lastUpdateDate = coverChanges.lastUpdated ? new Date(coverChanges.lastUpdated) : null;
        const isSameMonth = lastUpdateDate && now.getMonth() === lastUpdateDate.getMonth() && now.getFullYear() === lastUpdateDate.getFullYear();

        // Vérification de la limite de changements de profil pour le mois en cours
        if (isSameMonth && coverChanges.count >= 3) {
            return {
                success: false,
                message: 'Vous avez atteint la limite de changement de photo de couverture pour ce mois.',
            };
        };

        // Formatage de la date et de l'heure
        const formattedDate = now.toISOString().slice(0, 10); // Format: YYYY-MM-DD
        const formattedTime = now.toTimeString().slice(0, 5).replace(':', '-'); // Format: HH-MM
        const uniqueFolderID = userID;
        const folderPath = `PHOTOS/COVERS/${formattedDate}_${formattedTime}/${uniqueFolderID}/`;

        // Définir le chemin et le fichier dans Firebase Storage
        const storageRef = storage.bucket().file(`${folderPath}${file.originalname}`);

        await storageRef.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });

        const [publicUrl] = await storageRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });


        // Mettre à jour les données utilisateur dans Firestore
        await userRef.update({
            coverURL: publicUrl,
            coverChanges: {
                count: isSameMonth ? coverChanges.count + 1 : 1,
                lastUpdated: now.toISOString(),
            },
        });

        return publicUrl;
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la photo de couverture :', error);
        return {
            success: false,
            message: 'Erreur lors du téléchargement de la photo de couverture.',
            error: error.message,
        };
    };
};

const uploadPostImage = async (file, userID) => {
    try {
        // Formatage de la date et de l'heure
        const now = new Date();
        const formattedDate = now.toISOString().slice(0, 10); // Format: YYYY-MM-DD
        const formattedTime = now.toTimeString().slice(0, 5).replace(':', '-'); // Format: HH-MM
        const uniqueFolderID = userID;
        const folderPath = `PHOTOS/POSTS/${formattedDate}_${formattedTime}/${uniqueFolderID}/`;

        const storageRef = storage.bucket().file(`${folderPath}${file.originalname}`);

        await storageRef.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });

        const [imageUrl] = await storageRef.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });

        return imageUrl;
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image :', error);
        return {
            success: false,
            message: 'Erreur lors du téléchargement de l\'image.',
            error: error.message,
        };
    }
};

const deleteImagesByPostID = async (postID) => {
    try {
        const postRef = firestore.collection('POSTS').doc(postID);
        const postDoc = await postRef.get();
        if (!postDoc.exists) {
            console.log('Post non trouvé');
            return false;
        }

        const postData = postDoc.data();
        const imageURLs = postData.images || [];
        const imagePaths = imageURLs.map((imageURL) => {
            const urlParts = imageURL.split('/');
            const imageName = urlParts[urlParts.length - 1];
            return `PHOTOS/POSTS/${imageName}`;
        });
        await storage.bucket().deleteFiles({
            prefix: imagePaths.join(','),
        });
        console.log('Images supprimées avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression des images :', error);
        return false;
    };
};

const uploadMediaURL = async (file) => {
    try {
        const fileName = `PHOTOS/PUBS_MEDIA/${Date.now()}_${file.originalname}`;
        const fileUpload = storage.bucket().file(fileName);
        await fileUpload.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
            },
        });
        const [imageUrl] = await fileUpload.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });
        return imageUrl;
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image :', error);
        return false;
    }
}

const uploadSensitiveVerificationURL = async (userID, documentFile, selfieFile) => {
    try {
        const folderPath = `DOCS/VERIFICATIONS/${userID}/`;

        // Fonction de téléversement générique
        const uploadFile = async (file, fieldname) => {
            if (!file || !file?.buffer) {
                console.log(`${fieldname} manquant ou buffer vide`);
                return false;
            }

            const fileName = `${folderPath}_${fieldname}`;
            const fileUpload = storage.bucket().file(fileName);

            await fileUpload.save(file.buffer, {
                metadata: {
                    contentType: file.mimetype,
                    encrypted: true,
                },
            });

            const [signedUrl] = await fileUpload.getSignedUrl({
                action: 'read',
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            });

            return signedUrl;
        };

        const documentUrl = await uploadFile(documentFile, 'document');
        const selfieUrl = await uploadFile(selfieFile, 'selfie');

        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return false;
        }

        // 📢 9️⃣ Envoyer une notification à l'admin
        const adminNotificationRef = firestore.collection('ADMIN_NOTIFICATIONS').doc();

        const userData = userDoc.data();
        const { profileNumber, UserID } = userData;

        const batch = firestore.batch();
        batch.update(userRef, {
            verificationStatus: "pending", // states: pending, approved, rejected
            documents: {
                identityDocument: documentUrl,
                selfie: selfieUrl
            },
            updatedAt: new Date(),
        });
        batch.set(adminNotificationRef, {
            type: 'id_verification',
            title: 'Demande de vérification d\'identité',
            message: `Une nouvelle demande de vérification d'identité a été soumise par ${profileNumber}.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            link: `/admin/dashboard/users/${UserID.toLowerCase()}`,
        })
        await batch.commit();

        return {
            documentUrl,
            selfieUrl,
        };
    } catch (error) {
        console.error('❌ Erreur lors du téléchargement des fichiers de vérification :', error);
        return false;
    }
};

const uploadStatusMediaURL = async (userID, file) => {
    try {
        const now = new Date();
        const formattedDate = now.toISOString().slice(0, 10); // Format: YYYY-MM-DD
        const formattedTime = now.toTimeString().slice(0, 5).replace(':', '-'); // Format: HH-MM
        const folderPath = `DOCS/STATUSES/${formattedDate}_${formattedTime}/${userID}/`;
        const fileName = `${folderPath}_${file.originalname}`;
        const fileUpload = storage.bucket().file(fileName);
        await fileUpload.save(file.buffer, {
            metadata: {
                contentType: file.mimetype,
                encrypted: true,
            },
        });
        const [publicUrl] = await fileUpload.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });
        console.log('URL de téléchargement :', publicUrl);
        return publicUrl;
    } catch (error) {
        console.error('Erreur lors du téléchargement du fichier :', error);
        return false;
    }
};

module.exports = {
    deleteImagesByPostID,
    collectUserProfilePhoto,
    uploadPostImage,
    uploadUserCoverPicture,
    uploadMediaURL,
    uploadUserProfilePicture,
    uploadStatusMediaURL,
    uploadSensitiveVerificationURL,
};