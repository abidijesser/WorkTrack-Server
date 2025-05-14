const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const activityLogController = require("../controllers/activityLogController");

// Apply auth middleware to all routes
router.use(auth);

// Get activity logs
router.get("/project/:projectId", activityLogController.getProjectActivityLogs);
router.get("/task/:taskId", activityLogController.getTaskActivityLogs);
router.get("/user/:userId", activityLogController.getUserActivityLogs);
router.get("/recent", activityLogController.getRecentActivityLogs);
router.get("/comments", activityLogController.getRecentComments);

module.exports = router;
