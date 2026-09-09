const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const { checkReminders } = require('../utils/reminders');
const Group = require("../models/Group");
const { parseVoiceTranscript } = require('../utils/voiceParser');
const { upsertTaskEvent, deleteTaskEvent } = require('../utils/googleCalendar');
const sendEmail = require('../utils/sendEmail');
const {
  sendInAppNotification,
  sendTaskUpdate,
  getIo,
} = require("../utils/socket");
const { getManagedUserIds } = require('../utils/managerHelper');

const router = express.Router();

router.use(authenticate);

// Robust case-insensitive role check
const isManagement = (role) => {
    if (!role) return false;
    return ['admin', 'manager'].includes(role.toLowerCase());
};

// GET /api/tasks/parse-voice
router.post('/parse-voice', requireRole(['admin', 'manager']), async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript is required.' });
  }

  try {
    const users = await User.find({ active: true }, '_id name');
    const parsed = parseVoiceTranscript(transcript, users);

    res.json({
      title: parsed.title,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      assignedTo: parsed.assignees.map((a) => a._id),
      assignedToNames: parsed.assignees.map((a) => a.name),
      warnings: parsed.warnings,
    });
  } catch (err) {
    console.error("POST /api/tasks ERROR:", err);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  }
});

// GET /api/tasks - Search, Filter, Sort tasks
router.get('/', async (req, res) => {
  const { status, priority, dueDate, assignedTo, assignee, search, sortBy } = req.query;
  const query = {};

  if (req.user.role === 'member') {
    query.assignedTo = req.user._id;
  } else if (req.user.role === 'manager') {
    const fullManager = await User.findById(req.user._id);
    const managedIds = await getManagedUserIds(fullManager);
    const teamUserIds = [...managedIds, req.user._id];

    if (assignedTo) {
      query.assignedTo = assignedTo;
    } else if (assignee) {
      const matchedUsers = await User.find(
        {
          _id: { $in: teamUserIds },
          $or: [
            { name: { $regex: assignee, $options: 'i' } },
            { employeeId: { $regex: assignee, $options: 'i' } },
          ],
        },
        '_id'
      );
      query.assignedTo = { $in: matchedUsers.map((u) => u._id) };
    } else if (status === 'Completed (Pending Approval)' || req.query.forApproval === 'true') {
      // In Approvals center, manager only sees tasks of assigned team or tasks they created
      query.$or = [
        { assignedTo: { $in: teamUserIds } },
        { createdBy: req.user._id }
      ];
    } else {
      // General task view for managers: only tasks assigned to team/themselves or created/verbally assigned by them
      query.$or = [
        { assignedTo: { $in: teamUserIds } },
        { createdBy: req.user._id },
        { verballyAssignedBy: req.user._id }
      ];
    }
  } else if (assignedTo) {
    query.assignedTo = assignedTo;
  } else if (assignee) {
    const matchedUsers = await User.find(
      {
        $or: [
          { name: { $regex: assignee, $options: 'i' } },
          { employeeId: { $regex: assignee, $options: 'i' } },
        ],
      },
      '_id'
    );
    query.assignedTo = { $in: matchedUsers.map((u) => u._id) };
  }
  
  if (status === 'pending') {
    query.status = { $in: ['To Do', 'In Progress', 'In Review', 'Completed (Pending Approval)'] };
  } else if (status) {
    query.status = status;
  }
  
  if (priority) query.priority = priority;

  const now = new Date();
  if (dueDate === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    query.dueDate = { $gte: startOfToday, $lte: endOfToday };
  } else if (dueDate === 'overdue') {
    query.dueDate = { $lt: now };
    query.status = { $nin: ['Approved', 'Completed (Pending Approval)'] };
  } else if (dueDate === 'upcoming') {
    query.dueDate = { $gt: now };
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  let sortOptions = { createdAt: -1 };
  if (sortBy) {
    const [field, order] = sortBy.split(':');
    sortOptions = { [field]: order === 'desc' ? -1 : 1 };
  }

  try {
    const tasks = await Task.find(query)
      .populate('assignedTo', '_id name email role active profilePhoto department designationRole')
      .populate('createdBy', '_id name email role profilePhoto department designationRole')
      .populate('verballyAssignedBy', '_id name email role profilePhoto department designationRole')
      .populate('approvedBy', '_id name email role')
      .populate("dependencies", "title status")
      .sort(sortOptions);
    res.json(tasks);
  } catch (err) {
    console.error("GET /api/tasks ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/audit/logs
router.get('/audit/logs', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const logs = await AuditLog.find().populate('userId', '_id name role').populate('taskId', '_id title').sort({ createdAt: -1 }).limit(15);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
  
// GET /api/tasks/sidebar-stats
router.get("/sidebar-stats", async (req, res) => {
  try {
    const query = {};
    if (req.user.role === "member") {
      query.assignedTo = req.user._id;
    }

    const tasks = await Task.find(query);

    const completed = tasks.filter(task => task.status === "Approved").length;
    const overdue = tasks.filter(task => task.status === "Overdue").length;
    const pending = tasks.length - completed - overdue;

    const productivity = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    res.json({ total: tasks.length, completed, pending, overdue, productivity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', '_id name email role active profilePhoto department designationRole')
      .populate('createdBy', '_id name email role profilePhoto department designationRole')
      .populate('verballyAssignedBy', '_id name email role profilePhoto department designationRole')
      .populate('approvedBy', '_id name email role');
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const currentUserId = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");
    const isAssignee = task.assignedTo.some(assignee => {
        const id = assignee._id ? assignee._id.toString() : assignee.toString();
        return id === currentUserId;
    });

    if (req.user.role === 'member' && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden. This task is not assigned to you.' });
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/tasks - Create Task (Admin, Manager, or Member Self-Task)
router.post('/', requireRole(['admin', 'manager', 'member']), async (req, res) => {
  const {
    title,
    description,
    priority,
    status,
    startDate,
    dueDate,
    estimatedHours,
    assignedTo,
    isSelfCreated,
    verballyAssignedBy,
    attachments,
    tags,
    checklist,
    dependencies,
    isRecurring,
    recurringType,
    group
  } = req.body;

  try {
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }
    if (!dueDate) {
      return res.status(400).json({ error: 'Due date is required.' });
    }

    const isMember = req.user.role === 'member';
    const isSelfTask =
      isMember ||
      isSelfCreated === true ||
      (Array.isArray(assignedTo) && assignedTo.length === 1 && assignedTo[0].toString() === req.user._id.toString() && Boolean(verballyAssignedBy));

    let targetAssignees = [];
    let verbalAssignerDoc = null;

    if (isSelfTask) {
      // Self-tasks (by Member or Manager) must specify the Manager or Admin who verbally assigned the task
      if (!verballyAssignedBy) {
        return res.status(400).json({
          error: 'Please select the Manager or Admin who verbally assigned this task to you.'
        });
      }

      verbalAssignerDoc = await User.findById(verballyAssignedBy);
      if (!verbalAssignerDoc || !['admin', 'manager'].includes(verbalAssignerDoc.role)) {
        return res.status(400).json({
          error: 'Invalid verbal assigner. You must select an active Manager or Admin.'
        });
      }

      targetAssignees = [req.user._id];
    } else {
      // Admin or Manager creating task for team members
      if (!assignedTo || !assignedTo.length) {
        return res.status(400).json({ error: 'At least one assignee is required.' });
      }

      // If manager is assigning to team members, ensure they are in their managed team
      if (req.user.role === 'manager') {
        const fullManager = await User.findById(req.user._id);
        const managedIds = await getManagedUserIds(fullManager);
        const teamUserIds = [...managedIds.map(id => id.toString()), req.user._id.toString()];
        const hasInvalidAssignee = assignedTo.some(uid => !teamUserIds.includes(uid.toString()));
        if (hasInvalidAssignee) {
          return res.status(403).json({ error: 'Managers can only assign tasks to their assigned team members.' });
        }
      }

      targetAssignees = assignedTo;

      if (verballyAssignedBy) {
        verbalAssignerDoc = await User.findById(verballyAssignedBy);
      }
    }

    const activityAction = isSelfTask
      ? `Self-Task Created (Verbal assignment by ${verbalAssignerDoc?.name || 'Supervisor'})`
      : 'Task Created';

    const task = new Task({
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority || 'Medium',
      status: status || 'To Do',
      startDate: startDate || null,
      dueDate,
      estimatedHours: estimatedHours || 0,
      assignedTo: targetAssignees,
      isSelfCreated: isSelfTask,
      verballyAssignedBy: verbalAssignerDoc ? verbalAssignerDoc._id : null,
      group: group || null,
      attachments: attachments || [],
      tags: tags || [],
      checklist: checklist || [],
      dependencies: dependencies || [],
      isRecurring: isRecurring || false,
      recurringType: recurringType || null,
      createdBy: req.user._id,
      activityLogs: [{ action: activityAction, performedBy: req.user._id }]
    });

    await task.save();

    const io = getIo();
    if (io) {
      io.to('admins').emit('taskUpdated');
      task.assignedTo.forEach(uid => {
        io.to(uid.toString()).emit('taskUpdated');
      });
      if (verbalAssignerDoc) {
        io.to(verbalAssignerDoc._id.toString()).emit('taskUpdated');
      }
    }

    await logAction({ taskId: task._id, userId: req.user._id, action: 'Created' });
    await checkReminders();

    // 1. If Self-Task: notify the verbal assigner (Manager/Admin)
    if (isSelfTask && verbalAssignerDoc) {
      const supervisorNotif = new Notification({
        userId: verbalAssignerDoc._id,
        message: `${req.user.name} logged a self-assigned task: "${task.title}" (verbally assigned by you).`,
        taskId: task._id,
        type: 'assignment'
      });
      await supervisorNotif.save();
      sendInAppNotification(verbalAssignerDoc._id, supervisorNotif);

      if (verbalAssignerDoc.email) {
        try {
          await sendEmail(
            verbalAssignerDoc.email,
            `Self-Task Logged by ${req.user.name} - WorkTrivo`,
            `<h2>Hello ${verbalAssignerDoc.name},</h2>
             <p><strong>${req.user.name}</strong> has created a self-assigned task under your verbal assignment:</p>
             <p><strong>Task:</strong> ${task.title}</p>
             <p><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
             <p>Log in to WorkTrivo to review progress.</p>`
          );
        } catch (mailErr) {
          console.error('Failed to send email to verbal assigner:', mailErr.message);
        }
      }

      // Also notify admins if verbal assigner was not an admin
      if (verbalAssignerDoc.role !== 'admin') {
        const admins = await User.find({ role: 'admin', active: true });
        for (const adm of admins) {
          const admNotif = new Notification({
            userId: adm._id,
            message: `${req.user.name} logged a self-assigned task: "${task.title}" (verbal assignment by ${verbalAssignerDoc.name}).`,
            taskId: task._id,
            type: 'assignment'
          });
          await admNotif.save();
          sendInAppNotification(adm._id, admNotif);
        }
      }
    } else {
      // 2. Standard assignment notifications to assignees
      const calendarEvents = [];
      for (const userId of targetAssignees) {
        const notification = new Notification({
          userId,
          message: `You have been assigned to a new task: "${task.title}".`,
          taskId: task._id,
          type: 'assignment'
        });
        await notification.save();
        sendInAppNotification(userId, notification);
        sendTaskUpdate(userId, task._id);

        const assigneeUser = await User.findById(userId);
        if (assigneeUser?.email) {
          try {
            await sendEmail(
              assigneeUser.email,
              'New Task Assigned - WorkTrivo',
              `<h2>Hello ${assigneeUser.name},</h2><p>You have been assigned a new task: ${task.title}</p>`
            );
          } catch (mErr) {}
        }

        try {
          if (assigneeUser) {
            const eventId = await upsertTaskEvent(assigneeUser, task, null);
            if (eventId) calendarEvents.push({ user: userId, eventId });
          }
        } catch (calendarErr) {
          console.error('Calendar sync failed on task create:', calendarErr.message);
        }
      }

      if (calendarEvents.length) {
        task.googleCalendarEvents = calendarEvents;
        await task.save();
      }
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', '_id name email role active profilePhoto department designationRole')
      .populate('createdBy', '_id name email role profilePhoto department designationRole')
      .populate('verballyAssignedBy', '_id name email role profilePhoto department designationRole')
      .populate('dependencies', 'title status');

    res.status(201).json(populatedTask);
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST /api/tasks/bulk-create
router.post('/bulk-create', requireRole(['admin', 'manager']), async (req, res) => {
  const { assignedTo, tasks } = req.body;

  if (!assignedTo) return res.status(400).json({ error: 'assignedTo (a single user id) is required.' });
  if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: 'tasks (a non-empty array) is required.' });

  try {
    const user = await User.findById(assignedTo);
    if (!user) return res.status(404).json({ error: 'Employee not found.' });

    const createdTasks = [];
    for (const t of tasks) {
      if (!t.title || !t.dueDate) continue; 
      const task = new Task({
        title: t.title, description: t.description || '', priority: t.priority || 'Medium', status: t.status || "To Do",
        startDate: t.startDate || null, dueDate: t.dueDate, estimatedHours: t.estimatedHours || 0, assignedTo: [assignedTo],
        tags: t.tags || [], checklist: t.checklist || [], dependencies: t.dependencies || [],
        createdBy: req.user._id, activityLogs: [{ action: 'Task Created', performedBy: req.user._id }],
      });
      await task.save();
      createdTasks.push(task);
      await logAction({ taskId: task._id, userId: req.user._id, action: 'Created' });
    }

    if (createdTasks.length === 0) return res.status(400).json({ error: 'No valid tasks to create.' });

    const notification = new Notification({ userId: assignedTo, message: `You have been assigned ${createdTasks.length} new task(s).`, type: 'assignment' });
    await notification.save();
    sendInAppNotification(assignedTo, notification);

    const io = getIo();
    if (io) {
      io.to('admins').emit('taskUpdated');
      io.to(assignedTo.toString()).emit('taskUpdated');
    }

    res.status(201).json({ created: createdTasks.length, tasks: createdTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/bulk-assign
router.patch('/bulk-assign', requireRole(['admin', 'manager']), async (req, res) => {
  const { taskIds, userId } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0 || !userId) return res.status(400).json({ error: 'taskIds and userId are required.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const tasks = await Task.find({ _id: { $in: taskIds } });
    if (tasks.length === 0) return res.status(404).json({ error: 'No matching tasks found.' });

    for (const task of tasks) {
      const alreadyAssigned = task.assignedTo.some(id => id.toString() === userId);
      if (!alreadyAssigned) {
        task.assignedTo.push(userId);
        await task.save();
        await logAction({ taskId: task._id, userId: req.user._id, action: 'Bulk Assigned', newValue: user.name });
      }
    }

    const io = getIo();
    if (io) {
      io.to('admins').emit('taskUpdated');
      io.to(userId.toString()).emit('taskUpdated');
    }
    sendInAppNotification(userId, { message: `You've been assigned to ${tasks.length} task(s).` });

    const populatedTasks = await Task.find({ _id: { $in: taskIds } }).populate('assignedTo', '_id name email role active');
    res.json({ updated: tasks.length, tasks: populatedTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', requireRole(['admin', 'manager', 'member']), async (req, res) => {
  const { title, description, priority, dueDate, assignedTo, attachments, verballyAssignedBy } = req.body;
  const taskId = req.params.id;

  try {
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const isAuthor = task.createdBy.toString() === req.user._id.toString();
    const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);

    if (!isManagerOrAdmin && (!isAuthor || !task.isSelfCreated)) {
      return res.status(403).json({ error: 'Forbidden. You cannot edit this task.' });
    }

    if (task.status === 'Approved' && !isManagerOrAdmin) {
      return res.status(400).json({ error: 'Approved tasks cannot be modified.' });
    }

    const oldAssigned = task.assignedTo.map(id => id.toString());
    const oldTitle = task.title;
    const oldPriority = task.priority;
    const oldDueDate = task.dueDate ? task.dueDate.toISOString() : '';

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = dueDate;
    if (isManagerOrAdmin && assignedTo && assignedTo.length) task.assignedTo = assignedTo;
    if (attachments) task.attachments = attachments;

    if (verballyAssignedBy) {
      const vDoc = await User.findById(verballyAssignedBy);
      if (vDoc && ['admin', 'manager'].includes(vDoc.role)) {
        task.verballyAssignedBy = vDoc._id;
      }
    }

    task.activityLogs.push({ action: "Task Updated", performedBy: req.user._id, timestamp: new Date() });
    await task.save();
    
    const io = getIo();
    if (io) {
      io.to("admins").emit("taskUpdated");
      task.assignedTo.forEach(user => { io.to(user.toString()).emit("taskUpdated"); });
      if (task.verballyAssignedBy) {
        io.to(task.verballyAssignedBy.toString()).emit("taskUpdated");
      }
    }

    if (oldTitle !== task.title) await logAction({ taskId, userId: req.user._id, action: 'Title Updated', oldValue: oldTitle, newValue: task.title });
    if (oldPriority !== task.priority) await logAction({ taskId, userId: req.user._id, action: 'Priority Updated', oldValue: oldPriority, newValue: task.priority });
    if (dueDate && oldDueDate !== new Date(dueDate).toISOString()) await logAction({ taskId, userId: req.user._id, action: 'Due Date Updated', oldValue: oldDueDate, newValue: new Date(dueDate).toISOString() });

    const newAssigned = task.assignedTo.map(id => id.toString());
    const newlyAdded = newAssigned.filter(id => !oldAssigned.includes(id));

    if (newlyAdded.length > 0) {
      await logAction({ taskId, userId: req.user._id, action: 'Assignees Updated', newValue: `${newlyAdded.length} new members added` });
      for (const userId of newlyAdded) {
        const notification = new Notification({ userId, message: `You have been assigned to task: "${task.title}".`, type: 'assignment' });
        await notification.save();
        sendInAppNotification(userId, notification);
        sendTaskUpdate(userId, task._id);
      }
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', '_id name email role active profilePhoto department designationRole')
      .populate('createdBy', '_id name email role profilePhoto department designationRole')
      .populate('verballyAssignedBy', '_id name email role profilePhoto department designationRole')
      .populate('approvedBy', '_id name email role');
    res.json(populatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    const io = getIo();
    io.emit("taskUpdated");
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    for (const entry of task.googleCalendarEvents || []) {
      try {
        const user = await User.findById(entry.user);
        if (user) await deleteTaskEvent(user, entry.eventId);
      } catch (calendarErr) {
        console.error('Calendar cleanup failed:', calendarErr.message);
      }
    }

    for (const userId of task.assignedTo) {
      const notification = new Notification({ userId, message: `Task "${task.title}" has been deleted.`, type: 'update' });
      await notification.save();
      sendInAppNotification(userId, notification);
    }

    await Comment.deleteMany({ taskId: req.params.id });
    await AuditLog.deleteMany({ taskId: req.params.id });

    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/tasks/:id/status - Status Transition Workflows
router.patch('/:id/status', async (req, res) => {
  const { status, feedback } = req.body;
  const taskId = req.params.id;

  try {
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    // ================= Dependency Validation =================
    if (status === "In Progress" && task.dependencies && task.dependencies.length > 0) {
      const dependencyTasks = await Task.find({ _id: { $in: task.dependencies } });
      const incomplete = dependencyTasks.filter(t => t.status !== "Approved");
      if (incomplete.length > 0) {
        return res.status(400).json({ error: "Complete all dependency tasks before starting this task." });
      }
    }

    const oldStatus = task.status;
    
    // --- EXACT FIX: ROBUST ID EXTRACTION AND MATCHING ---
    const currentUserId = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");
    const isAssignee = task.assignedTo.some(assignee => {
        const id = assignee._id ? assignee._id.toString() : assignee.toString();
        return id === currentUserId;
    });
    
    const hasMgmtPrivilege = isManagement(req.user.role);

    if (!hasMgmtPrivilege && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden. You are not authorized to update this task status.' });
    }

    if (status === 'Approved' || status === 'Rejected') {
      if (!hasMgmtPrivilege) return res.status(403).json({ error: 'Forbidden. Only managers and administrators can approve or reject tasks.' });
      if (req.user.role === 'manager') {
        const fullManager = await User.findById(req.user._id);
        const managedIds = (await getManagedUserIds(fullManager)).map(id => id.toString());
        const isCreator = task.createdBy && task.createdBy.toString() === req.user._id.toString();
        const hasManagedAssignee = task.assignedTo.some(a => {
          const aId = (a._id || a).toString();
          return managedIds.includes(aId) || aId === req.user._id.toString();
        });
        if (!isCreator && !hasManagedAssignee) {
          return res.status(403).json({ error: 'Forbidden. You are only authorized to approve tasks of members assigned to you or your department.' });
        }
      }
      if (status === 'Rejected' && (!feedback || !feedback.trim())) return res.status(400).json({ error: 'Feedback is required when rejecting a task.' });
    }

    if (status === 'Completed (Pending Approval)' && !isAssignee && !hasMgmtPrivilege) {
      return res.status(403).json({ error: 'Forbidden. Only assigned members should submit for approval.' });
    }

    // Update status
    task.status = status;
    task.activityLogs.push({ action: `Status changed to ${status}`, performedBy: req.user._id, timestamp: new Date() });

    if (status === 'Approved') {
      task.approvedBy = req.user._id;
      task.activityLogs.push({ action: "Task Approved", performedBy: req.user._id, timestamp: new Date() });
      task.feedback = '';
    } else if (status === 'Rejected') {
      task.approvedBy = null;
      task.feedback = feedback;
      task.activityLogs.push({ action: "Task Rejected", performedBy: req.user._id, timestamp: new Date() });
    } else {
      task.approvedBy = null;
      task.feedback = '';
    }

    await task.save();
    
    const io = getIo();
    task.assignedTo.forEach(user => { io.to(user.toString()).emit("taskUpdated"); });
    io.to("admins").emit("taskUpdated");

    await logAction({ taskId, userId: req.user._id, action: 'Status Changed', oldValue: oldStatus, newValue: status });
    if (status === 'Rejected' && feedback) {
      await logAction({ taskId, userId: req.user._id, action: 'Feedback Added', newValue: feedback });
    }

    // Handle Notifications
    if (status === 'Completed (Pending Approval)') {
      task.activityLogs.push({ action: "Submitted for Approval", performedBy: req.user._id, timestamp: new Date() });
      const mgmtUsers = await User.find({ role: { $in: ['admin', 'manager', 'Admin', 'Manager'] }, active: true });
      for (const user of mgmtUsers) {
        const notification = new Notification({ userId: user._id, message: `${req.user.name} has submitted task "${task.title}" for approval.`, type: 'completed' });
        await notification.save();
        sendInAppNotification(user._id, notification);
      }
    } else if (status === 'Approved' || status === 'Rejected') {
      for (const userId of task.assignedTo) {
        const notification = new Notification({ 
            userId, 
            message: status === 'Approved' ? `Your task "${task.title}" has been approved!` : `Your task "${task.title}" has been rejected. Feedback: "${feedback}"`, 
            type: status === 'Approved' ? 'approval' : 'rejection' 
        });
        await notification.save();
        sendInAppNotification(userId, notification);
      }
    }

    const populatedTask = await Task.findById(taskId).populate('assignedTo', '_id name email role active').populate('createdBy', '_id name email role').populate('approvedBy', '_id name email role').populate('dependencies', 'title status');
    res.json(populatedTask);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/tasks/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const currentUserId = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");
    const isAssignee = task.assignedTo.some(assignee => {
        const id = assignee._id ? assignee._id.toString() : assignee.toString();
        return id === currentUserId;
    });

    if (!isManagement(req.user.role) && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this task.' });
    }

    const comments = await Comment.find({ taskId: req.params.id }).populate('userId', '_id name email role').sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', async (req, res) => {
  const { message } = req.body;
  const taskId = req.params.id;

  try {
    if (!message || !message.trim()) return res.status(400).json({ error: 'Comment message cannot be empty.' });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const currentUserId = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");
    const isAssignee = task.assignedTo.some(assignee => {
        const id = assignee._id ? assignee._id.toString() : assignee.toString();
        return id === currentUserId;
    });
    const hasMgmtPrivilege = isManagement(req.user.role);

    if (!hasMgmtPrivilege && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this task.' });
    }

    const comment = new Comment({ taskId, userId: req.user._id, message: message.trim() });
    await comment.save();
    await logAction({ taskId, userId: req.user._id, action: 'Comment Added' });

    if (hasMgmtPrivilege) {
      for (const userId of task.assignedTo) {
        if (userId.toString() === req.user._id.toString()) continue;
        const notification = new Notification({ userId, message: `${req.user.name} (${req.user.role}) commented on task "${task.title}".`, type: 'update' });
        await notification.save();
        sendInAppNotification(userId, notification);
      }
    } else {
      const notifyList = new Set();
      if (task.createdBy) notifyList.add(task.createdBy.toString());
      task.assignedTo.forEach(id => notifyList.add(id.toString()));
      notifyList.delete(req.user._id.toString());

      for (const userId of notifyList) {
        const notification = new Notification({ userId, message: `${req.user.name} commented on task "${task.title}".`, type: 'update' });
        await notification.save();
        sendInAppNotification(userId, notification);
      }
    }

    const populatedComment = await Comment.findById(comment._id).populate('userId', '_id name email role');
    res.status(201).json(populatedComment);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/tasks/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const currentUserId = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");
    const isAssignee = task.assignedTo.some(assignee => {
        const id = assignee._id ? assignee._id.toString() : assignee.toString();
        return id === currentUserId;
    });

    if (!isManagement(req.user.role) && !isAssignee) {
      return res.status(403).json({ error: 'Forbidden. You do not have access to this task.' });
    }

    const logs = await AuditLog.find({ taskId: req.params.id }).populate('userId', '_id name email role').sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/tasks/test-cron
router.post('/test-cron', async (req, res) => {
  try {
    await checkReminders();
    res.json({ message: 'Overdue checking and upcoming reminders processed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger cron action: ' + err.message });
  }
});

module.exports = router;