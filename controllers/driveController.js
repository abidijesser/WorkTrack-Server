const User = require("../models/User");
const Media = require("../models/Media");
const fs = require("fs").promises;
const path = require("path");
const googleDriveService = require("../services/googleDriveService");
const multer = require("multer");
const { Readable } = require("stream");

// Configure multer for temporary file storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Get Google Drive authentication URL
const getAuthUrl = async (req, res) => {
  try {
    // Get user ID from query parameter
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error:
          "User ID is required. Please provide it as a query parameter: ?userId=your_user_id",
      });
    }

    console.log(`Generating Google Drive auth URL for user ID: ${userId}`);

    // Load client secrets from a local file specifically for Drive
    const credentialsPath = path.join(
      __dirname,
      "../config/drive-credentials.json"
    );
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Loaded Drive-specific credentials");

    // Generate auth URL with user ID in the state parameter
    const authUrl = googleDriveService.getAuthUrl(credentials, userId);

    res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error("Error getting Google Drive auth URL:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Handle Google Drive OAuth callback
const handleCallback = async (req, res) => {
  const { code, state } = req.query;
  console.log("Drive callback received with query params:", req.query);

  // Extract the user ID from the state parameter
  let userId = state;

  // Try to parse the state if it's in JSON format (like from calendar)
  if (state && state.includes("%")) {
    try {
      const decodedState = decodeURIComponent(state);
      const stateObj = JSON.parse(decodedState);
      if (stateObj.userId) {
        userId = stateObj.userId;
        console.log("Extracted userId from JSON state:", userId);
      }
    } catch (error) {
      console.error("Error parsing state parameter:", error);
      // Continue with the original state value
    }
  }

  if (!code) {
    console.error("No authorization code provided in callback");
    return res.status(400).json({
      success: false,
      error: "Authorization code is missing",
    });
  }

  if (!userId) {
    console.error("No user ID provided in callback");
    return res.status(400).json({
      success: false,
      error: "User ID is required",
    });
  }

  try {
    console.log(`Processing Google Drive callback for user ID: ${userId}`);

    // Load client secrets from a local file specifically for Drive
    const credentialsPath = path.join(
      __dirname,
      "../config/drive-credentials.json"
    );
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Loaded Drive-specific credentials for callback");

    // Exchange code for token with explicit redirect URI
    const token = await googleDriveService.getToken(credentials, code);
    console.log("Token obtained successfully");

    // Save token to user
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found with ID: ${userId}`);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.googleDriveToken = token;
    await user.save();
    console.log(`Google Drive token saved for user: ${userId}`);

    // Redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    console.log(`Redirecting to: ${frontendUrl}/#/drive-auth-success`);
    res.redirect(`${frontendUrl}/#/drive-auth-success`);
  } catch (error) {
    console.error("Error handling Google Drive callback:", error);
    console.error("Error details:", error.response?.data || error.message);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/#/drive-auth-error`);
  }
};

// Check if user is authenticated with Google Drive
const checkAuth = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("No user ID in request");
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        details: "No user ID found in request",
      });
    }

    console.log(`Checking Google Drive auth for user ID: ${req.user.id}`);

    const user = await User.findById(req.user.id);
    if (!user) {
      console.error(`User not found with ID: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        error: "User not found",
        details: `No user found with ID: ${req.user.id}`,
      });
    }

    const isAuthenticated = !!user.googleDriveToken;
    console.log(
      `User ${req.user.id} Google Drive auth status: ${
        isAuthenticated ? "Authenticated" : "Not authenticated"
      }`
    );

    res.status(200).json({
      success: true,
      isAuthenticated,
      userId: req.user.id,
    });
  } catch (error) {
    console.error("Error checking Google Drive auth:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Remove Google Drive token
const removeToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.googleDriveToken = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Google Drive token removed successfully",
    });
  } catch (error) {
    console.error("Error removing Google Drive token:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Upload file to Google Drive
const uploadFile = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleDriveToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Drive",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file specifically for Drive
    const credentialsPath = path.join(
      __dirname,
      "../config/drive-credentials.json"
    );
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Loaded Drive-specific credentials for file upload");

    // Try to refresh token if needed
    const refreshResult = await googleDriveService.refreshToken(
      credentials,
      user.googleDriveToken
    );

    if (!refreshResult.success) {
      if (refreshResult.requiresReauth) {
        return res.status(401).json({
          success: false,
          error: "Google Drive authentication expired. Please re-authenticate.",
          code: "REAUTH_REQUIRED",
        });
      }
      return res.status(500).json({
        success: false,
        error: `Error refreshing token: ${refreshResult.error}`,
      });
    }

    // Update user token if it was refreshed
    if (refreshResult.token !== user.googleDriveToken) {
      user.googleDriveToken = refreshResult.token;
      await user.save();
    }

    // Get authorized client
    const auth = googleDriveService.getAuthorizedClient(
      credentials,
      user.googleDriveToken
    );

    // Create file metadata
    const fileMetadata = {
      name: req.file.originalname,
      description: req.body.description || "",
    };

    // Create media object
    const media = {
      mimeType: req.file.mimetype,
      body: Readable.from(req.file.buffer),
    };

    // Upload file to Google Drive
    const uploadResult = await googleDriveService.uploadFile(
      auth,
      fileMetadata,
      media
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: `Error uploading file: ${uploadResult.error}`,
      });
    }

    // Create media record in database
    const fileType = Media.getFileTypeFromMimeType(req.file.mimetype);

    const newMedia = new Media({
      title: req.body.title || req.file.originalname,
      description: req.body.description || "",
      fileType,
      filePath: uploadResult.webViewLink, // Store Google Drive link instead of local path
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      project: req.body.project || null,
      task: req.body.task || null,
      isPublic: req.body.isPublic === "true" || req.body.isPublic === true,
      tags: req.body.tags
        ? req.body.tags.split(",").map((tag) => tag.trim())
        : [],
      // Add Google Drive specific fields
      driveFileId: uploadResult.fileId,
      driveViewLink: uploadResult.webViewLink,
      driveDownloadLink: uploadResult.webContentLink,
    });

    await newMedia.save();

    res.status(201).json({
      success: true,
      data: newMedia,
    });
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// List files from Google Drive
const listFiles = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleDriveToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Drive",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file specifically for Drive
    const credentialsPath = path.join(
      __dirname,
      "../config/drive-credentials.json"
    );
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Loaded Drive-specific credentials for listing files");

    // Try to refresh token if needed
    const refreshResult = await googleDriveService.refreshToken(
      credentials,
      user.googleDriveToken
    );

    if (!refreshResult.success) {
      if (refreshResult.requiresReauth) {
        return res.status(401).json({
          success: false,
          error: "Google Drive authentication expired. Please re-authenticate.",
          code: "REAUTH_REQUIRED",
        });
      }
      return res.status(500).json({
        success: false,
        error: `Error refreshing token: ${refreshResult.error}`,
      });
    }

    // Update user token if it was refreshed
    if (refreshResult.token !== user.googleDriveToken) {
      user.googleDriveToken = refreshResult.token;
      await user.save();
    }

    // Get authorized client
    const auth = googleDriveService.getAuthorizedClient(
      credentials,
      user.googleDriveToken
    );

    // List files from Google Drive
    const options = {
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : 10,
      pageToken: req.query.pageToken || null,
      query: req.query.query || null,
      orderBy: req.query.orderBy || "modifiedTime desc",
    };

    const listResult = await googleDriveService.listFiles(auth, options);

    if (!listResult.success) {
      return res.status(500).json({
        success: false,
        error: `Error listing files: ${listResult.error}`,
      });
    }

    res.status(200).json({
      success: true,
      files: listResult.files,
      nextPageToken: listResult.nextPageToken,
    });
  } catch (error) {
    console.error("Error listing files from Google Drive:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Import a file from Google Drive to the application
const importFile = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleDriveToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Drive",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Validate request body
    const { fileId, title, description, project, isPublic } = req.body;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: "File ID is required",
      });
    }

    // Load client secrets from a local file specifically for Drive
    const credentialsPath = path.join(
      __dirname,
      "../config/drive-credentials.json"
    );
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Loaded Drive-specific credentials for file import");

    // Try to refresh token if needed
    const refreshResult = await googleDriveService.refreshToken(
      credentials,
      user.googleDriveToken
    );

    if (!refreshResult.success) {
      if (refreshResult.requiresReauth) {
        return res.status(401).json({
          success: false,
          error: "Google Drive authentication expired. Please re-authenticate.",
          code: "REAUTH_REQUIRED",
        });
      }
      return res.status(500).json({
        success: false,
        error: `Error refreshing token: ${refreshResult.error}`,
      });
    }

    // Update user token if it was refreshed
    if (refreshResult.token !== user.googleDriveToken) {
      user.googleDriveToken = refreshResult.token;
      await user.save();
    }

    // Get authorized client
    const auth = googleDriveService.getAuthorizedClient(
      credentials,
      user.googleDriveToken
    );

    // Get file details from Google Drive
    const fileDetails = await googleDriveService.getFile(auth, fileId);

    if (!fileDetails.success) {
      return res.status(500).json({
        success: false,
        error: `Error getting file details: ${fileDetails.error}`,
      });
    }

    const file = fileDetails.file;

    // Determine file type based on mimeType
    const fileType = Media.getFileTypeFromMimeType(file.mimeType);

    // Create media record in database
    const newMedia = new Media({
      title: title || file.name,
      description: description || "",
      fileType,
      filePath: file.webViewLink, // Store Google Drive link
      fileName: file.name,
      fileSize: file.size || 0,
      mimeType: file.mimeType,
      uploadedBy: req.user.id,
      project: project || null,
      isPublic: isPublic === true || isPublic === "true",
      // Google Drive specific fields
      driveFileId: file.id,
      driveViewLink: file.webViewLink,
      driveDownloadLink: file.webContentLink,
    });

    await newMedia.save();

    res.status(201).json({
      success: true,
      data: newMedia,
    });
  } catch (error) {
    console.error("Error importing file from Google Drive:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  checkAuth,
  removeToken,
  upload,
  uploadFile,
  listFiles,
  importFile,
};
