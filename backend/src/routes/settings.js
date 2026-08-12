const express = require('express');
const SystemSettings = require('../models/SystemSettings');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/settings/public - a trimmed, safe-for-everyone view of settings
// (currently just which integrations are turned on). Any authenticated
// user can call this — e.g. the Profile page needs to know whether to show
// the "Connect Google Calendar" button, without needing admin rights to
// read the full settings document (which also holds the Slack webhook URL
// and other admin-only config).
router.get('/public', async (req, res) => {
  try {
    const settings = await SystemSettings.getSingleton();
    res.json({
      integrations: {
        googleCalendar: { enabled: settings.integrations?.googleCalendar?.enabled || false },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.use(requireRole(['admin']));
// GET /api/settings - fetch the singleton settings document
router.get('/', async (req, res) => {
  try {
    const settings = await SystemSettings.getSingleton();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/settings - update settings. Accepts any subset of the known
// top-level sections; only the keys actually present in the body are
// touched, so a tab can save just its own section without clobbering
// the others.
router.put('/', async (req, res) => {
  const { workingHours, holidays, escalation, notificationRules, integrations } = req.body;

  try {
    const settings = await SystemSettings.getSingleton();

    if (workingHours) {
      if (workingHours.start) settings.workingHours.start = workingHours.start;
      if (workingHours.end) settings.workingHours.end = workingHours.end;
    }

    if (Array.isArray(holidays)) {
      settings.holidays = holidays.map((h) => ({ date: h.date, label: h.label }));
    }

    if (escalation) {
      if (typeof escalation.enabled === 'boolean') settings.escalation.enabled = escalation.enabled;
      if (escalation.daysOverdueForEscalation) {
        settings.escalation.daysOverdueForEscalation = Math.max(1, Number(escalation.daysOverdueForEscalation));
      }
    }

    if (notificationRules) {
      if (notificationRules.reminderHoursBeforeDue) {
        settings.notificationRules.reminderHoursBeforeDue = Math.max(1, Number(notificationRules.reminderHoursBeforeDue));
      }
      if (typeof notificationRules.dailyOverdueReminder === 'boolean') {
        settings.notificationRules.dailyOverdueReminder = notificationRules.dailyOverdueReminder;
      }
    }

    if (integrations) {
      if (integrations.slack) {
        if (typeof integrations.slack.enabled === 'boolean') settings.integrations.slack.enabled = integrations.slack.enabled;
        if (integrations.slack.webhookUrl !== undefined) settings.integrations.slack.webhookUrl = integrations.slack.webhookUrl.trim();
      }
      if (integrations.googleCalendar) {
        if (typeof integrations.googleCalendar.enabled === 'boolean') settings.integrations.googleCalendar.enabled = integrations.googleCalendar.enabled;
      }
      if (integrations.emailToTask) {
        if (typeof integrations.emailToTask.enabled === 'boolean') settings.integrations.emailToTask.enabled = integrations.emailToTask.enabled;
        if (integrations.emailToTask.inboundAddress !== undefined) settings.integrations.emailToTask.inboundAddress = integrations.emailToTask.inboundAddress.trim();
      }
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;