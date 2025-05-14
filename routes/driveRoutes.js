const express = require("express");
const router = express.Router();
const driveController = require("../controllers/driveController");
const auth = require("../middleware/auth");

// Routes that don't require authentication
router.get("/callback", driveController.handleCallback);
router.get("/auth-url", driveController.getAuthUrl);
console.log(
  "Google Drive public routes registered: /api/drive/callback, /api/drive/auth-url"
);

// Apply authentication middleware to all other routes
router.use(auth);
router.get("/check-auth", driveController.checkAuth);
router.post("/remove-token", driveController.removeToken);

// File operations
router.post(
  "/upload",
  driveController.upload.single("file"),
  driveController.uploadFile
);
router.post("/import", driveController.importFile);
router.get("/files", driveController.listFiles);

module.exports = router;
