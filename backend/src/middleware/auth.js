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

    // Update last seen (throttled to once every 5 minutes, non-blocking)
    const now = new Date();
    if (!user.lastSeen || (now.getTime() - new Date(user.lastSeen).getTime() > 5 * 60 * 1000)) {
      user.lastSeen = now;
      User.updateOne({ _id: user._id }, { $set: { lastSeen: now } }).catch((err) => {
        console.error('Error updating lastSeen:', err.message);
      });
    }

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