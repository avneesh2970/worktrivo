const cron = require("node-cron");
const Task = require("../models/Task");
const DailyReport = require("../models/DailyReport");
const Notification = require("../models/Notification");
const SystemSettings = require("../models/SystemSettings");
const { sendInAppNotification, getIo } = require("./socket");
const { logAction } = require("./audit");
const sendEmail = require("./sendEmail");
const User = require("../models/User");
const { getSupervisorsForUser, isUserOnLeave, getEffectiveApproversForUser } = require("./managerHelper");

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
        <p>WorkTrivo Team</p>
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
      task.wasOverdue = true;

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

    // ==========================================
    // AUTO-REJECT UNAPPROVED TASKS & REPORTS ON SAME DAY
    // ==========================================
    await autoRejectUnapprovedItems();

    // ==========================================
    // NOTIFY FALLBACK MANAGERS / ADMINS IF PRIMARY MANAGER IS ON LEAVE
    // ==========================================
    await checkManagerLeaveEscalation();
  } catch (err) {
    console.error("checkReminders error:", err);
  }
};

/**
 * If a task or daily report submitted for approval is not approved by the end of the same calendar day,
 * it is automatically rejected, and email & in-app notifications are sent to the user and their manager(s).
 */
const autoRejectUnapprovedItems = async () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // 1. AUTO-REJECT PENDING TASKS SUBMITTED PRIOR TO TODAY
  try {
    const unapprovedTasks = await Task.find({
      status: "Completed (Pending Approval)",
      $or: [
        { submittedForApprovalAt: { $lt: startOfToday, $ne: null } },
        { submittedForApprovalAt: null, updatedAt: { $lt: startOfToday } }
      ]
    }).populate("assignedTo", "_id name email role")
      .populate("createdBy", "_id name email role");

    for (const task of unapprovedTasks) {
      task.status = "Rejected";
      task.feedback = "Auto-rejected by system: Submission was not approved on the same day.";
      task.autoRejectedAt = now;
      task.activityLogs.push({
        action: "Task Auto-Rejected (Not approved on same day)",
        performedBy: null,
        timestamp: now
      });
      await task.save();

      const io = getIo();
      if (io) {
        task.assignedTo.forEach(u => io.to((u._id || u).toString()).emit("taskUpdated"));
        io.to("admins").emit("taskUpdated");
      }

      // Collect user recipients and manager recipients
      const memberEmails = new Set();
      const managerEmails = new Set();
      const allRecipientUserIds = new Set();

      // Assigned users
      for (const u of task.assignedTo) {
        if (u.email) memberEmails.add(u.email);
        allRecipientUserIds.add(u._id.toString());

        // Get supervisor(s) for this user
        const approvers = await getEffectiveApproversForUser(u._id);
        const managersToAlert = approvers.availableManagers.length > 0
          ? approvers.availableManagers
          : approvers.admins;

        managersToAlert.forEach(m => {
          if (m.email) managerEmails.add(m.email);
          allRecipientUserIds.add(m._id.toString());
        });
      }

      // Also include task creator if creator was a manager
      if (task.createdBy && task.createdBy.email) {
        managerEmails.add(task.createdBy.email);
        allRecipientUserIds.add(task.createdBy._id.toString());
      }

      // In-App Notifications
      for (const uid of allRecipientUserIds) {
        const notif = new Notification({
          userId: uid,
          message: `Task "${task.title}" was automatically rejected because it was not approved on the same day.`,
          type: "rejection",
          taskId: task._id
        });
        await notif.save();
        sendInAppNotification(uid, notif);
      }

      // Send Email to Users
      const userHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #e11d48; margin-top: 0;">Task Submission Auto-Rejected</h2>
          <p>Hello,</p>
          <p>Your task <strong>"${task.title}"</strong> has been automatically rejected because it was not approved on the same day of submission.</p>
          <p><strong>Reason:</strong> Not approved by supervisor/manager within the same calendar day.</p>
          <p>Please review the task, update any required details, and resubmit for approval if necessary.</p>
          <br>
          <p style="color: #64748b; font-size: 13px;">Regards,<br><strong>WorkTrivo Automated Workflow System</strong></p>
        </div>
      `;

      for (const email of memberEmails) {
        sendEmail(email, `[WorkTrivo] Task Auto-Rejected: "${task.title}"`, userHtml).catch(err => {
          console.error(`Email send error for member ${email}:`, err.message);
        });
      }

      // Send Email to Managers
      const mgrHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #e11d48; margin-top: 0;">Notice: Task Auto-Rejected (Unapproved on Same Day)</h2>
          <p>Hello Supervisor / Manager,</p>
          <p>The submission for task <strong>"${task.title}"</strong> was not approved before the end of the submission day and has been automatically marked as <strong>Rejected</strong> by the system.</p>
          <p><strong>Assigned Member(s):</strong> ${task.assignedTo.map(u => u.name).join(", ")}</p>
          <p>The employee has been notified to make any necessary updates and resubmit.</p>
          <br>
          <p style="color: #64748b; font-size: 13px;">Regards,<br><strong>WorkTrivo Automated Workflow System</strong></p>
        </div>
      `;

      for (const email of managerEmails) {
        sendEmail(email, `[WorkTrivo Alert] Task Auto-Rejected: "${task.title}"`, mgrHtml).catch(err => {
          console.error(`Email send error for manager ${email}:`, err.message);
        });
      }
    }
  } catch (taskErr) {
    console.error("Error in autoRejectUnapprovedItems (Tasks):", taskErr.message);
  }

  // 2. AUTO-REJECT PENDING DAILY REPORTS SUBMITTED PRIOR TO TODAY
  try {
    const unapprovedReports = await DailyReport.find({
      status: "Pending",
      reportDate: { $lt: startOfToday }
    }).populate("user", "_id name email role department");

    for (const report of unapprovedReports) {
      report.status = "Rejected";
      report.feedback = "Auto-rejected by system: Daily report was not approved on the same day.";
      report.autoRejectedAt = now;
      await report.save();

      const io = getIo();
      if (io) {
        io.emit("dailyReportUpdated", report);
      }

      const reportAuthor = report.user;
      if (!reportAuthor) continue;

      const approvers = await getEffectiveApproversForUser(reportAuthor._id);
      const managersToAlert = approvers.availableManagers.length > 0
        ? approvers.availableManagers
        : approvers.admins;

      // In-app notifications
      const userNotif = new Notification({
        userId: reportAuthor._id,
        message: `Your daily report for ${new Date(report.reportDate).toLocaleDateString()} was automatically rejected (not approved on the same day).`,
        type: "report",
        reportId: report._id
      });
      await userNotif.save();
      sendInAppNotification(reportAuthor._id, userNotif);

      for (const mgr of managersToAlert) {
        const mgrNotif = new Notification({
          userId: mgr._id,
          message: `Daily report of ${reportAuthor.name} (${new Date(report.reportDate).toLocaleDateString()}) was auto-rejected because it was not approved on the same day.`,
          type: "report",
          reportId: report._id
        });
        await mgrNotif.save();
        sendInAppNotification(mgr._id, mgrNotif);
      }

      // Email Author
      if (reportAuthor.email) {
        const authorHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #e11d48; margin-top: 0;">Daily Report Auto-Rejected</h2>
            <p>Hello ${reportAuthor.name},</p>
            <p>Your daily work report for <strong>${new Date(report.reportDate).toLocaleDateString()}</strong> was not approved before the end of the day and has been automatically set to <strong>Rejected</strong>.</p>
            <p>You can edit and resubmit your report from the Daily Reports section in WorkTrivo.</p>
            <br>
            <p style="color: #64748b; font-size: 13px;">Regards,<br><strong>WorkTrivo Automated Workflow System</strong></p>
          </div>
        `;
        sendEmail(reportAuthor.email, `[WorkTrivo] Daily Report Auto-Rejected (${new Date(report.reportDate).toLocaleDateString()})`, authorHtml).catch(err => {
          console.error(`Email send error for author ${reportAuthor.email}:`, err.message);
        });
      }

      // Email Managers
      const mgrHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #e11d48; margin-top: 0;">Notice: Daily Report Auto-Rejected</h2>
          <p>Hello Supervisor / Manager,</p>
          <p>The daily report submitted by <strong>${reportAuthor.name}</strong> (${reportAuthor.department || "No Department"}) for <strong>${new Date(report.reportDate).toLocaleDateString()}</strong> was not approved on the same day and has been auto-rejected.</p>
          <p>The member has been notified to review and resubmit.</p>
          <br>
          <p style="color: #64748b; font-size: 13px;">Regards,<br><strong>WorkTrivo Automated Workflow System</strong></p>
        </div>
      `;

      for (const mgr of managersToAlert) {
        if (mgr.email) {
          sendEmail(mgr.email, `[WorkTrivo Alert] Daily Report Auto-Rejected for ${reportAuthor.name}`, mgrHtml).catch(err => {
            console.error(`Email send error for manager ${mgr.email}:`, err.message);
          });
        }
      }
    }
  } catch (reportErr) {
    console.error("Error in autoRejectUnapprovedItems (Reports):", reportErr.message);
  }
};

/**
 * Checks pending submissions where the assigned primary manager is currently on approved leave.
 * Automatically delegates notification to another manager or to Admins so approval is not held up.
 */
const checkManagerLeaveEscalation = async () => {
  try {
    const now = new Date();

    // 1. Check pending tasks
    const pendingTasks = await Task.find({
      status: "Completed (Pending Approval)"
    }).populate("assignedTo", "_id name email department");

    for (const task of pendingTasks) {
      for (const member of task.assignedTo) {
        const approverInfo = await getEffectiveApproversForUser(member._id);

        // If primary managers are on leave, escalate to other available managers or admin
        if (approverInfo.fallbackUsed) {
          const delegates = approverInfo.availableManagers.length > 0
            ? approverInfo.availableManagers
            : approverInfo.admins;

          for (const delegate of delegates) {
            const exists = await Notification.findOne({
              userId: delegate._id,
              type: "completed",
              taskId: task._id,
              createdAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) }
            });

            if (!exists) {
              const notif = new Notification({
                userId: delegate._id,
                message: `[Manager on Leave] Task "${task.title}" submitted by ${member.name} is awaiting your approval as primary supervisor is on leave.`,
                type: "completed",
                taskId: task._id
              });
              await notif.save();
              sendInAppNotification(delegate._id, notif);
            }
          }
        }
      }
    }

    // 2. Check pending daily reports
    const pendingReports = await DailyReport.find({
      status: "Pending"
    }).populate("user", "_id name email department");

    for (const report of pendingReports) {
      if (!report.user) continue;
      const approverInfo = await getEffectiveApproversForUser(report.user._id);

      if (approverInfo.fallbackUsed) {
        const delegates = approverInfo.availableManagers.length > 0
          ? approverInfo.availableManagers
          : approverInfo.admins;

        for (const delegate of delegates) {
          const exists = await Notification.findOne({
            userId: delegate._id,
            type: "report",
            reportId: report._id,
            createdAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) }
          });

          if (!exists) {
            const notif = new Notification({
              userId: delegate._id,
              message: `[Manager on Leave] Daily report of ${report.user.name} (${new Date(report.reportDate).toLocaleDateString()}) is awaiting your review as primary manager is on leave.`,
              type: "report",
              reportId: report._id
            });
            await notif.save();
            sendInAppNotification(delegate._id, notif);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in checkManagerLeaveEscalation:", err.message);
  }
};

const startScheduler = () => {
  // Run checks every hour at minute 0
  cron.schedule("0 * * * *", () => {
    checkReminders();
  });

  // Specifically check auto-reject around midnight (23:59 and 00:05) every day
  cron.schedule("59 23 * * *", () => {
    console.log("Running End-of-Day auto-rejection sweep...");
    autoRejectUnapprovedItems();
  });

  cron.schedule("5 0 * * *", () => {
    console.log("Running New-Day auto-rejection sweep...");
    autoRejectUnapprovedItems();
  });

  console.log("Running reminder & auto-rejection check on startup...");
  checkReminders();
};

module.exports = {
  startScheduler,
  checkReminders,
  autoRejectUnapprovedItems,
  checkManagerLeaveEscalation
};