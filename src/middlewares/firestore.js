const { storage, firestore } = require('../config/firebase-admin');


// Upload User Profile URL
const uploadProfilURLByUserID = async (userID, file) => {
    if (!file) {
        throw Error('Aucun fichier téléchargé');
    }

    try {
        const bucket = storage.bucket();
        const fileName = `profile-images/${Date.now()}_${file.name}`;

        const fileUpload = bucket.file(fileName);
        await fileUpload.save(file.buffer, {
            metadata: { contentType: file.mimetype },
        });

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

        await firestore.collection('USERS').doc(userID).update({
            profilURL: publicUrl,
        });

        console.log('Profil mis à jour avec succès', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('Erreur lors de l\'upload de la photo:', error);
    }
};


module.exports = {
    uploadProfilURLByUserID,
};