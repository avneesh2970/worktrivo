const express = require('express');
const DailyReport = require('../models/DailyReport');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticate, requireRole } = require('../middleware/auth');
const { getManagedUserIds, isUserManagedBy } = require('../utils/managerHelper');
const { sendInAppNotification, getIo } = require('../utils/socket');
const { sendEmailAsync } = require('../utils/sendEmail');

const router = express.Router();
router.use(authenticate);

// ==========================================
// DURATION PARSER HELPER
// ==========================================
const parseDuration = (date, startDate, endDate) => {
  if (!date && !startDate && !endDate) return null;

  const now = new Date();

  if (date === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Today' };
  }

  if (date === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Yesterday' };
  }

  if (date === 'this-week' || date === 'weekly') {
    // Current week: Monday to Sunday
    const start = new Date(now);
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'This Week' };
  }

  if (date === 'last-week') {
    const start = new Date(now);
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day - 7;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Last Week' };
  }

  if (date === 'last-7-days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Last 7 Days' };
  }

  if (date === 'this-month' || date === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'This Month' };
  }

  if (date === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Last Month' };
  }

  if (date === 'last-30-days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: 'Last 30 Days' };
  }

  if (startDate || endDate) {
    const result = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      result.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      result.$lte = e;
    }
    result.label = `Custom (${startDate || 'Start'} - ${endDate || 'Now'})`;
    return result;
  }

  // Exact date string (YYYY-MM-DD)
  const target = new Date(date);
  if (!isNaN(target.getTime())) {
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end, label: target.toDateString() };
  }

  return null;
};

// ==========================================
// GET /api/daily-reports/stats - Summary counts with duration filter
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const userRole = req.user.role;
    const { date, startDate, endDate, department, userId } = req.query;
    let userFilter = {};

    if (userRole === 'member') {
      userFilter.user = req.user._id;
    } else if (userRole === 'manager') {
      const fullManager = await User.findById(req.user._id);
      const managedIds = await getManagedUserIds(fullManager);
      const allowedUserIds = [...managedIds, req.user._id];
      userFilter.user = userId ? userId : { $in: allowedUserIds };
    } else if (userRole === 'admin' && userId) {
      userFilter.user = userId;
    }

    if (department && department.trim() && department !== 'all') {
      userFilter.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
    }

    const durationFilter = parseDuration(date, startDate, endDate);
    if (durationFilter) {
      userFilter.reportDate = { $gte: durationFilter.$gte, $lte: durationFilter.$lte };
    }

    const allReports = await DailyReport.find(userFilter);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const pending = allReports.filter(r => r.status === 'Pending').length;
    const approved = allReports.filter(r => r.status === 'Approved').length;
    const rejected = allReports.filter(r => r.status === 'Rejected').length;
    const submittedToday = allReports.filter(r => {
      const d = new Date(r.reportDate);
      return d >= todayStart && d <= todayEnd;
    }).length;

    const totalHours = allReports.reduce((sum, r) => sum + (Number(r.totalHours) || 8), 0);
    const totalBlockers = allReports.filter(r => r.blockers && r.blockers.trim()).length;
    const uniqueSubmitters = new Set(allReports.map(r => r.user.toString())).size;

    res.json({
      total: allReports.length,
      pending,
      approved,
      rejected,
      submittedToday,
      totalHours,
      totalBlockers,
      submitterCount: uniqueSubmitters,
      durationLabel: durationFilter?.label || 'All Time',
    });
  } catch (err) {
    console.error('GET /api/daily-reports/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/daily-reports/summary - Team summary grouped by member for selected duration
// ==========================================
router.get('/summary', async (req, res) => {
  try {
    const { date, startDate, endDate, department, userId } = req.query;
    const userRole = req.user.role;
    const query = {};

    if (userRole === 'member') {
      query.user = req.user._id;
    } else if (userRole === 'manager') {
      const fullManager = await User.findById(req.user._id);
      const managedIds = await getManagedUserIds(fullManager);
      const allowedUserIds = [...managedIds, req.user._id];
      query.user = userId ? userId : { $in: allowedUserIds };
    } else if (userRole === 'admin' && userId) {
      query.user = userId;
    }

    const durationFilter = parseDuration(date, startDate, endDate);
    if (durationFilter) {
      query.reportDate = { $gte: durationFilter.$gte, $lte: durationFilter.$lte };
    }

    if (department && department.trim() && department !== 'all') {
      query.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
    }

    const reports = await DailyReport.find(query)
      .populate('user', '_id name email role profilePhoto designationRole department employeeId')
      .populate('reviewedBy', '_id name email role')
      .sort({ reportDate: -1 });

    const memberMap = new Map();

    reports.forEach((report) => {
      const u = report.user;
      if (!u) return;
      const uId = u._id.toString();

      if (!memberMap.has(uId)) {
        memberMap.set(uId, {
          user: u,
          reportsCount: 0,
          totalHours: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          blockersCount: 0,
          reports: [],
        });
      }

      const item = memberMap.get(uId);
      item.reportsCount += 1;
      item.totalHours += Number(report.totalHours) || 8;
      if (report.status === 'Approved') item.approved += 1;
      else if (report.status === 'Pending') item.pending += 1;
      else if (report.status === 'Rejected') item.rejected += 1;
      if (report.blockers && report.blockers.trim()) item.blockersCount += 1;

      item.reports.push({
        _id: report._id,
        reportDate: report.reportDate,
        totalHours: report.totalHours,
        status: report.status,
        todayWork: report.todayWork,
        tomorrowPlan: report.tomorrowPlan,
        blockers: report.blockers,
        tasksCompleted: report.tasksCompleted,
      });
    });

    const membersSummary = Array.from(memberMap.values()).sort(
      (a, b) => b.totalHours - a.totalHours
    );

    const totalHoursAll = membersSummary.reduce((sum, m) => sum + m.totalHours, 0);

    res.json({
      success: true,
      duration: durationFilter?.label || 'All Time',
      startDate: durationFilter?.$gte || null,
      endDate: durationFilter?.$lte || null,
      totalReports: reports.length,
      totalHours: totalHoursAll,
      activeMembersCount: membersSummary.length,
      members: membersSummary,
    });
  } catch (err) {
    console.error('GET /api/daily-reports/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/daily-reports - List reports with filters
// ==========================================
router.get('/', async (req, res) => {
  try {
    const { status, date, startDate, endDate, department, userId, search } = req.query;
    const query = {};

    // 1. Role-based scoping
    if (req.user.role === 'member') {
      query.user = req.user._id;
    } else if (req.user.role === 'manager') {
      const fullManager = await User.findById(req.user._id);
      const managedIds = await getManagedUserIds(fullManager);
      const allowedUserIds = [...managedIds, req.user._id];

      if (userId) {
        const isAllowed = allowedUserIds.some(id => id.toString() === userId.toString());
        if (!isAllowed) {
          return res.status(403).json({ error: 'Forbidden. User is not in your assigned team or department.' });
        }
        query.user = userId;
      } else {
        query.user = { $in: allowedUserIds };
      }
    } else if (req.user.role === 'admin' && userId) {
      query.user = userId;
    }

    // 2. Status filter
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      query.status = status;
    }

    // 3. Department filter
    if (department && department.trim() && department !== 'all') {
      query.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
    }

    // 4. Date filtering using duration parser
    const durationFilter = parseDuration(date, startDate, endDate);
    if (durationFilter) {
      query.reportDate = { $gte: durationFilter.$gte, $lte: durationFilter.$lte };
    }

    // 5. Search filtering (searches in todayWork, tomorrowPlan, blockers)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { todayWork: searchRegex },
        { tomorrowPlan: searchRegex },
        { blockers: searchRegex }
      ];
    }

    const reports = await DailyReport.find(query)
      .populate('user', '_id name email role profilePhoto designationRole department employeeId')
      .populate('reviewedBy', '_id name email role')
      .sort({ reportDate: -1, createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error('GET /api/daily-reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/daily-reports/:id - Single report
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id)
      .populate('user', '_id name email role profilePhoto designationRole department employeeId')
      .populate('reviewedBy', '_id name email role')
      .populate('tasksCompleted.taskId', '_id title priority status');

    if (!report) {
      return res.status(404).json({ error: 'Daily report not found.' });
    }

    // Access authorization check
    if (req.user.role === 'member') {
      if (report.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Forbidden. You cannot view reports submitted by other members.' });
      }
    } else if (req.user.role === 'manager') {
      const isAuthor = report.user._id.toString() === req.user._id.toString();
      const fullManager = await User.findById(req.user._id);
      const isManaged = await isUserManagedBy(fullManager, report.user._id);

      if (!isAuthor && !isManaged) {
        return res.status(403).json({ error: 'Forbidden. You can only view reports of your assigned team members or department.' });
      }
    }

    res.json(report);
  } catch (err) {
    console.error('GET /api/daily-reports/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POST /api/daily-reports - Submit Daily Report (Everyone except Admin)
// ==========================================
router.post('/', async (req, res) => {
  try {
    // 1. Check role: admins are not allowed to submit daily reports
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admins do not need to submit daily reports.' });
    }

    const {
      reportDate,
      todayWork,
      tomorrowPlan,
      blockers,
      totalHours,
      tasksCompleted,
      attachments
    } = req.body;

    if (!todayWork || !todayWork.trim()) {
      return res.status(400).json({ error: 'Please enter what you worked on today (todayWork is required).' });
    }

    // Determine target report date (defaults to today)
    const targetDate = reportDate ? new Date(reportDate) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid report date.' });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if report already exists for this date
    const existing = await DailyReport.findOne({
      user: req.user._id,
      reportDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const userObj = await User.findById(req.user._id);
    const department = userObj?.department || '';

    let report;
    if (existing) {
      // Rule: Once approved, no one can change or resubmit
      if (existing.status === 'Approved') {
        return res.status(400).json({
          error: 'Daily report for this date has already been approved and cannot be modified.'
        });
      }

      // Rule: In a single day, user can only submit 1 report.
      // If already Pending, prompt them to edit the pending report
      if (existing.status === 'Pending') {
        return res.status(400).json({
          error: 'You already have a pending daily report for this date. You can edit your existing pending report instead of submitting a new one.',
          existingReportId: existing._id
        });
      }

      // Rule: If Rejected, user can edit and resubmit
      existing.todayWork = todayWork.trim();
      if (tomorrowPlan !== undefined) existing.tomorrowPlan = tomorrowPlan.trim();
      if (blockers !== undefined) existing.blockers = blockers.trim();
      if (totalHours !== undefined) existing.totalHours = Number(totalHours) || 8;
      if (tasksCompleted !== undefined) existing.tasksCompleted = tasksCompleted;
      if (attachments !== undefined) existing.attachments = attachments;
      existing.department = department;
      existing.status = 'Pending';
      existing.feedback = '';
      existing.reviewedBy = null;
      existing.reviewedAt = null;
      await existing.save();
      report = existing;
    } else {
      report = new DailyReport({
        user: req.user._id,
        reportDate: targetDate,
        department,
        todayWork: todayWork.trim(),
        tomorrowPlan: tomorrowPlan?.trim() || '',
        blockers: blockers?.trim() || '',
        totalHours: totalHours !== undefined ? Number(totalHours) : 8,
        tasksCompleted: Array.isArray(tasksCompleted) ? tasksCompleted : [],
        attachments: Array.isArray(attachments) ? attachments : [],
        status: 'Pending'
      });
      await report.save();
    }

    const populated = await DailyReport.findById(report._id)
      .populate('user', '_id name email role profilePhoto designationRole department employeeId');

    // Real-time broadcast to all connected clients (Admins, Managers, Members)
    const io = getIo();
    if (io) {
      io.emit('dailyReportUpdated', populated);
    }

    // In-app notifications to managers and admins
    if (userObj) {
      const recipientIds = new Set();

      // Notify Admins
      const admins = await User.find({ role: 'admin', active: true }).select('_id');
      admins.forEach((adm) => {
        if (adm._id.toString() !== req.user._id.toString()) {
          recipientIds.add(adm._id.toString());
        }
      });

      // Notify Managers who manage this user
      const managers = await User.find({ role: 'manager', active: true });
      for (const mgr of managers) {
        if (mgr._id.toString() !== req.user._id.toString()) {
          const managesUser = await isUserManagedBy(mgr, req.user._id);
          if (managesUser) {
            recipientIds.add(mgr._id.toString());
          }
        }
      }

      for (const recId of recipientIds) {
        const notif = new Notification({
          userId: recId,
          message: `Daily report ${existing ? 'resubmitted' : 'submitted'} by ${userObj.name} (${userObj.department || 'No Department'}).`,
          type: 'report',
          reportId: report._id
        });
        notif.save().catch((e) => console.error('Notif save error:', e.message));
        sendInAppNotification(recId, notif);
      }
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('POST /api/daily-reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PUT /api/daily-reports/:id - Edit report (author only, while pending or rejected)
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const isAuthor = report.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden. You cannot edit this report.' });
    }

    // Rule: After approval, no one can change the report
    if (report.status === 'Approved') {
      return res.status(400).json({
        error: 'This daily report has already been approved and cannot be modified by anyone.'
      });
    }

    const { todayWork, tomorrowPlan, blockers, totalHours, tasksCompleted, attachments } = req.body;
    if (todayWork) report.todayWork = todayWork.trim();
    if (tomorrowPlan !== undefined) report.tomorrowPlan = tomorrowPlan.trim();
    if (blockers !== undefined) report.blockers = blockers.trim();
    if (totalHours !== undefined) report.totalHours = Number(totalHours) || 8;
    if (tasksCompleted !== undefined) report.tasksCompleted = tasksCompleted;
    if (attachments !== undefined) report.attachments = attachments;

    // Reset status to Pending for review after editing
    report.status = 'Pending';
    report.feedback = '';
    report.reviewedBy = null;
    report.reviewedAt = null;

    await report.save();

    const populated = await DailyReport.findById(report._id)
      .populate('user', '_id name email role profilePhoto designationRole department employeeId')
      .populate('reviewedBy', '_id name email role');

    const io = getIo();
    if (io) {
      io.emit('dailyReportUpdated', populated);
    }

    // Send notifications to managers and admins
    const submitter = await User.findById(report.user);
    if (submitter) {
      const recipientIds = new Set();
      const admins = await User.find({ role: 'admin', active: true }).select('_id');
      admins.forEach((adm) => {
        if (adm._id.toString() !== req.user._id.toString()) {
          recipientIds.add(adm._id.toString());
        }
      });
      const managers = await User.find({ role: 'manager', active: true });
      for (const mgr of managers) {
        if (mgr._id.toString() !== req.user._id.toString()) {
          const managesUser = await isUserManagedBy(mgr, report.user);
          if (managesUser) {
            recipientIds.add(mgr._id.toString());
          }
        }
      }
      for (const recId of recipientIds) {
        const notif = new Notification({
          userId: recId,
          message: `Daily report updated and resubmitted by ${submitter.name} (${submitter.department || 'No Department'}).`,
          type: 'report',
          reportId: report._id
        });
        notif.save().catch((e) => console.error('Notif save error:', e.message));
        sendInAppNotification(recId, notif);
      }
    }

    res.json(populated);
  } catch (err) {
    console.error('PUT /api/daily-reports/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PATCH /api/daily-reports/:id/status - Approve / Reject Report
// ==========================================
router.patch('/:id/status', async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Only managers and administrators can review daily reports.' });
    }

    const { status, feedback } = req.body;
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either "Approved" or "Rejected".' });
    }

    if (status === 'Rejected' && (!feedback || !feedback.trim())) {
      return res.status(400).json({ error: 'Feedback is required when rejecting a daily report.' });
    }

    const report = await DailyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Daily report not found.' });
    }

    // Rule: Once approved, no one (not even admin) can reject or change status
    if (report.status === 'Approved') {
      return res.status(400).json({
        error: 'This daily report has already been approved. Approved daily reports are permanent and cannot be rejected or modified.'
      });
    }

    // Manager validation: manager can only approve reports from their assigned members or department
    if (req.user.role === 'manager') {
      const fullManager = await User.findById(req.user._id);
      const isManaged = await isUserManagedBy(fullManager, report.user);

      if (!isManaged) {
        return res.status(403).json({
          error: 'Forbidden. You are only authorized to approve daily reports of members assigned to you or your department.'
        });
      }
    }

    report.status = status;
    report.feedback = feedback ? feedback.trim() : '';
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    await report.save();

    // Send in-app notification to report author
    const notification = new Notification({
      userId: report.user,
      message: `Your daily report for ${new Date(report.reportDate).toLocaleDateString()} has been ${status.toLowerCase()}.${feedback ? ` Feedback: "${feedback.trim()}"` : ''}`,
      type: 'report',
      reportId: report._id
    });
    notification.save().catch(e => console.error('Notification save error:', e.message));
    sendInAppNotification(report.user, notification);

    // Populate the report for immediate JSON response
    await report.populate([
      { path: 'user', select: '_id name email role profilePhoto designationRole department employeeId' },
      { path: 'reviewedBy', select: '_id name email role' }
    ]);

    // Send email asynchronously in background so client response is instant
    if (report.user?.email) {
      sendEmailAsync(
        report.user.email,
        `Daily Report ${status} - WorkTrivo`,
        `<h2>Hello ${report.user.name},</h2>
         <p>Your daily report for <strong>${new Date(report.reportDate).toLocaleDateString()}</strong> has been <strong>${status}</strong> by ${req.user.name}.</p>
         ${feedback ? `<p><strong>Feedback / Notes:</strong> ${feedback}</p>` : ''}
         ${status === 'Rejected' ? '<p>You can now edit and resubmit your report on WorkTrivo.</p>' : ''}
         <p>Please log in to WorkTrivo to view details.</p>`
      );
    }

    // Sockets: broadcast to all connected clients
    const io = getIo();
    if (io) {
      io.emit('dailyReportUpdated', report);
    }

    res.json({ message: `Daily report ${status.toLowerCase()} successfully.`, report });
  } catch (err) {
    console.error('PATCH /api/daily-reports/:id/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DELETE /api/daily-reports/:id - Delete report
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const isAuthor = report.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden. You cannot delete this report.' });
    }

    // Rule: Approved reports cannot be deleted
    if (report.status === 'Approved') {
      return res.status(400).json({ error: 'Approved daily reports cannot be deleted.' });
    }

    await DailyReport.findByIdAndDelete(req.params.id);

    const io = getIo();
    if (io) {
      io.emit('dailyReportUpdated', { _id: req.params.id, deleted: true });
    }

    res.json({ message: 'Daily report deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/daily-reports/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
