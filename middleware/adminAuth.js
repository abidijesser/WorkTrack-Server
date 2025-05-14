/**
 * Middleware pour vérifier si l'utilisateur a le rôle Admin
 */
module.exports = (req, res, next) => {
  console.log("AdminAuth middleware - Request path:", req.path);
  console.log(
    "AdminAuth middleware - User:",
    req.user
      ? { id: req.user._id, email: req.user.email, role: req.user.role }
      : "No user"
  );

  // L'utilisateur est déjà authentifié par le middleware auth
  // Vérifier si l'utilisateur a le rôle Admin
  if (req.user && req.user.role === "Admin") {
    console.log("AdminAuth middleware - User is admin, access granted");
    return next();
  }

  console.log("AdminAuth middleware - Access denied, user is not admin");
  return res.status(403).json({
    success: false,
    error: "Access denied. Admin role required.",
  });
};
