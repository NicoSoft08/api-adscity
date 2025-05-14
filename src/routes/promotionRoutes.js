const express = require('express');

// Importation des controleurs
const { getPromotionLimits, checkPromotionStatus } = require('../controllers/promotionController');

const router = express.Router();

router.get('/limits', getPromotionLimits);
router.get('/active', checkPromotionStatus);

module.exports = router;