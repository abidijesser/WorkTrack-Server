const { google } = require("googleapis");
require("dotenv").config();

// Google Drive API configuration
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const drive = google.drive("v3");

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
const getAuthorizedClient = (credentials, token, forceRedirectUri = null) => {
  const oAuth2Client = createOAuth2Client(credentials, forceRedirectUri);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
};

// Refresh token if expired
const refreshToken = async (credentials, token) => {
  try {
    console.log("Attempting to refresh Google Drive token...");

    // Force the drive callback URL
    const driveCallbackUrl = "http://localhost:3001/api/drive/callback";
    const oAuth2Client = createOAuth2Client(credentials, driveCallbackUrl);
    oAuth2Client.setCredentials(token);

    // Check if token is expired or about to expire
    const tokenExpiry = token.expiry_date ? new Date(token.expiry_date) : null;
    const now = new Date();
    const isExpired = tokenExpiry && tokenExpiry <= now;

    if (isExpired && token.refresh_token) {
      console.log("Token is expired, refreshing...");

      try {
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
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);

        // If there's an error with the redirect URI, try with the calendar callback as a fallback
        if (
          refreshError.message &&
          refreshError.message.includes("redirect_uri_mismatch")
        ) {
          console.log(
            "Trying with calendar callback URI as fallback for refresh..."
          );
          const calendarCallbackUrl =
            "http://localhost:3001/api/calendar/callback";
          const altOAuth2Client = createOAuth2Client(
            credentials,
            calendarCallbackUrl
          );
          altOAuth2Client.setCredentials(token);

          const { tokens } = await altOAuth2Client.refreshToken(
            token.refresh_token
          );
          console.log("Token refreshed successfully with alternative callback");

          // Merge the new tokens with the old ones
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

        throw refreshError;
      }
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
const getAuthUrl = (credentials, userId) => {
  try {
    // Get the exact redirect URI from the credentials file
    const { redirect_uris } = credentials.web || credentials.installed;

    // Find the drive callback URL in the authorized redirect URIs
    const driveCallbackUrl = redirect_uris.find((uri) =>
      uri.includes("/api/drive/callback")
    );

    if (!driveCallbackUrl) {
      throw new Error("No authorized redirect URI found for Drive callback");
    }

    console.log(
      "Using authorized redirect URI from credentials:",
      driveCallbackUrl
    );

    const oAuth2Client = createOAuth2Client(credentials, driveCallbackUrl);

    // Create state parameter with userId
    const state = userId; // Simple state for Drive

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: state, // Pass the user ID in the state parameter
      redirect_uri: driveCallbackUrl, // Explicitly set the redirect URI
    });

    console.log("Generated Google Drive auth URL:", authUrl);
    console.log("With redirect URI:", driveCallbackUrl);
    console.log("And state (userId):", userId);

    return authUrl;
  } catch (error) {
    console.error("Error generating Google Drive auth URL:", error);
    throw error;
  }
};

// Exchange code for token
const getToken = async (credentials, code) => {
  try {
    console.log("Exchanging code for Google Drive token...");

    // Get the exact redirect URIs from the credentials file
    const { redirect_uris } = credentials.web || credentials.installed;

    // Try each authorized redirect URI in order
    for (const redirectUri of redirect_uris) {
      try {
        console.log(`Trying token exchange with redirect URI: ${redirectUri}`);

        const oAuth2Client = createOAuth2Client(credentials, redirectUri);

        // Set the redirect_uri explicitly for the token exchange
        const options = {
          code: code,
          redirect_uri: redirectUri,
        };

        console.log("Token exchange options:", options);

        const { tokens } = await oAuth2Client.getToken(options);
        console.log(
          `Google Drive token obtained successfully with URI: ${redirectUri}`
        );
        return tokens;
      } catch (tokenError) {
        console.error(
          `Error with redirect URI ${redirectUri}:`,
          tokenError.message
        );

        // If it's not a redirect_uri_mismatch error, throw it
        if (!tokenError.message.includes("redirect_uri_mismatch")) {
          throw tokenError;
        }

        // Otherwise, continue to the next URI
        console.log("Trying next redirect URI...");
      }
    }

    // If we've tried all URIs and none worked
    throw new Error("All authorized redirect URIs failed for token exchange");
  } catch (error) {
    console.error("Error getting Google Drive token:", error);
    console.error("Error details:", error.response?.data || error.message);
    throw error;
  }
};

// Upload a file to Google Drive
const uploadFile = async (auth, fileMetadata, media) => {
  try {
    const response = await drive.files.create({
      auth,
      resource: fileMetadata,
      media: media,
      fields: "id,name,webViewLink,webContentLink",
    });

    console.log("File uploaded successfully:", response.data);
    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// List files from Google Drive
const listFiles = async (auth, options = {}) => {
  try {
    const response = await drive.files.list({
      auth,
      pageSize: options.pageSize || 10,
      fields:
        "nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, createdTime, modifiedTime, size)",
      q: options.query || null,
      orderBy: options.orderBy || "modifiedTime desc",
      pageToken: options.pageToken || null,
    });

    return {
      success: true,
      files: response.data.files,
      nextPageToken: response.data.nextPageToken,
    };
  } catch (error) {
    console.error("Error listing files from Google Drive:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get file details
const getFile = async (auth, fileId) => {
  try {
    const response = await drive.files.get({
      auth,
      fileId,
      fields:
        "id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,size,description",
    });

    return {
      success: true,
      file: response.data,
    };
  } catch (error) {
    console.error("Error getting file details from Google Drive:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Delete a file
const deleteFile = async (auth, fileId) => {
  try {
    await drive.files.delete({
      auth,
      fileId,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error);
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
  uploadFile,
  listFiles,
  getFile,
  deleteFile,
};
