const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUserById,
  getAllProjects,
  getProjectById,
  getAllTasks,
  getDashboardStats,
} = require("../controllers/adminController");
const auth = require("../middleware/auth");
const { isAdmin } = require("../middleware/roleAuth");
const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);
// Apply admin role check to all routes
router.use(isAdmin);

// Admin-only routes

// User management routes
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUserById);

// Project management routes
router.get("/projects", getAllProjects);
router.get("/projects/:id", getProjectById);

// Task management routes
router.get("/tasks", getAllTasks);

// Dashboard statistics
router.get("/dashboard/stats", getDashboardStats);

module.exports = router;
