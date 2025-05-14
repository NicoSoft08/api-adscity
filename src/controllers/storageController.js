const { firestore } = require('../config/firebase-admin');
const { uploadPostImage, uploadUserProfilePicture, collectUserProfilePhoto, deleteImagesByPostID, uploadMediaURL, uploadUserCoverPicture, uploadSensitiveVerificationURL, uploadStatusMediaURL } = require('../firebase/storage');

const getUserProfilePicture = async (req, res) => {
    const { userID } = req.params;

    try {
        const profilURL = await collectUserProfilePhoto(userID);
        if (!profilURL) {
            return res.status(404).json({
                success: false,
                message: 'Photo de profil non trouvée',
            });
        };
        res.status(200).json({
            success: true,
            message: 'Photo de profil récupérée avec succès',
            profilURL: profilURL,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la photo de profil :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard',
        });
    };
};

const uploadImage = async (req, res) => {
    const file = req.file;
    const { userID } = req.body;

    try {
        const imageUrl = await uploadPostImage(file, userID);
        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du téléchargement de l\'image'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Image téléchargée avec succès',
            imageUrl: imageUrl,
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const uploadProfileURL = async (req, res) => {
    const { userID } = req.params;
    const file = req.file;

    try {
        const publicUrl = await uploadUserProfilePicture(file, userID);
        if (!publicUrl) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du téléchargement de l\'image de profile'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Image téléchargée avec succès',
            imageUrl: publicUrl,
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image de profile:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const uploadCoverURL = async (req, res) => {
    const { userID } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({
            success: false,
            message: "Aucun fichier reçu."
        });
    }

    try {
        const publicUrl = await uploadUserCoverPicture(file, userID);
        if (!publicUrl) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du téléchargement de l\'image de couverture'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Image téléchargée avec succès',
            imageUrl: publicUrl,
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image de couverture:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const deletePostImages = async (req, res) => {
    const { postID } = req.params;

    try {
        const deleteResult = await deleteImagesByPostID(postID);
        if (!deleteResult) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la suppression des images du post'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Images du post supprimées avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la suppression des images du post :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

const uploadMedia = async (req, res) => {
    const file = req.file;

    try {
        const url = await uploadMediaURL(file);
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du téléchargement de l\'image de la publicité'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Image téléchargée avec succès',
            imageUrl: url,
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement de l\'image de la publicité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

const uploadSensitiveVerification = async (req, res) => {
    const { userID } = req.body;
    const files = req.files;

    // Check if userID exists
    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "ID utilisateur manquant",
            errorCode: "MISSING_USER_ID"
        });
    }

    // Check if files exist
    if (!files) {
        return res.status(400).json({
            success: false,
            message: "Aucun fichier n'a été téléchargé",
            errorCode: "NO_FILES_UPLOADED"
        });
    }

    // Check if both required files exist
    if (!files.document) {
        return res.status(400).json({
            success: false,
            message: "Document d'identité manquant",
            errorCode: "MISSING_DOCUMENT"
        });
    }

    if (!files.selfie) {
        return res.status(400).json({
            success: false,
            message: "Selfie manquant",
            errorCode: "MISSING_SELFIE"
        });
    }

    const documentFile = files.document[0];
    const selfieFile = files.selfie[0];

    try {
        // Check if user exists in database
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé",
                errorCode: "USER_NOT_FOUND"
            });
        }

        // Check if user already has a pending verification
        const userData = userDoc.data();
        if (userData.verificationStatus === "pending") {
            return res.status(409).json({
                success: false,
                message: "Une demande de vérification est déjà en cours de traitement",
                errorCode: "VERIFICATION_ALREADY_PENDING"
            });
        }

        const publicUrl = await uploadSensitiveVerificationURL(userID, documentFile, selfieFile);

        if (!publicUrl || !publicUrl.documentUrl || !publicUrl.selfieUrl) {
            return res.status(500).json({
                success: false,
                message: "Erreur lors du téléchargement des fichiers de vérification",
                errorCode: "UPLOAD_FAILED"
            });
        }

        // Log successful verification submission
        console.log(`Vérification soumise avec succès pour l'utilisateur ${userID}`);

        res.status(200).json({
            success: true,
            message: "Documents de vérification téléchargés avec succès",
            verificationStatus: "pending"
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement des fichiers de vérification:', error);

        // Determine specific error type
        let errorMessage = "Erreur technique, réessayez plus tard";
        let errorCode = "INTERNAL_SERVER_ERROR";
        let statusCode = 500;

        if (error.message.includes("Format de document non autorisé") ||
            error.message.includes("Format de selfie non autorisé")) {
            errorMessage = error.message;
            errorCode = "INVALID_FILE_TYPE";
            statusCode = 400;
        } else if (error.code === "storage/unauthorized") {
            errorMessage = "Accès non autorisé au stockage";
            errorCode = "STORAGE_UNAUTHORIZED";
            statusCode = 403;
        } else if (error.code === "storage/quota-exceeded") {
            errorMessage = "Quota de stockage dépassé";
            errorCode = "STORAGE_QUOTA_EXCEEDED";
            statusCode = 507;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            errorCode: errorCode
        });
    }
};

const uploadStatusMedia = async (req, res) => {
    const file = req.file;
    const userID = req.body.userID;

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: 'ID utilisateur manquant'
        });
    }

    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'Média manquant'
        });
    }

    try {
        const publicUrl = await uploadStatusMediaURL(userID, file);
        if (!publicUrl) {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors du téléchargement de la média'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Média téléchargé avec succès',
            publicUrl: publicUrl
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement de la média:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

module.exports = {
    deletePostImages,
    getUserProfilePicture,
    uploadImage,
    uploadCoverURL,
    uploadMedia,
    uploadProfileURL,
    uploadStatusMedia,
    uploadSensitiveVerification,
};