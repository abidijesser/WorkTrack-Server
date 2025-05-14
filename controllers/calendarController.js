const fs = require("fs").promises;
const path = require("path");
const googleCalendarService = require("../services/googleCalendarService");
const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

// Get Google Calendar auth URL
const getAuthUrl = async (req, res) => {
  try {
    console.log("Getting auth URL...");

    // Get user ID from query parameter or from authenticated user
    const userId = req.query.userId || (req.user && req.user.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error:
          "User ID is required. Please provide it as a query parameter: ?userId=your_user_id",
      });
    }

    console.log(`Generating Google Calendar auth URL for user ID: ${userId}`);

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    console.log("Credentials path:", credentialsPath);
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Credentials loaded successfully");

    // Generate auth URL with user ID
    const authUrl = googleCalendarService.getAuthUrl(credentials, userId);

    console.log("Auth URL generated successfully");
    res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error("Error getting auth URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get authorization URL",
      details: error.message,
    });
  }
};

// Handle OAuth callback and get token
const handleCallback = async (req, res) => {
  console.log("Handling OAuth callback...");
  console.log("Query params:", req.query);

  const { code, state } = req.query;

  // Extract userId from state parameter
  let userId;
  if (state) {
    try {
      const stateObj = JSON.parse(decodeURIComponent(state));
      userId = stateObj.userId;
      console.log("Extracted userId from state:", userId);
    } catch (error) {
      console.error("Error parsing state parameter:", error);
    }
  }

  if (!code) {
    console.error("No authorization code provided");
    return res.status(400).json({
      success: false,
      error: "Authorization code is required",
    });
  }

  if (!userId) {
    console.error("No user ID provided");
    return res.status(400).json({
      success: false,
      error: "User ID is required",
    });
  }

  try {
    console.log("Loading credentials...");
    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);
    console.log("Credentials loaded successfully");

    // Exchange code for token
    console.log("Exchanging code for token...");
    const token = await googleCalendarService.getToken(credentials, code);
    console.log("Token obtained successfully");

    // Save token to user
    console.log("Finding user with ID:", userId);
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found with ID:", userId);
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    console.log("User found:", user.email);

    // Save token to user
    console.log("Saving token to user...");
    user.googleCalendarToken = token;
    await user.save();
    console.log("Token saved successfully");

    // Redirect to the calendar sync page with success message
    console.log("Redirecting to calendar sync page with success message");
    // Make sure we're using the correct URL format
    const redirectUrl = "http://localhost:5173/calendar-sync?success=true";
    console.log("Redirect URL:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error handling callback:", error);
    // Redirect to the calendar sync page with error message
    const errorUrl = `http://localhost:5173/calendar-sync?error=${encodeURIComponent(
      error.message
    )}`;
    console.log("Error redirect URL:", errorUrl);
    res.redirect(errorUrl);
  }
};

// Sync tasks with Google Calendar
const syncTasks = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleCalendarToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Calendar",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);

    // Try to refresh token if needed
    const refreshResult = await googleCalendarService.refreshToken(
      credentials,
      user.googleCalendarToken
    );

    if (!refreshResult.success) {
      // If token refresh failed and requires reauthorization
      if (refreshResult.requiresReauth) {
        console.log("Token refresh failed - reauthorization required");
        return res.status(401).json({
          success: false,
          error:
            "Google Calendar authorization expired. Please reconnect your account.",
          code: "REAUTHORIZATION_REQUIRED",
          details: refreshResult.error,
          errorCode: refreshResult.errorCode,
        });
      }

      // Other token refresh errors
      return res.status(500).json({
        success: false,
        error: "Failed to refresh Google Calendar token",
        details: refreshResult.error,
        code: refreshResult.errorCode,
      });
    }

    // Update user's token if it was refreshed
    if (refreshResult.token !== user.googleCalendarToken) {
      user.googleCalendarToken = refreshResult.token;
      await user.save();
      console.log("Updated user's Google Calendar token");
    }

    // Get authorized client with the possibly refreshed token
    const auth = googleCalendarService.getAuthorizedClient(
      credentials,
      user.googleCalendarToken
    );

    // Get tasks assigned to the user
    const tasks = await Task.find({
      assignedTo: req.user.id,
      status: { $ne: "Done" }, // Exclude completed tasks
    }).populate("project", "projectName");

    // Sync each task
    const results = [];
    for (const task of tasks) {
      let result;

      // Check if task already has a calendar event
      if (task.googleCalendarEventId) {
        // Update existing event
        result = await googleCalendarService.updateTaskEvent(
          auth,
          task,
          task.googleCalendarEventId
        );
      } else {
        // Create new event
        result = await googleCalendarService.createTaskEvent(auth, task);

        // Save event ID to task
        if (result.success) {
          task.googleCalendarEventId = result.eventId;
          await task.save();
        }
      }

      results.push({
        taskId: task._id,
        taskTitle: task.title,
        result,
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully synced ${results.length} tasks with Google Calendar`,
      results,
    });
  } catch (error) {
    console.error("Error syncing tasks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync tasks with Google Calendar",
      details: error.message,
    });
  }
};

// Sync projects with Google Calendar
const syncProjects = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleCalendarToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Calendar",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);

    // Try to refresh token if needed
    const refreshResult = await googleCalendarService.refreshToken(
      credentials,
      user.googleCalendarToken
    );

    if (!refreshResult.success) {
      // If token refresh failed and requires reauthorization
      if (refreshResult.requiresReauth) {
        console.log("Token refresh failed - reauthorization required");
        return res.status(401).json({
          success: false,
          error:
            "Google Calendar authorization expired. Please reconnect your account.",
          code: "REAUTHORIZATION_REQUIRED",
          details: refreshResult.error,
          errorCode: refreshResult.errorCode,
        });
      }

      // Other token refresh errors
      return res.status(500).json({
        success: false,
        error: "Failed to refresh Google Calendar token",
        details: refreshResult.error,
        code: refreshResult.errorCode,
      });
    }

    // Update user's token if it was refreshed
    if (refreshResult.token !== user.googleCalendarToken) {
      user.googleCalendarToken = refreshResult.token;
      await user.save();
      console.log("Updated user's Google Calendar token");
    }

    // Get authorized client with the possibly refreshed token
    const auth = googleCalendarService.getAuthorizedClient(
      credentials,
      user.googleCalendarToken
    );

    // Get projects where user is a member or owner
    const projects = await Project.find({
      $or: [{ owner: req.user.id }, { members: req.user.id }],
      status: { $ne: "Archived" }, // Exclude archived projects
    });

    // Sync each project
    const results = [];
    for (const project of projects) {
      let result;

      // Check if project already has a calendar event
      if (project.googleCalendarEventId) {
        // Update existing event
        result = await googleCalendarService.updateProjectEvent(
          auth,
          project,
          project.googleCalendarEventId
        );
      } else {
        // Create new event
        result = await googleCalendarService.createProjectEvent(auth, project);

        // Save event ID to project
        if (result.success) {
          project.googleCalendarEventId = result.eventId;
          await project.save();
        }
      }

      results.push({
        projectId: project._id,
        projectName: project.projectName,
        result,
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully synced ${results.length} projects with Google Calendar`,
      results,
    });
  } catch (error) {
    console.error("Error syncing projects:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync projects with Google Calendar",
      details: error.message,
    });
  }
};

// Sync a specific task with Google Calendar
const syncTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleCalendarToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Calendar",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);

    // Try to refresh token if needed
    const refreshResult = await googleCalendarService.refreshToken(
      credentials,
      user.googleCalendarToken
    );

    if (!refreshResult.success) {
      // If token refresh failed and requires reauthorization
      if (refreshResult.requiresReauth) {
        console.log("Token refresh failed - reauthorization required");
        return res.status(401).json({
          success: false,
          error:
            "Google Calendar authorization expired. Please reconnect your account.",
          code: "REAUTHORIZATION_REQUIRED",
          details: refreshResult.error,
          errorCode: refreshResult.errorCode,
        });
      }

      // Other token refresh errors
      return res.status(500).json({
        success: false,
        error: "Failed to refresh Google Calendar token",
        details: refreshResult.error,
        code: refreshResult.errorCode,
      });
    }

    // Update user's token if it was refreshed
    if (refreshResult.token !== user.googleCalendarToken) {
      user.googleCalendarToken = refreshResult.token;
      await user.save();
      console.log("Updated user's Google Calendar token");
    }

    // Get authorized client with the possibly refreshed token
    const auth = googleCalendarService.getAuthorizedClient(
      credentials,
      user.googleCalendarToken
    );

    // Get task
    const task = await Task.findById(taskId).populate("project", "projectName");
    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    let result;

    // Check if task already has a calendar event
    if (task.googleCalendarEventId) {
      // Update existing event
      result = await googleCalendarService.updateTaskEvent(
        auth,
        task,
        task.googleCalendarEventId
      );
    } else {
      // Create new event
      result = await googleCalendarService.createTaskEvent(auth, task);

      // Save event ID to task
      if (result.success) {
        task.googleCalendarEventId = result.eventId;
        await task.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Successfully synced task with Google Calendar",
      result,
    });
  } catch (error) {
    console.error("Error syncing task:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync task with Google Calendar",
      details: error.message,
    });
  }
};

// Sync a specific project with Google Calendar
const syncProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleCalendarToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Calendar",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);

    // Try to refresh token if needed
    const refreshResult = await googleCalendarService.refreshToken(
      credentials,
      user.googleCalendarToken
    );

    if (!refreshResult.success) {
      // If token refresh failed and requires reauthorization
      if (refreshResult.requiresReauth) {
        console.log("Token refresh failed - reauthorization required");
        return res.status(401).json({
          success: false,
          error:
            "Google Calendar authorization expired. Please reconnect your account.",
          code: "REAUTHORIZATION_REQUIRED",
          details: refreshResult.error,
          errorCode: refreshResult.errorCode,
        });
      }

      // Other token refresh errors
      return res.status(500).json({
        success: false,
        error: "Failed to refresh Google Calendar token",
        details: refreshResult.error,
        code: refreshResult.errorCode,
      });
    }

    // Update user's token if it was refreshed
    if (refreshResult.token !== user.googleCalendarToken) {
      user.googleCalendarToken = refreshResult.token;
      await user.save();
      console.log("Updated user's Google Calendar token");
    }

    // Get authorized client with the possibly refreshed token
    const auth = googleCalendarService.getAuthorizedClient(
      credentials,
      user.googleCalendarToken
    );

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    let result;

    // Check if project already has a calendar event
    if (project.googleCalendarEventId) {
      // Update existing event
      result = await googleCalendarService.updateProjectEvent(
        auth,
        project,
        project.googleCalendarEventId
      );
    } else {
      // Create new event
      result = await googleCalendarService.createProjectEvent(auth, project);

      // Save event ID to project
      if (result.success) {
        project.googleCalendarEventId = result.eventId;
        await project.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Successfully synced project with Google Calendar",
      result,
    });
  } catch (error) {
    console.error("Error syncing project:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync project with Google Calendar",
      details: error.message,
    });
  }
};

// Check if user is authenticated with Google Calendar
const checkAuth = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isAuthenticated = !!user.googleCalendarToken;

    res.status(200).json({
      success: true,
      isAuthenticated,
    });
  } catch (error) {
    console.error("Error checking auth:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check authentication status",
      details: error.message,
    });
  }
};

// Remove Google Calendar token (for when it's invalid)
const removeToken = async (req, res) => {
  try {
    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Remove token
    user.googleCalendarToken = null;
    await user.save();
    console.log("Removed Google Calendar token for user:", user.email);

    res.status(200).json({
      success: true,
      message: "Google Calendar token removed successfully",
    });
  } catch (error) {
    console.error("Error removing token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove Google Calendar token",
      details: error.message,
    });
  }
};

// Generate a Google Meet link
const generateMeetLink = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date is required",
      });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user || !user.googleCalendarToken) {
      return res.status(400).json({
        success: false,
        error: "User not authenticated with Google Calendar",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Load client secrets from a local file
    const credentialsPath = path.join(__dirname, "../config/credentials.json");
    const content = await fs.readFile(credentialsPath);
    const credentials = JSON.parse(content);

    // Try to refresh token if needed
    const refreshResult = await googleCalendarService.refreshToken(
      credentials,
      user.googleCalendarToken
    );

    if (!refreshResult.success) {
      // If token refresh failed and requires reauthorization
      if (refreshResult.requiresReauth) {
        console.log("Token refresh failed - reauthorization required");
        return res.status(401).json({
          success: false,
          error:
            "Google Calendar authorization expired. Please reconnect your account.",
          code: "REAUTHORIZATION_REQUIRED",
          details: refreshResult.error,
          errorCode: refreshResult.errorCode,
        });
      }

      // Other token refresh errors
      return res.status(500).json({
        success: false,
        error: "Failed to refresh Google Calendar token",
        details: refreshResult.error,
        code: refreshResult.errorCode,
      });
    }

    // Update user's token if it was refreshed
    if (refreshResult.token !== user.googleCalendarToken) {
      user.googleCalendarToken = refreshResult.token;
      await user.save();
      console.log("Updated user's Google Calendar token");
    }

    // Get authorized client with the possibly refreshed token
    const auth = googleCalendarService.getAuthorizedClient(
      credentials,
      user.googleCalendarToken
    );

    // Generate Meet link
    const result = await googleCalendarService.generateMeetLink(auth, date);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate Google Meet link",
        details: result.error,
      });
    }

    res.status(200).json({
      success: true,
      meetLink: result.meetLink,
    });
  } catch (error) {
    console.error("Error generating Meet link:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate Google Meet link",
      details: error.message,
    });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  syncTasks,
  syncProjects,
  syncTask,
  syncProject,
  checkAuth,
  removeToken,
  generateMeetLink,
};
