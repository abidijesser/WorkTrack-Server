const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const transporter = require("../config/emailConfig");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { uploadProfilePicture } = require("../utils/fileUpload");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Fonction pour générer le QR code pour l'authentification à deux facteurs
const generate2FA = async (req, res) => {
  try {
    console.log("generate2FA - Request received");
    console.log("generate2FA - User ID:", req.user.id);

    const secret = speakeasy.generateSecret({ length: 20 });
    console.log("generate2FA - Secret generated");

    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("generate2FA - User not found");
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.twoFactorSecret = secret.base32;
    await user.save();
    console.log("generate2FA - Secret saved to user");

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        console.error("generate2FA - Error generating QR code:", err);
        return res
          .status(500)
          .json({ success: false, error: "Error generating QR code" });
      }

      console.log("generate2FA - QR code generated successfully");
      res.json({ success: true, qrCode: data_url });
    });
  } catch (error) {
    console.error("generate2FA - Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Error generating 2FA setup" });
  }
};

// Fonction pour vérifier le code d'authentification à deux facteurs
const verify2FA = async (req, res) => {
  try {
    console.log("verify2FA - Request received");
    console.log("verify2FA - User ID:", req.user.id);
    console.log("verify2FA - Request body:", req.body);

    const { token } = req.body;
    console.log("verify2FA - Token received:", token);

    if (!token) {
      console.log("verify2FA - No token provided");
      return res
        .status(400)
        .json({ success: false, error: "Verification token is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("verify2FA - User not found");
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.twoFactorSecret) {
      console.log("verify2FA - No 2FA secret found for user");
      return res
        .status(400)
        .json({ success: false, error: "No 2FA setup found for this user" });
    }

    console.log("verify2FA - Verifying token with details:");
    console.log("verify2FA - Secret:", user.twoFactorSecret);
    console.log("verify2FA - Token:", token);

    // Nettoyer le token
    const cleanToken = token.toString().replace(/\s+/g, "");
    console.log("verify2FA - Cleaned token:", cleanToken);

    // Générer le token actuel pour comparaison
    const currentToken = speakeasy.totp({
      secret: user.twoFactorSecret,
      encoding: "base32",
    });
    console.log("verify2FA - Current expected token:", currentToken);

    // Essayer avec différentes fenêtres de temps
    let verified = false;
    let usedWindow = 0;

    // Essayer avec des fenêtres de plus en plus grandes
    for (let window = 0; window <= 4; window++) {
      const result = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: cleanToken,
        window: window,
      });

      console.log(
        `verify2FA - Verification with window ${window} (${
          window * 30
        } seconds): ${result}`
      );

      if (result) {
        verified = true;
        usedWindow = window;
        break;
      }
    }

    console.log(
      "verify2FA - Final verification result:",
      verified,
      "with window:",
      usedWindow
    );

    if (verified) {
      user.twoFactorEnabled = true;
      await user.save();
      console.log("verify2FA - 2FA enabled successfully");
      res.json({ success: true, message: "2FA enabled successfully" });
    } else {
      console.log("verify2FA - Invalid token");
      res.status(401).json({
        success: false,
        error:
          "Invalid 2FA token. Please make sure you are entering the current code from your authenticator app.",
        debug: {
          expectedToken: currentToken,
          receivedToken: cleanToken,
        },
      });
    }
  } catch (error) {
    console.error("verify2FA - Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Error verifying 2FA token" });
  }
};

// Fonction pour désactiver l'authentification à deux facteurs
const disable2FA = async (req, res) => {
  try {
    console.log("disable2FA - Request received");
    console.log("disable2FA - User ID:", req.user.id);
    console.log("disable2FA - Request body:", req.body);

    const { token } = req.body;
    console.log("disable2FA - Token received:", token);

    // Vérifier si un token est fourni (pour confirmer la désactivation)
    if (!token) {
      console.log("disable2FA - No token provided");
      return res.status(400).json({
        success: false,
        error: "Verification token is required to disable 2FA",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("disable2FA - User not found");
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Vérifier si 2FA est activé
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log("disable2FA - 2FA not enabled for user");
      return res.status(400).json({
        success: false,
        error: "Two-factor authentication is not enabled for this user",
      });
    }

    // Nettoyer le token
    const cleanToken = token.toString().replace(/\s+/g, "");
    console.log("disable2FA - Cleaned token:", cleanToken);

    // Vérifier le token pour confirmer la désactivation
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: cleanToken,
      window: 4, // Utiliser une fenêtre de tolérance plus large
    });

    console.log("disable2FA - Token verification result:", verified);

    if (verified) {
      // Désactiver 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined; // Supprimer le secret
      await user.save();

      console.log("disable2FA - 2FA disabled successfully");
      res.json({
        success: true,
        message: "Two-factor authentication has been disabled",
      });
    } else {
      console.log("disable2FA - Invalid token");
      res.status(401).json({
        success: false,
        error:
          "Invalid verification code. Please enter the current code from your authenticator app.",
      });
    }
  } catch (error) {
    console.error("disable2FA - Error:", error);
    res.status(500).json({
      success: false,
      error: "Error disabling two-factor authentication",
    });
  }
};

async function register(req, res) {
  try {
    console.log("Registration request received:", req.body);
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      console.log("Registration validation failed - missing fields");
      return res.status(400).json({
        success: false,
        error: "Tous les champs sont obligatoires",
      });
    }

    // Vérifier si l'email existe déjà
    const emailExist = await User.findOne({ email });
    if (emailExist) {
      console.log("Registration failed - email already exists:", email);
      return res.status(400).json({
        success: false,
        error: "Email existe déjà",
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    // Créer le nouvel utilisateur
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: "Client", // Force le rôle Client pour l'inscription publique
      isVerified: true, // Pour le moment, on skip la vérification email
    });

    console.log("User created with Client role");

    console.log("Attempting to save new user:", { name, email });
    await user.save();
    console.log("User saved successfully with ID:", user._id);

    // We're not automatically logging in the user after registration anymore
    // So we don't need to generate a token here
    console.log("User registered successfully");

    // Envoyer la réponse sans token
    console.log("Sending successful registration response");
    res.status(201).json({
      success: true,
      message: "Registration successful. Please log in with your credentials.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement",
    });
  }
}

async function login(req, res) {
  try {
    console.log("Login request received:", req.body);
    const { email, password, twoFactorCode } = req.body;
    console.log("Login attempt for email:", email);

    // Validation
    if (!email || !password) {
      console.log("Login validation failed - missing email or password");
      return res.status(400).json({
        success: false,
        error: "Email et mot de passe sont requis",
      });
    }

    // Find the user
    console.log("Searching for user with email:", email);
    const user = await User.findOne({ email });
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      console.log("Login failed - email not found:", email);
      return res.status(400).json({
        success: false,
        error: "Email non trouvé",
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      console.log("Login failed - user is blocked:", email);
      return res.status(403).json({
        success: false,
        error:
          "Votre compte a été bloqué. Veuillez contacter l'administrateur.",
      });
    }

    // Verify the password
    console.log("Verifying password for user:", user.email);
    const isMatched = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatched ? "Yes" : "No");

    if (!isMatched) {
      console.log("Login failed - incorrect password for user:", user.email);
      return res.status(400).json({
        success: false,
        error: "Mot de passe incorrect",
      });
    }

    // Check if 2FA is enabled for this user
    if (user.twoFactorEnabled) {
      console.log("User has 2FA enabled:", user.email);

      // If 2FA code is not provided, return a response indicating 2FA is required
      if (!twoFactorCode) {
        console.log("2FA code not provided, requesting 2FA verification");
        return res.status(200).json({
          success: true,
          requireTwoFactor: true,
          userId: user._id,
          message: "Veuillez entrer le code d'authentification à deux facteurs",
        });
      }

      // Verify the 2FA code
      console.log("Verifying 2FA code:", twoFactorCode);
      console.log("2FA secret for user:", user.twoFactorSecret);

      // Nettoyer le code et ajouter une fenêtre de tolérance
      const cleanCode = twoFactorCode.toString().replace(/\s+/g, "");
      console.log("Cleaned 2FA code:", cleanCode);

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: cleanCode,
        window: 2, // Ajouter une fenêtre de tolérance de 90 secondes
      });

      console.log("2FA verification result:", verified);

      if (!verified) {
        console.log("2FA verification failed for user:", user.email);
        return res.status(400).json({
          success: false,
          error: "Code d'authentification à deux facteurs invalide",
        });
      }

      console.log("2FA verification successful for user:", user.email);
    } else {
      console.log("User does not have 2FA enabled:", user.email);
    }

    // Update last login time
    console.log("Updating last login time for user:", user.email);
    user.lastLogin = new Date();
    await user.save();
    console.log("Last login time updated for user:", user.email);

    // Generate JWT and send response
    console.log("Generating JWT token for user:", user.email);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h", // Augmenter la durée de validité du token à 24 heures
    });
    console.log("JWT token generated successfully with 24h expiration");

    console.log("Login successful for user:", user.email);
    // Return user data (excluding password) along with the token
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled || false,
      profilePicture: user.profilePicture || null,
    };
    console.log("Returning user data:", userData);
    res.status(200).json({ success: true, token, user: userData });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la connexion",
    });
  }
}

const getProfile = async (req, res) => {
  try {
    // The auth middleware already verified the token and attached the user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    // Get the full user data without the password
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching profile",
    });
  }
};

const getProfileById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error in getProfileById:", error);
    res.status(500).json({ error: "Error fetching user profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, skills } = req.body;
    const updateData = {
      name,
      email,
    };

    // Only update skills if they are provided
    if (skills !== undefined) {
      updateData.skills = skills;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({
      success: false,
      error: "Error updating profile",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if the user exists or not for security
      console.log(`Password reset attempt for non-existent email: ${email}`);
      return res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour

    await user.save();

    // Construct reset URL based on user role
    let resetUrl;
    if (user.role === "Admin") {
      // Admin users get the admin application reset URL
      resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    } else {
      // Regular users get the client application reset URL
      resetUrl = `http://localhost:3000/#/reset-password/${resetToken}`;
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ Error sending password reset email:", error);
        // Even if email fails, we don't want to leak info
        // Potentially add internal logging here
        return res
          .status(500)
          .json({ success: false, error: "Error processing request." });
      }
      console.log("✅ Password reset email sent: %s", info.messageId);
      res.json({
        success: true,
        message: "Password reset link has been sent to your email.",
      });
    });
  } catch (error) {
    console.error("❌ Error in forgotPassword:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ success: false, error: "Token and new password are required" });
    }

    // Hash the token from the URL
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by hashed token and check expiration
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Password reset token is invalid or has expired.",
      });
    }

    // Validate new password length (optional but recommended)
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined; // Clear the token fields
    user.resetPasswordExpires = undefined;

    await user.save();

    // Optionally log the user in or send a confirmation email
    console.log("Password reset successful for user:", user.email);

    res.json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("❌ Error in resetPassword:", error);
    res.status(500).json({
      success: false,
      error: "Error resetting password",
      details: error.message, // Keep details for debugging if needed
    });
  }
};

// Fonction pour vérifier l'email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Token invalide ou expiré" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ message: "Email vérifié avec succès" });
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la vérification de l'email" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({
      success: true,
      users: users,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching users",
    });
  }
};

// Fonction spécifique pour l'ajout d'utilisateurs par les administrateurs
const createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // Vérifier si l'email existe déjà
    const emailExist = await User.findOne({ email });
    if (emailExist) {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    // Vérifier les permissions de rôle
    // Seul un admin peut créer un utilisateur admin
    if (role === "Admin" && req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Only admins can create admin users",
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer le nouvel utilisateur
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "Client", // Par défaut, le rôle est Client
      isVerified: true,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error creating user by admin:", error);
    res.status(500).json({
      success: false,
      error: "Error creating user",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, password } = req.body;

    // Find the user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Vérifier les permissions de rôle
    // Seul un super admin peut modifier un utilisateur en admin
    if (role === "Admin" && req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Only super admins can assign Admin role",
      });
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;

    // Only update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error in updateUser:", error);
    res.status(500).json({
      success: false,
      error: "Error updating user",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({
      success: false,
      error: "Error deleting user",
    });
  }
};
// Change password function
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are required",
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Save the user with the new password
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({
      success: false,
      error: "Error changing password",
    });
  }
};

// Upload profile picture
const uploadUserProfilePicture = (req, res) => {
  try {
    // Use the multer middleware to handle the file upload
    uploadProfilePicture(req, res, async (err) => {
      if (err) {
        console.error("Error uploading profile picture:", err);
        return res.status(400).json({
          success: false,
          error: err.message || "Error uploading profile picture",
        });
      }

      // Check if a file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      try {
        // Get the user
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
          // Remove the uploaded file if user not found
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          return res.status(404).json({
            success: false,
            error: "User not found",
          });
        }

        // If user already has a profile picture, delete the old one
        if (user.profilePicture) {
          const oldPicturePath = path.join(
            __dirname,
            "..",
            user.profilePicture
          );
          if (fs.existsSync(oldPicturePath)) {
            fs.unlinkSync(oldPicturePath);
          }
        }

        // Update user with new profile picture path
        // Store the path relative to the server root
        const relativePath = req.file.path.replace(/\\/g, "/");
        user.profilePicture = relativePath;
        await user.save();

        return res.status(200).json({
          success: true,
          message: "Profile picture uploaded successfully",
          profilePicture: relativePath,
        });
      } catch (error) {
        // Remove the uploaded file if there's an error
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        console.error("Error updating user profile picture:", error);
        return res.status(500).json({
          success: false,
          error: "Error updating profile picture",
        });
      }
    });
  } catch (error) {
    console.error("Error in uploadUserProfilePicture:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Fonction pour récupérer les utilisateurs pour le partage de documents
const getUsersForSharing = async (req, res) => {
  try {
    // Récupérer tous les utilisateurs sauf l'utilisateur actuel
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select("_id name email profilePicture")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des utilisateurs pour le partage:",
      error
    );
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des utilisateurs",
    });
  }
};

// Fonction pour bloquer/débloquer un utilisateur
const toggleBlockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { isBlocked } = req.body;

    if (isBlocked === undefined) {
      return res.status(400).json({
        success: false,
        error: "Le statut de blocage est requis",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utilisateur non trouvé",
      });
    }

    // Ne pas permettre de bloquer un administrateur
    if (user.role === "Admin" && isBlocked) {
      return res.status(403).json({
        success: false,
        error: "Impossible de bloquer un administrateur",
      });
    }

    user.isBlocked = isBlocked;
    await user.save();

    res.status(200).json({
      success: true,
      message: isBlocked
        ? "Utilisateur bloqué avec succès"
        : "Utilisateur débloqué avec succès",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error("Erreur lors du blocage/déblocage de l'utilisateur:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du blocage/déblocage de l'utilisateur",
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getProfileById,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  createUserByAdmin,
  generate2FA,
  verify2FA,
  disable2FA,
  uploadUserProfilePicture,
  getUsersForSharing,
  toggleBlockUser,
};
