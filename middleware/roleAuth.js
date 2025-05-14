const User = require("../models/User");

// Middleware to check if user has admin role
const isAdmin = async (req, res, next) => {
  try {
    // User should already be authenticated by the auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Check if user has admin role
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin role required.",
      });
    }

    next();
  } catch (error) {
    console.error("Role auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Middleware to check if user has client role
const isClient = async (req, res, next) => {
  try {
    // User should already be authenticated by the auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Check if user has client role
    if (req.user.role !== "Client") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Client role required.",
      });
    }

    next();
  } catch (error) {
    console.error("Role auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

module.exports = { isAdmin, isClient };
