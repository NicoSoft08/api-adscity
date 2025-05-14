const express = require('express');

// Importation des controleurs
const { 
    createPost, 
    getPostsData, 
    getPendingPosts, 
    getApprovedPosts, 
    getRefusedPosts, 
    getPostByID, 
    getPostsByUserID, 
    getPendingPostsByUserID, 
    getApprovedPostsByUserID, 
    getRefusedPostsByUserID, 
    getActivePostsByUserID, 
    getOutdatedPostsByUserID, 
    getPostsByCategoryName, 
    getRelatedPosts, 
    reportPostByID,
    updatePost,
    suspendPost,
    markPostAsSold,
    fetchNearbyPosts,
    getDataFromPostID,
    getPosts,
    adminDeletePost,
    adminRefusePost,
    adminApprovePost,
    adminSuspendPost,
    deletePost,
    repostPostByID
} = require('../controllers/postController');
const { verifyToken, authenticateAdmin, authenticateUser } = require('../middlewares/authMiddleware');
// const { collectPostBySlug } = require('../firebase/post');

const router = express.Router();

router.get('/', authenticateAdmin, getPosts);

router.post('/create', authenticateUser, createPost);

router.post('/post/:postID/admin/approve', authenticateAdmin, adminApprovePost);
router.post('/post/:postID/admin/refuse', authenticateAdmin, adminRefusePost);
router.delete('/post/:postID/admin/delete', authenticateAdmin, adminDeletePost);
router.post('/post/:postID/admin/suspend', authenticateAdmin, adminSuspendPost);
router.post('/post/:postID/report', reportPostByID)

router.get('/all', getPostsData);
router.get('/pending', getPendingPosts);
router.get('/approved', getApprovedPosts);
router.get('/refused', getRefusedPosts);

router.get('/post/:postID', getPostByID);
router.get('/:post_id', getDataFromPostID);
// router.get('/:category/:subcategory/:slug', collectPostBySlug);
router.get('/user/:userID', verifyToken, getPostsByUserID);

router.get('/user/:userID/pending', getPendingPostsByUserID);
router.get('/user/:userID/approved', getApprovedPostsByUserID);
router.get('/user/:userID/refused', getRefusedPostsByUserID);
router.get('/user/:UserID/active', getActivePostsByUserID);
router.get('/user/:userID/outdated', getOutdatedPostsByUserID);

router.post('/category', getPostsByCategoryName);
router.post('/related-category', getRelatedPosts);

router.put('/:postID/update', updatePost);
router.delete('/:postID/delete', deletePost);
router.post('/:postID/mark/sold', markPostAsSold);
router.post('/:postID/repost', authenticateUser, repostPostByID);

router.get('/collect/nearby', authenticateUser, fetchNearbyPosts);


module.exports = router;