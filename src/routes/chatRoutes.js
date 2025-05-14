const express = require('express');

// Importation des controleurs
const { sendMessage, fetchUserMessages, fetchChatMessages, markConversationAsRead } = require('../controllers/chatController');
const { authenticateUser } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/user/:userID', authenticateUser, fetchUserMessages);
router.post('/message/send', authenticateUser, sendMessage);
router.get('/:conversationID/messages', fetchChatMessages);
router.post('/:conversationID/read', authenticateUser, markConversationAsRead);

module.exports = router;