const jwt = require("jsonwebtoken");
const User = require("../models/User");
const speakeasy = require("speakeasy");

module.exports = async (req, res, next) => {
  try {
    console.log("Auth middleware - Request path:", req.path);
    console.log("Auth middleware - Method:", req.method);

    // Only log headers without sensitive information
    const safeHeaders = { ...req.headers };
    if (safeHeaders.authorization) {
      safeHeaders.authorization =
        safeHeaders.authorization.substring(0, 20) + "...";
    }
    console.log("Auth middleware - Headers:", safeHeaders);

    // Log request body for status update requests
    if (req.path.includes("/status") && req.method === "PUT") {
      console.log(
        "Auth middleware - Request body for status update:",
        req.body
      );
    }

    // Check for token in different places
    let token;

    // 1. Check Authorization header (Bearer token)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. Check cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 3. Check query params (not recommended for production)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    console.log("Auth middleware - Token exists:", !!token);

    if (!token) {
      console.log("Auth middleware - No token provided");
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Verify and decode token
    console.log("Auth middleware - Verifying token");
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Auth middleware - Token decoded successfully");
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError.name, jwtError.message);

      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token has expired",
          code: "TOKEN_EXPIRED",
        });
      } else if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          error: "Invalid token format",
          code: "INVALID_TOKEN",
        });
      } else {
        return res.status(401).json({
          success: false,
          error: "Token verification failed",
          code: "TOKEN_VERIFICATION_FAILED",
        });
      }
    }

    // Get user from database
    console.log("Auth middleware - Finding user with ID:", decoded.id);
    const user = await User.findById(decoded.id);

    if (!user) {
      console.log("Auth middleware - User not found");
      return res.status(401).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log("Auth middleware - User found:", {
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // For Google or Facebook users, ensure they are verified
    if ((user.googleId || user.facebookId) && !user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Note: We no longer check 2FA token for every request
    // 2FA is only verified during login
    // This comment is kept to document the change

    // Add user to request
    req.user = user;
    console.log(
      "Auth middleware - Authentication successful for user:",
      user.email
    );
    console.log("Auth middleware - User role:", user.role);
    console.log(
      "Auth middleware - 2FA enabled:",
      user.twoFactorEnabled || false
    );
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.name, error.message);
    res.status(500).json({
      success: false,
      error: "Authentication error",
      code: "AUTH_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
