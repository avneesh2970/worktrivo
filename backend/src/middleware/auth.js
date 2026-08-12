const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Token missing.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'companysecretkey123'
    );

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.'
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated.'
      });
    }

    // Single Device Login Check
    if (
      !decoded.sessionId ||
      !user.activeSessionId ||
      decoded.sessionId !== user.activeSessionId
    ) {
      return res.status(401).json({
        success: false,
        error: 'Your account has been logged in from another device. Please login again.'
      });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    req.user = user;
    req.token = token;

    next();
  } catch (err) {
    console.error('Authentication Error:', err.message);

    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Invalid or expired token.'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};