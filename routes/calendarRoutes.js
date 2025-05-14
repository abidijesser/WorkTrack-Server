const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendarController");
const auth = require("../middleware/auth");

// Google Calendar callback route (no auth required)
router.get("/callback", calendarController.handleCallback);

// Apply authentication middleware to all other routes
router.use(auth);

// Google Calendar authentication routes
router.get("/auth-url", calendarController.getAuthUrl);
router.get("/check-auth", calendarController.checkAuth);
router.post("/remove-token", calendarController.removeToken);

// Sync routes
router.post("/sync-tasks", calendarController.syncTasks);
router.post("/sync-projects", calendarController.syncProjects);
router.post("/sync-task/:taskId", calendarController.syncTask);
router.post("/sync-project/:projectId", calendarController.syncProject);

// Google Meet link generation
router.post("/generate-meet-link", calendarController.generateMeetLink);

module.exports = router;
