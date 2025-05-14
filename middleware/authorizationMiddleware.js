// Authorization middleware to check user roles
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: User has no role assigned'
      });
    }

    // Log authorization attempt
    console.log('Authorization middleware - Checking role:', req.user.role);
    console.log('Authorization middleware - Required roles:', allowedRoles);

    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      console.log('Authorization middleware - User authorized');
      return next();
    }

    // If not authorized
    console.log('Authorization middleware - Access denied');
    return res.status(403).json({
      success: false,
      error: 'Access denied: Insufficient permissions'
    });
  };
};

module.exports = {
  authorizeRoles
};
