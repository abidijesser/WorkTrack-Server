const Media = require("../models/Media");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../public/uploads/media");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Accept all file types for now
  // You can add restrictions here if needed
  cb(null, true);
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Get all media files
const getAllMedia = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, fileType, project, task } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    if (fileType) {
      query.fileType = fileType;
    }

    if (project) {
      query.project = project;
    }

    if (task) {
      query.task = task;
    }

    // Execute query with pagination
    const media = await Media.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("uploadedBy", "name email")
      .populate("project", "projectName")
      .populate("task", "title");

    // Get total count for pagination
    const total = await Media.countDocuments(query);

    res.status(200).json({
      success: true,
      data: media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllMedia:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching media files",
    });
  }
};

// Get media by ID
const getMediaById = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
      .populate("uploadedBy", "name email")
      .populate("project", "projectName")
      .populate("task", "title");

    if (!media) {
      return res.status(404).json({
        success: false,
        error: "Media not found",
      });
    }

    res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("Error in getMediaById:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching media",
    });
  }
};

// Upload new media
const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const { title, description, project, task, isPublic, tags } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Title is required",
      });
    }

    // Create relative path for storage in DB
    const relativePath = `public/uploads/media/${req.file.filename}`;

    // Determine file type based on mime type
    const fileType = Media.getFileTypeFromMimeType(req.file.mimetype);

    // Create new media document
    const newMedia = new Media({
      title,
      description,
      fileType,
      filePath: relativePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      project: project || null,
      task: task || null,
      isPublic: isPublic === "true" || isPublic === true,
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
    });

    await newMedia.save();

    res.status(201).json({
      success: true,
      data: newMedia,
    });
  } catch (error) {
    console.error("Error in uploadMedia:", error);
    res.status(500).json({
      success: false,
      error: "Error uploading media",
    });
  }
};

// Update media
const updateMedia = async (req, res) => {
  try {
    const { title, description, project, task, isPublic, tags } = req.body;

    // Find media by ID
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({
        success: false,
        error: "Media not found",
      });
    }

    // Check if user is authorized (owner or admin)
    if (
      media.uploadedBy.toString() !== req.user.id &&
      req.user.role !== "Admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this media",
      });
    }

    // Log the update attempt
    console.log(
      `Media update attempt by user ${req.user.id} for media ${req.params.id}`
    );

    // Update fields
    if (title) media.title = title;
    if (description !== undefined) media.description = description;
    if (project !== undefined) media.project = project || null;
    if (task !== undefined) media.task = task || null;
    if (isPublic !== undefined)
      media.isPublic = isPublic === "true" || isPublic === true;
    if (tags !== undefined)
      media.tags = tags ? tags.split(",").map((tag) => tag.trim()) : [];

    await media.save();

    res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("Error in updateMedia:", error);
    res.status(500).json({
      success: false,
      error: "Error updating media",
    });
  }
};

// Delete media
const deleteMedia = async (req, res) => {
  try {
    // Find media by ID
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({
        success: false,
        error: "Media not found",
      });
    }

    // Check if user is authorized (owner or admin)
    if (
      media.uploadedBy.toString() !== req.user.id &&
      req.user.role !== "Admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this media",
      });
    }

    // Log the delete attempt
    console.log(
      `Media delete attempt by user ${req.user.id} for media ${req.params.id}`
    );

    // Delete file from filesystem if filePath exists
    if (media.filePath) {
      const filePath = path.join(__dirname, "..", media.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      console.log(`No file path found for media ${req.params.id}`);
    }

    // Delete from database
    await Media.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Media deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteMedia:", error);
    res.status(500).json({
      success: false,
      error: "Error deleting media",
    });
  }
};

// Get media by project
const getMediaByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const media = await Media.find({ project: projectId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("uploadedBy", "name email");

    const total = await Media.countDocuments({ project: projectId });

    res.status(200).json({
      success: true,
      data: media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getMediaByProject:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching project media",
    });
  }
};

// Get media by task
const getMediaByTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const media = await Media.find({ task: taskId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("uploadedBy", "name email");

    const total = await Media.countDocuments({ task: taskId });

    res.status(200).json({
      success: true,
      data: media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getMediaByTask:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching task media",
    });
  }
};

// Get media by user
const getMediaByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const media = await Media.find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("project", "projectName")
      .populate("task", "title");

    const total = await Media.countDocuments({ uploadedBy: userId });

    res.status(200).json({
      success: true,
      data: media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getMediaByUser:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching user media",
    });
  }
};

module.exports = {
  upload,
  getAllMedia,
  getMediaById,
  uploadMedia,
  updateMedia,
  deleteMedia,
  getMediaByProject,
  getMediaByTask,
  getMediaByUser,
};
