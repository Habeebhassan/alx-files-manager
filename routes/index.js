// routes/index.js

const express = require('express');
const AppController = require('../controllers/AppController');

const router = express.Router();

// Define the endpoints and map them to the AppController methods
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

module.exports = router;