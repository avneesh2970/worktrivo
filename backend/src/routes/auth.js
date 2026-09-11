const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/*
|--------------------------------------------------------------------------
| POST /api/auth/google
|--------------------------------------------------------------------------
*/
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required.'
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const {
      email,
      name,
      picture,
      sub: googleId
    } = payload;

    let user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase().trim(),
        googleId,
        loginProvider: 'google',
        profilePhoto: picture,
        role: 'member',
        active: true
      });
    } else {
      if (!user.loginProvider) {
        user.loginProvider = 'google';
      }

      if (!user.googleId) {
        user.googleId = googleId;
      }

      if (!user.profilePhoto && picture) {
        user.profilePhoto = picture;
      }
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.'
      });
    }

    // Create new session (old device becomes invalid)
    const sessionId = uuidv4();
    const now = new Date();

    user.activeSessionId = sessionId;
    user.lastSeen = now;
    user.lastLoginAt = now;

    await user.save();

    // Background Login Activity Entry
    LoginActivity.create({
      user: user._id,
      name: user.name,
      email: user.email,
      action: 'login',
      loginProvider: 'google',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      loginTime: now
    }).catch(e => console.error('LoginActivity create error:', e.message));

    const appToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        designationRole: user.designationRole,
        sessionId
      },
      process.env.JWT_SECRET || 'companysecretkey123',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.json({
      success: true,
      token: appToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        loginProvider: user.loginProvider,
        profilePhoto: user.profilePhoto,
        employeeId: user.employeeId,
        dob: user.dob,
        gender: user.gender,
        department: user.department,
        workLocation: user.workLocation,
        designationRole: user.designationRole
      }
    });
  } catch (err) {
    console.error('Google Auth Error:', err);

    return res.status(400).json({
      success: false,
      message: 'Invalid or expired Google Token.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/auth/login
|--------------------------------------------------------------------------
*/
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      console.warn(`Login attempt failed for non-existent user: ${email.toLowerCase().trim()}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.'
      });
    }

    // Google account cannot login using password
    if (user.loginProvider === 'google' && !user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'Please sign in using Google.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      console.warn(`Login attempt failed for user: ${user.email} (incorrect password)`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Create new session (old device becomes invalid)
    const sessionId = uuidv4();
    const now = new Date();

    user.activeSessionId = sessionId;
    user.lastSeen = now;
    user.lastLoginAt = now;

    // Fast atomic session update
    User.updateOne({ _id: user._id }, { $set: { activeSessionId: sessionId, lastSeen: now, lastLoginAt: now } }).catch(e => console.error('Session update error:', e.message));

    // Background Login Activity Entry so login response is instant
    LoginActivity.create({
      user: user._id,
      name: user.name,
      email: user.email,
      action: 'login',
      loginProvider: 'local',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      loginTime: now
    }).catch(e => console.error('LoginActivity create error:', e.message));

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        designationRole: user.designationRole,
        sessionId
      },
      process.env.JWT_SECRET || 'companysecretkey123',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        loginProvider: user.loginProvider,
        profilePhoto: user.profilePhoto,
        employeeId: user.employeeId,
        dob: user.dob,
        gender: user.gender,
        department: user.department,
        workLocation: user.workLocation,
        designationRole: user.designationRole
      }
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/auth/logout
|--------------------------------------------------------------------------
*/
router.post('/logout', authenticate, async (req, res) => {
  try {
    if (req.user) {
      // Record logout activity
      await LoginActivity.create({
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        action: 'logout',
        loginProvider: req.user.loginProvider || 'local',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
        logoutTime: new Date()
      });

      // Clear session ID on user record so current token becomes invalid
      req.user.activeSessionId = null;
      await req.user.save();
    }

    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process logout.'
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/auth/me
|--------------------------------------------------------------------------
*/
router.get('/me', authenticate, async (req, res) => {
  return res.json({
    success: true,
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      active: req.user.active,
      loginProvider: req.user.loginProvider,
      profilePhoto: req.user.profilePhoto,
      employeeId: req.user.employeeId,
      dob: req.user.dob,
      gender: req.user.gender,
      department: req.user.department,
      assignedDepartment: req.user.assignedDepartment,
      assignedDepartments: req.user.assignedDepartments,
      assignedMembers: req.user.assignedMembers,
      manager: req.user.manager,
      workLocation: req.user.workLocation,
      designationRole: req.user.designationRole
    }
  });
});

module.exports = router;