const { google } = require("googleapis");
require("dotenv").config();

// Google Calendar API configuration
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const calendar = google.calendar("v3");

// Create a new OAuth2 client
const createOAuth2Client = (credentials, forceRedirectUri = null) => {
  const { client_id, client_secret, redirect_uris } =
    credentials.web || credentials.installed;

  // Use the specified redirect URI or the first one from credentials
  const redirectUri = forceRedirectUri || redirect_uris[0];
  console.log("Using redirect URI:", redirectUri);

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );
  return oAuth2Client;
};

// Get OAuth2 client with token
const getAuthorizedClient = (credentials, token) => {
  const oAuth2Client = createOAuth2Client(credentials);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
};

// Refresh token if expired
const refreshToken = async (credentials, token) => {
  try {
    console.log("Attempting to refresh token...");
    const oAuth2Client = createOAuth2Client(credentials);
    oAuth2Client.setCredentials(token);

    // Check if token is expired or about to expire
    const tokenExpiry = token.expiry_date ? new Date(token.expiry_date) : null;
    const now = new Date();
    const isExpired = tokenExpiry && tokenExpiry <= now;

    if (isExpired && token.refresh_token) {
      console.log("Token is expired, refreshing...");
      const { tokens } = await oAuth2Client.refreshToken(token.refresh_token);
      console.log("Token refreshed successfully");

      // Merge the new tokens with the old ones to preserve the refresh_token if not returned
      const newToken = {
        ...token,
        ...tokens,
        refresh_token: tokens.refresh_token || token.refresh_token,
      };

      return {
        success: true,
        token: newToken,
      };
    }

    return {
      success: true,
      token: token,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);

    // Check for specific error types
    const isInvalidGrant =
      error.message?.includes("invalid_grant") ||
      error.response?.data?.error === "invalid_grant";

    return {
      success: false,
      error: error.message,
      errorCode: isInvalidGrant
        ? "INVALID_GRANT"
        : error.code || "UNKNOWN_ERROR",
      requiresReauth: isInvalidGrant,
      originalError: error,
    };
  }
};

// Generate authorization URL
const getAuthUrl = (credentials, userId = null) => {
  try {
    // Force the calendar callback URL
    const calendarCallbackUrl = "http://localhost:3001/api/calendar/callback";
    const oAuth2Client = createOAuth2Client(credentials, calendarCallbackUrl);

    // Create state parameter with userId if provided
    let state = null;
    if (userId) {
      state = encodeURIComponent(JSON.stringify({ userId }));
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: state,
      redirect_uri: calendarCallbackUrl, // Explicitly set the redirect URI
    });

    console.log("Generated Calendar auth URL:", authUrl);
    console.log("With redirect URI:", calendarCallbackUrl);
    if (userId) console.log("With state (userId):", userId);

    return authUrl;
  } catch (error) {
    console.error("Error generating auth URL:", error);
    throw error;
  }
};

// Exchange code for token
const getToken = async (credentials, code) => {
  try {
    console.log("Exchanging code for token...");

    // Force the calendar callback URL
    const calendarCallbackUrl = "http://localhost:3001/api/calendar/callback";
    const oAuth2Client = createOAuth2Client(credentials, calendarCallbackUrl);

    // Set the redirect_uri explicitly for the token exchange
    const options = {
      code: code,
      redirect_uri: calendarCallbackUrl,
    };

    console.log("Token exchange options:", options);
    const { tokens } = await oAuth2Client.getToken(options);
    console.log("Token obtained successfully");
    return tokens;
  } catch (error) {
    console.error("Error getting token:", error);
    console.error("Error details:", error.response?.data || error.message);
    throw error;
  }
};

// Create a calendar event for a task
const createTaskEvent = async (auth, task) => {
  try {
    const event = {
      summary: `Task: ${task.title}`,
      description: task.description,
      start: {
        dateTime: new Date(task.dueDate).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(
          new Date(task.dueDate).getTime() + 60 * 60 * 1000
        ).toISOString(), // 1 hour after due date
        timeZone: "UTC",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
      colorId: getColorIdByPriority(task.priority),
    };

    const response = await calendar.events.insert({
      auth,
      calendarId: "primary",
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error("Error creating task event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Create a calendar event for a project
const createProjectEvent = async (auth, project) => {
  try {
    const event = {
      summary: `Project: ${project.projectName}`,
      description: project.description,
      start: {
        date: new Date(project.startDate).toISOString().split("T")[0],
        timeZone: "UTC",
      },
      end: {
        date: new Date(
          new Date(project.endDate).getTime() + 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0], // Add one day to include the end date
        timeZone: "UTC",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
      colorId: "9", // Blue
    };

    const response = await calendar.events.insert({
      auth,
      calendarId: "primary",
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error("Error creating project event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Update a calendar event for a task
const updateTaskEvent = async (auth, task, eventId) => {
  try {
    const event = {
      summary: `Task: ${task.title}`,
      description: task.description,
      start: {
        dateTime: new Date(task.dueDate).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(
          new Date(task.dueDate).getTime() + 60 * 60 * 1000
        ).toISOString(), // 1 hour after due date
        timeZone: "UTC",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
      colorId: getColorIdByPriority(task.priority),
    };

    const response = await calendar.events.update({
      auth,
      calendarId: "primary",
      eventId: eventId,
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error("Error updating task event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Update a calendar event for a project
const updateProjectEvent = async (auth, project, eventId) => {
  try {
    const event = {
      summary: `Project: ${project.projectName}`,
      description: project.description,
      start: {
        date: new Date(project.startDate).toISOString().split("T")[0],
        timeZone: "UTC",
      },
      end: {
        date: new Date(
          new Date(project.endDate).getTime() + 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0], // Add one day to include the end date
        timeZone: "UTC",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
      colorId: "9", // Blue
    };

    const response = await calendar.events.update({
      auth,
      calendarId: "primary",
      eventId: eventId,
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error("Error updating project event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Delete a calendar event
const deleteEvent = async (auth, eventId) => {
  try {
    await calendar.events.delete({
      auth,
      calendarId: "primary",
      eventId: eventId,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting event:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get color ID based on task priority
const getColorIdByPriority = (priority) => {
  switch (priority) {
    case "High":
      return "11"; // Red
    case "Medium":
      return "5"; // Yellow
    case "Low":
      return "10"; // Green
    default:
      return "1"; // Blue
  }
};

// Generate a Google Meet link
const generateMeetLink = async (auth, date) => {
  try {
    console.log("Generating Google Meet link...");

    // Create a temporary event with conferencing
    const tempEvent = {
      summary: "Temporary event for Meet link generation",
      description: "This event will be deleted after generating the Meet link",
      start: {
        dateTime: date || new Date().toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(
          new Date(date || Date.now()).getTime() + 30 * 60 * 1000
        ).toISOString(), // 30 minutes after start
        timeZone: "UTC",
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    };

    // Insert the temporary event
    const response = await calendar.events.insert({
      auth,
      calendarId: "primary",
      conferenceDataVersion: 1,
      resource: tempEvent,
    });

    console.log("Temporary event created:", response.data.id);

    // Extract the Meet link
    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

    if (!meetLink) {
      throw new Error("No Meet link found in the response");
    }

    console.log("Meet link generated:", meetLink);

    // Delete the temporary event
    await calendar.events.delete({
      auth,
      calendarId: "primary",
      eventId: response.data.id,
    });

    console.log("Temporary event deleted");

    return {
      success: true,
      meetLink,
    };
  } catch (error) {
    console.error("Error generating Meet link:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  getAuthUrl,
  getToken,
  getAuthorizedClient,
  refreshToken,
  createTaskEvent,
  createProjectEvent,
  updateTaskEvent,
  updateProjectEvent,
  deleteEvent,
  getColorIdByPriority,
  generateMeetLink,
};
