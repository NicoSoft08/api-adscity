const express = require('express');

// Importation des contrôleurs
const { createStatus, getStatusByUserID, getAllStatuses } = require('../controllers/statusController');
const { authenticateUser } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route pour obtenir les données de statut
router.post('/create', authenticateUser, createStatus);
router.get('/user/:userID', authenticateUser, getStatusByUserID);
router.get('/all', getAllStatuses);
module.exports = router;