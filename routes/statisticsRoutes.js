const express = require("express");
const router = express.Router();
const statisticsController = require("../controllers/statisticsController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Test route without authentication
router.get("/test", statisticsController.test);

// All other routes require authentication and admin role
router.use(protect);
router.use(authorize("Admin"));

// Get total projects count
router.get("/projects/count", statisticsController.getTotalProjects);

// Get completed tasks count
router.get("/tasks/completed", statisticsController.getCompletedTasks);

// Get tasks due today count
router.get("/tasks/due-today", statisticsController.getTasksDueToday);

// Get active users today count
router.get("/users/active-today", statisticsController.getActiveUsersToday);

// Get all dashboard statistics in one call
router.get("/dashboard", statisticsController.getDashboardStats);

// Get detailed task counts
router.get(
  "/tasks/detailed-counts",
  statisticsController.getDetailedTaskCounts
);

// Get task distribution by project and status
router.get("/tasks/distribution", statisticsController.getTaskDistribution);

module.exports = router;
