const mongoose = require('mongoose');

// Single shared document holding org-wide settings. There should only ever
// be one of these — use SystemSettings.getSingleton() to read/create it
// rather than querying the collection directly.
const systemSettingsSchema = new mongoose.Schema(
  {
    // Reference working hours, "HH:mm" 24h format. Currently informational
    // (shown in the admin panel / usable by future features); not yet
    // enforced anywhere else in the app.
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },

    // Holiday calendar — a simple flat list of dated entries.
    holidays: [
      {
        date: { type: Date, required: true },
        label: { type: String, required: true, trim: true },
      },
    ],

    // Task escalation rules: after a task has been Overdue for this many
    // days, its priority is auto-bumped one level (see utils/reminders.js).
    escalation: {
      enabled: { type: Boolean, default: true },
      daysOverdueForEscalation: { type: Number, default: 2, min: 1 },
    },

    // Notification/reminder timing, read by utils/reminders.js on every
    // cron run so changes here take effect without restarting the server.
    notificationRules: {
      reminderHoursBeforeDue: { type: Number, default: 24, min: 1 },
      dailyOverdueReminder: { type: Boolean, default: true },
    },

    // Integration config placeholders (spec section 15 — "Recommended, not
    // mandatory for MVP"). Toggling these on stores the config, but no
    // live sync logic is wired up yet; that's a separate, larger piece of
    // work (OAuth flows, webhook delivery, etc.) intentionally out of
    // scope here.
    integrations: {
      slack: {
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String, default: '' },
      },
      googleCalendar: {
        enabled: { type: Boolean, default: false },
      },
      emailToTask: {
        enabled: { type: Boolean, default: false },
        inboundAddress: { type: String, default: '' },
      },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Always returns the one settings document, creating it with defaults on
// first access so callers never have to null-check.
systemSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);