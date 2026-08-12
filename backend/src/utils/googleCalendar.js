const { google } = require('googleapis');
const User = require('../models/User');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// Builds a fresh, unauthenticated OAuth2 client from env config. Requires
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI
// to be set in backend/.env — see the setup notes accompanying this file.
// NOTE: GOOGLE_CLIENT_ID is already used elsewhere for the "Sign in with
// Google" login button (a different, simpler flow — verifying an ID token,
// no refresh tokens). This module reuses that same client ID but needs its
// own CLIENT_SECRET and a dedicated redirect URI because calendar access
// requires the full OAuth2 authorization-code flow, not just ID-token
// verification.
const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Builds the Google consent-screen URL the browser should be sent to.
// `state` carries the logged-in user's id through the redirect so the
// callback (which Google calls directly, with no Authorization header)
// knows which account to attach the resulting tokens to.
const getAuthUrl = (userId) => {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // forces refresh_token on every connect, not just the first
    scope: SCOPES,
    state: userId.toString(),
  });
};

// Exchanges the one-time `code` Google sends back for access/refresh
// tokens and persists them on the user.
const handleOAuthCallback = async (code, userId) => {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  await User.findByIdAndUpdate(userId, {
    googleCalendar: {
      connected: true,
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
};

// Returns an authenticated OAuth2 client for a specific user, wired to
// auto-persist refreshed access tokens back onto that user's record.
// Returns null if the user has never connected their calendar.
const getAuthorizedClientForUser = async (user) => {
  if (!user?.googleCalendar?.connected || !user.googleCalendar.refreshToken) {
    return null;
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
    expiry_date: user.googleCalendar.tokenExpiry ? new Date(user.googleCalendar.tokenExpiry).getTime() : null,
  });

  oauth2Client.on('tokens', async (tokens) => {
    const update = {};
    if (tokens.access_token) update['googleCalendar.accessToken'] = tokens.access_token;
    if (tokens.refresh_token) update['googleCalendar.refreshToken'] = tokens.refresh_token;
    if (tokens.expiry_date) update['googleCalendar.tokenExpiry'] = new Date(tokens.expiry_date);
    if (Object.keys(update).length) {
      await User.findByIdAndUpdate(user._id, update);
    }
  });

  return oauth2Client;
};

const disconnectUser = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    googleCalendar: { connected: false, accessToken: '', refreshToken: '', tokenExpiry: null },
  });
};

// Creates a calendar event for `task` on `user`'s calendar, or updates it
// in place if one already exists (eventId passed in). Returns the event id
// on success, or null if the user isn't connected / the API call fails —
// callers should treat a null return as "sync skipped", not a hard error.
const upsertTaskEvent = async (user, task, existingEventId) => {
  const authClient = await getAuthorizedClientForUser(user);
  if (!authClient) return null;

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const eventBody = {
    summary: `[TaskSphere] ${task.title}`,
    description: task.description || '',
    start: { dateTime: new Date(task.dueDate).toISOString() },
    // Calendar requires start < end; give due-date tasks a 30-minute block.
    end: { dateTime: new Date(new Date(task.dueDate).getTime() + 30 * 60 * 1000).toISOString() },
  };

  try {
    if (existingEventId) {
      const res = await calendar.events.update({
        calendarId: 'primary',
        eventId: existingEventId,
        requestBody: eventBody,
      });
      return res.data.id;
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });
    return res.data.id;
  } catch (err) {
    console.error(`Google Calendar sync failed for user ${user._id}, task ${task._id}:`, err.message);
    return null;
  }
};

const deleteTaskEvent = async (user, eventId) => {
  if (!eventId) return;
  const authClient = await getAuthorizedClientForUser(user);
  if (!authClient) return;

  const calendar = google.calendar({ version: 'v3', auth: authClient });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    // A 410/404 here just means the event was already removed on the
    // Google side (e.g. the person deleted it manually) — not a real error.
    console.error(`Google Calendar delete failed for user ${user._id}, event ${eventId}:`, err.message);
  }
};

module.exports = {
  getAuthUrl,
  handleOAuthCallback,
  disconnectUser,
  upsertTaskEvent,
  deleteTaskEvent,
};