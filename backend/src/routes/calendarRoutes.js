const express = require('express');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { authenticate } = require('../middleware/auth');
const {
  getAuthUrl,
  handleOAuthCallback,
  disconnectUser,
} = require('../utils/googleCalendar');

const router = express.Router();

// GET /api/calendar/google/status - is the org-wide feature enabled, and
// has THIS user connected their own account? (authenticated, any role)
router.get('/google/status', authenticate, async (req, res) => {
  try {
    const settings = await SystemSettings.getSingleton();
    res.json({
      featureEnabled: settings.integrations?.googleCalendar?.enabled || false,
      connected: req.user.googleCalendar?.connected || false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/calendar/google/auth-url - returns the Google consent URL to
// redirect the browser to (authenticated, any role — each user connects
// their own account)
router.get('/google/auth-url', authenticate, async (req, res) => {
  try {
    const settings = await SystemSettings.getSingleton();
    if (!settings.integrations?.googleCalendar?.enabled) {
      return res.status(403).json({ error: 'Google Calendar sync is not enabled by your administrator.' });
    }

    const url = getAuthUrl(req.user._id);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/calendar/google/callback - Google redirects the BROWSER here
// directly after consent, with no Authorization header, so the user is
// identified via the `state` param (set to their user id in auth-url
// above) rather than the normal `authenticate` middleware.
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error || !code || !state) {
    return res.redirect(`${clientUrl}/profile?calendar=error`);
  }

  try {
    await handleOAuthCallback(code, state);
    res.redirect(`${clientUrl}/profile?calendar=connected`);
  } catch (err) {
    console.error('Google Calendar OAuth callback failed:', err.message);
    res.redirect(`${clientUrl}/profile?calendar=error`);
  }
});

// POST /api/calendar/google/disconnect
// Revokes the user's Google OAuth tokens and clears the stored credentials.
router.post('/google/disconnect', authenticate, async (req, res) => {
  try {
    await disconnectUser(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Google Calendar disconnected successfully.',
    });
  } catch (err) {
    console.error('Google Calendar disconnect failed:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google Calendar.',
    });
  }
});

module.exports = router;