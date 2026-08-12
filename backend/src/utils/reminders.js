const cron = require("node-cron");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const SystemSettings = require("../models/SystemSettings");
const { sendInAppNotification } = require("./socket");
const { logAction } = require("./audit");
const sendEmail = require("./sendEmail");
const User = require("../models/User");

const checkReminders = async () => {
  console.log("Reminder Scheduler Running...");

  const now = new Date();

  // Load admin-configurable settings; if unavailable, use defaults.
  let reminderHoursBeforeDue = 24;
  let escalationEnabled = true;
  let daysOverdueForEscalation = 2;
  let dailyOverdueReminder = true;

  try {
    const settings = await SystemSettings.getSingleton();
    reminderHoursBeforeDue =
      settings.notificationRules?.reminderHoursBeforeDue || 24;
    escalationEnabled = settings.escalation?.enabled !== false;
    daysOverdueForEscalation =
      settings.escalation?.daysOverdueForEscalation || 2;
    dailyOverdueReminder =
      settings.notificationRules?.dailyOverdueReminder !== false;
  } catch (settingsErr) {
    console.error(
      "Could not load SystemSettings, using defaults:",
      settingsErr.message
    );
  }

  try {
    // Reminder window
    const reminderStart = new Date(
      now.getTime() + reminderHoursBeforeDue * 60 * 60 * 1000
    );
    const reminderEnd = new Date(
      now.getTime() + (reminderHoursBeforeDue + 1) * 60 * 60 * 1000
    );

    console.log("Current Time :", now);
    console.log("Reminder Start :", reminderStart);
    console.log("Reminder End :", reminderEnd);

    // Deadline reminder
    const upcomingTasks = await Task.find({
      status: {
        $nin: [
          "Approved",
          "Completed",
          "Completed (Pending Approval)",
          "Overdue",
        ],
      },

      deadlineReminderSent: false,

      dueDate: {
        $gte: reminderStart,
        $lte: reminderEnd,
      },
    });

    console.log("Upcoming Tasks Found :", upcomingTasks.length);

    for (const task of upcomingTasks) {
  console.log("Reminder Triggered For :", task.title);

  for (const userId of task.assignedTo) {
    const exists = await Notification.findOne({
      userId,
      type: "reminder",
      message: {
        $regex: new RegExp(
          `due in ${reminderHoursBeforeDue} hours`,
          "i"
        ),
      },
      createdAt: {
        $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    });

    if (exists) continue;

    const message = `Task "${task.title}" is due in ${reminderHoursBeforeDue} hours.`;

    const notification = new Notification({
      userId,
      message,
      type: "reminder",
    });

    await notification.save();
    sendInAppNotification(userId, notification);

    const user = await User.findById(userId);

    if (user?.email) {
      console.log("Sending Reminder Email To :", user.email);

      await sendEmail(
        user.email,
        "⏰ Deadline Approaching",
        `
        <h2>Hello ${user.name},</h2>

        <p>Your task <b>${task.title}</b> is due in ${reminderHoursBeforeDue} hours.</p>

        <p>Please complete it before the deadline.</p>

        <hr>

        <p><b>Due Date :</b> ${new Date(task.dueDate).toLocaleString()}</p>

        <br>

        <p>Regards,</p>
        <p>TaskSphere Team</p>
        `
      );

      console.log("Reminder Email Sent Successfully");
    }
  }

  task.deadlineReminderSent = true;
  await task.save();
  console.log("deadlineReminderSent updated for:", task.title);
}

    // ================================
    // DUE TODAY
    // ================================
    const dueTodayTasks = await Task.find({
      status: {
        $nin: ["Approved", "Completed", "Completed (Pending Approval)"],
      },
      dueDate: {
        $gte: now,
        $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    for (const task of dueTodayTasks) {
      for (const userId of task.assignedTo) {
        const exists = await Notification.findOne({
          userId,
          type: "reminder",
          message: {
            $regex: /due today/i,
          },
        });

        if (exists) continue;

        const notification = new Notification({
          userId,
          message: `Task "${task.title}" is due today.`,
          type: "reminder",
        });

        await notification.save();

        sendInAppNotification(userId, notification);
      }
    }

    // ================================
    // MARK OVERDUE
    // ================================
    const overdueTasks = await Task.find({
      status: {
        $in: ["To Do", "In Progress", "Rejected"],
      },
      dueDate: {
        $lt: now,
      },
    });

    for (const task of overdueTasks) {
      const oldStatus = task.status;

      task.status = "Overdue";

      await task.save();

      await logAction({
        taskId: task._id,
        userId: task.createdBy,
        action: "Status Changed",
        oldValue: oldStatus,
        newValue: "Overdue",
      });

      for (const userId of task.assignedTo) {
        const notification = new Notification({
          userId,
          message: `Task "${task.title}" is now OVERDUE!`,
          type: "overdue",
        });

        await notification.save();

        sendInAppNotification(userId, notification);
      }
    }

    // ================================
    // DAILY OVERDUE REMINDER
    // ================================
    if (dailyOverdueReminder) {
      const overdueReminderTasks = await Task.find({
        status: "Overdue",
      });

      for (const task of overdueReminderTasks) {
        for (const userId of task.assignedTo) {
          const exists = await Notification.findOne({
            userId,
            type: "overdue",
            message: {
              $regex: /remains overdue/i,
            },
            createdAt: {
              $gte: new Date(now.getTime() - 22 * 60 * 60 * 1000),
            },
          });

          if (!exists) {
            const notification = new Notification({
              userId,
              message: `Reminder: Task "${task.title}" remains overdue. Please complete it as soon as possible.`,
              type: "overdue",
            });

            await notification.save();
            sendInAppNotification(userId, notification);
          }
        }
      }
    }

    // ================================
    // PRIORITY ESCALATION
    // ================================
    if (escalationEnabled) {
      const escalationCutoff = new Date(
        now.getTime() - daysOverdueForEscalation * 24 * 60 * 60 * 1000
      );

      const escalationCandidates = await Task.find({
        status: "Overdue",
        dueDate: { $lte: escalationCutoff },
        priority: { $ne: "Urgent" },
      });

      const priorityLadder = {
        Low: "Medium",
        Medium: "High",
        High: "Urgent",
      };

      for (const task of escalationCandidates) {
        const nextPriority = priorityLadder[task.priority];
        if (!nextPriority) continue;

        const oldPriority = task.priority;
        task.priority = nextPriority;

        task.activityLogs.push({
          action: `Priority auto-escalated from ${oldPriority} to ${nextPriority} (overdue ${daysOverdueForEscalation}+ days)`,
          performedBy: task.createdBy,
          timestamp: new Date(),
        });
        await task.save();

        await logAction({
          taskId: task._id,
          userId: task.createdBy,
          action: "Priority Escalated",
          oldValue: oldPriority,
          newValue: nextPriority,
        });

        for (const userId of task.assignedTo) {
          const message = `Task "${task.title}" priority was escalated to ${nextPriority} (overdue ${daysOverdueForEscalation}+ days).`;

          const notification = new Notification({
            userId,
            message,
            type: "overdue",
          });

          await notification.save();
          sendInAppNotification(userId, notification);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};

const startScheduler = () => {
  cron.schedule("0 * * * *", () => {
    checkReminders();
  });

  console.log("Running reminder check on startup...");
  checkReminders();
};

module.exports = {
  startScheduler,
  checkReminders,
};