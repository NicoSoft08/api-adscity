const express = require('express');

// Importation des controleurs
const { translateController } = require('../controllers/translateController');

const router = express.Router();

router.post('/translate', translateController);

module.exports = router;