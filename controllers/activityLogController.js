const ActivityLog = require("../models/ActivityLog");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;

// Get activity logs for a project
const getProjectActivityLogs = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Validate projectId
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({
        success: false,
        error: "ID de projet invalide",
      });
    }

    // Get activity logs for project
    const activityLogs = await ActivityLog.find({ project: projectId })
      .populate("user", "name email")
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await ActivityLog.countDocuments({ project: projectId });

    res.status(200).json({
      success: true,
      activityLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Error getting project activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des journaux d'activité",
    });
  }
};

// Get activity logs for a task
const getTaskActivityLogs = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Validate taskId
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({
        success: false,
        error: "ID de tâche invalide",
      });
    }

    // Get activity logs for task
    const activityLogs = await ActivityLog.find({ task: taskId })
      .populate("user", "name email")
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await ActivityLog.countDocuments({ task: taskId });

    res.status(200).json({
      success: true,
      activityLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Error getting task activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des journaux d'activité",
    });
  }
};

// Get activity logs for a user
const getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Validate userId
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: "ID d'utilisateur invalide",
      });
    }

    // Get activity logs for user
    const activityLogs = await ActivityLog.find({ user: userId })
      .populate("user", "name email")
      .populate("task", "title")
      .populate("project", "projectName")
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await ActivityLog.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      activityLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Error getting user activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des journaux d'activité",
    });
  }
};

// Get recent activity logs for dashboard
const getRecentActivityLogs = async (req, res) => {
  try {
    const { limit = 20, skip = 0, action = null } = req.query;

    // Build query based on filters
    const query = {};
    if (action && action !== "all") {
      query.action = action;
    }

    // Get recent activity logs with pagination
    const activityLogs = await ActivityLog.find(query)
      .populate("user", "name email")
      .populate("task", "title")
      .populate("project", "projectName")
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await ActivityLog.countDocuments(query);

    console.log(
      `Returning ${activityLogs.length} activity logs (total: ${total})`
    );
    console.log(`Skip: ${skip}, Limit: ${limit}`);
    console.log(`Filter action: ${action || "all"}`);
    console.log(
      `Activity types: ${activityLogs.map((log) => log.action).join(", ")}`
    );

    res.status(200).json({
      success: true,
      activityLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Error getting recent activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des journaux d'activité récents",
    });
  }
};

// Get recent comment activities only
const getRecentComments = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Get recent comment activities only
    const activityLogs = await ActivityLog.find({ action: "COMMENT" })
      .populate("user", "name email")
      .populate("task", "title")
      .populate("project", "projectName")
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      activityLogs,
    });
  } catch (error) {
    console.error("Error getting recent comments:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des commentaires récents",
    });
  }
};

// Create an activity log (internal use only)
const createActivityLog = async (data) => {
  try {
    const activityLog = new ActivityLog(data);
    await activityLog.save();
    return activityLog;
  } catch (error) {
    console.error("Error creating activity log:", error);
    return null;
  }
};

module.exports = {
  getProjectActivityLogs,
  getTaskActivityLogs,
  getUserActivityLogs,
  getRecentActivityLogs,
  getRecentComments,
  createActivityLog,
};
