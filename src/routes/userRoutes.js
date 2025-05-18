const express = require('express');

// Importation des controleurs
const { 
    setUserOnline, 
    getUserData, 
    modifyUserFields,
    toggleFavorites,
    getUserFavorites,
    getUserNotifications,
    readUserNotification,
    updateDeviceToken,
    getAllUsersWithStatus,
    getDataFromUserID,
    updateSearchHistory,
    getAnyUserData,
    getUserLoginActivity,
    readUserAllNotifications,
    deleteUserNotification,
    deleteUserAllNotifications,
    getUsers,
    getAdminNotifications,
    readAdminNotification,
    readAdminAllNotifications,
    deleteAdminNotification,
    deleteAdminAllNotifications,
    getUserIDLoginActivity,
    getUserLocations,
    getUserVerificationData,
    updateUserVerificationData,
    fetchMe
} = require('../controllers/userController');
const { verifyToken, authenticateAdmin, authenticateUser, verifyAuthToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route liées à l'uttilisateur
router.get('/me', verifyAuthToken, fetchMe);
router.get('/', authenticateAdmin, getUsers);
router.get('/locations', getUserLocations);
router.get('/all/status', getAllUsersWithStatus);
router.get('/:userID', getUserData);
router.get('/user/:user_id', getDataFromUserID);
router.get('/user/:userID', getAnyUserData);
// router.get('/:interlocutorID', fetchInterlocutorProfile);
router.post('/user/status', authenticateUser, setUserOnline);
router.get('/:userID/favorites', authenticateUser, getUserFavorites);
router.put('/:userID/profile-field/update', verifyToken, modifyUserFields);
router.post('/:userID/favorites/add-remove', toggleFavorites);

router.get('/:userID/admin/notifications', authenticateAdmin, getAdminNotifications);
router.post('/:userID/admin/notifications/:notificationID/read', authenticateAdmin, readAdminNotification);
router.post('/:userID/admin/notifications/read-all', authenticateAdmin, readAdminAllNotifications);

router.get('/:userID/notifications', authenticateUser, getUserNotifications);

router.delete('/:userID/notifications/:notificationID/delete', authenticateUser, deleteUserNotification);
router.delete('/:userID/notifications/delete-all', authenticateUser, deleteUserAllNotifications);

router.delete('/:userID/admin/notifications/:notificationID/delete', authenticateAdmin, deleteAdminNotification);
router.delete('/:userID/admin/notifications/delete-all', authenticateAdmin, deleteAdminAllNotifications);

router.post('/:userID/notifications/:notificationID/read', authenticateUser, readUserNotification);
router.post('/:userID/notifications/read-all', authenticateUser, readUserAllNotifications);

router.post('/update-device-token', verifyToken, updateDeviceToken);
router.post('/:userID/update-search-history', authenticateUser, updateSearchHistory);
router.get('/:userID/login-activity', authenticateUser, getUserLoginActivity);
router.get('/user/:UserID/login-activity', getUserIDLoginActivity);

router.get('/verification/:userID', getUserVerificationData);
router.put('/:userID/admin/update-verification-status', updateUserVerificationData);

module.exports = router;