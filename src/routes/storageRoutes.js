const express = require('express');
const { upload } = require('../func');

// Importation des controleurs
const {
    uploadImage,
    uploadProfileURL,
    getUserProfilePicture,
    deletePostImages,
    uploadMedia,
    uploadCoverURL,
    uploadSensitiveVerification,
    uploadStatusMedia
} = require('../controllers/storageController');
const { authenticateUser } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route liées stockage
router.post('/upload/image', upload.single('image'), authenticateUser, uploadImage);
router.post('/upload/:userID/profile', upload.single('profilURL'), authenticateUser, uploadProfileURL);
router.post('/upload/:userID/cover', upload.single('coverURL'), authenticateUser, uploadCoverURL);
router.get('/user/:userID/profilURL', getUserProfilePicture);
router.delete('/delete/post-images/:postID', deletePostImages);
router.post('/upload/media', upload.single('file'), uploadMedia);
router.post('/upload/sensitive-verification', upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
]), authenticateUser, uploadSensitiveVerification);
router.post('/upload/status-media', upload.single('media'), authenticateUser, uploadStatusMedia);

module.exports = router;