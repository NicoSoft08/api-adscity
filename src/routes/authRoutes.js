const express = require('express');

// Importation des controleurs
const { 
    registerUser, 
    signoutUser, 
    loginUser, 
    deleteUser, 
    verifyOTPCode,
    changePassword,
    createNewAdmin,
    validateDevice,
    refuseDevice,
    loginAdmin,
    disableUserAccount,
    restoreUserAccount,
    requestPasswordReset,
    verifyResetToken
} = require('../controllers/authController');
const { authenticateAdmin, authenticateUser } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route liées à l'authentification
router.post('/create-user', registerUser);
router.post('/login-user', loginUser);
router.post('/logout-user', signoutUser);
router.delete('/delete-user', deleteUser);
router.post('/disable-user', disableUserAccount);
router.post('/restore-user', restoreUserAccount);
router.post('/verify-code', verifyOTPCode);
// router.post('/verify-device/:deviceID', verifyToken, validateDevice);
// router.post('/decline-device/:deviceID', verifyToken, refuseDevice);
router.post('/update-password', changePassword);
router.post('/new-admin/add', authenticateAdmin, createNewAdmin);
router.post('/request-password-reset', requestPasswordReset);
router.get('/verify-reset-token/:token', verifyResetToken);

module.exports = router;