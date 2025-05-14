const express = require('express');

// Importation des controleurs
const { 
    searchItems, 
    manageInteraction, 
    manageContactClick, 
    contactSupportClient, 
    getPostsLocations, 
    advancedSearch, 
    rateUser,
    updateUserSocialLinks,
    incrementViewCount,
    incrementClickCount,
    fetchFilteredPosts,
    hostAdvertising,
    fetchPubs,
    fetchPubById,
    getViewCount,
    logAdminAction,
    logClientAction,
    fetchVerifications,
    incrementShareCount,
    resendVerificationEmail
} = require('../controllers/apiController');
const { verifyToken, authenticateAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/search/items', searchItems);
router.get('/search/filtered', fetchFilteredPosts);
router.get('/search/advanced', advancedSearch);

router.post('/log/:userID/admin/action', logAdminAction);
router.post('/log/:userID/client/action', logClientAction);

router.post('/update/interaction', manageInteraction);
router.post('/update/contact-click', manageContactClick);

router.post('/contact/support-client', contactSupportClient);
router.get('/collect/locations', getPostsLocations);
router.post('/rate/:userID', rateUser);
router.post('/update/:userID/social-links', updateUserSocialLinks);

router.post('/increment/view/:postID', incrementViewCount);
router.post('/increment/click/:postID', incrementClickCount);
router.post('/increment/share/:postID', incrementShareCount);

router.post('/host/pub', hostAdvertising);
router.get('/collect/pubs', fetchPubs);
router.get('/collect/pubs/:pub_id', fetchPubById);
router.get('/get/view/:postID', getViewCount);

router.get('/collect/verifications', authenticateAdmin, fetchVerifications);
router.post('/send/users/:userID/verification', resendVerificationEmail);

module.exports = router;