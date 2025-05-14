const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const auth = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(auth);

// Dashboard routes
router.get('/upcoming-deadlines', dashboardController.getUpcomingDeadlines);

module.exports = router;
