const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const { sendInAppNotification, getIo } = require('../utils/socket');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

/* ==========================================================
   CREATE LEAVE REQUEST
   Accessible by all authenticated users (members & managers)
========================================================== */
router.post('/', async (req, res) => {
  try {
    const { leaveType, startDate, endDate, daysCount, reason } = req.body;

    if (!startDate || !endDate || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'Start date, end date, and reason are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid start date or end date format.' });
    }

    // Set time to normalize: start at 00:00:00, end at 23:59:59
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }

    // Calculate days count if not provided
    let calculatedDays = Number(daysCount);
    if (!calculatedDays || calculatedDays <= 0) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (calculatedDays <= 0) calculatedDays = 1;
    }

    const newLeave = await LeaveRequest.create({
      user: req.user._id,
      leaveType: leaveType || 'Casual Leave',
      startDate: start,
      endDate: end,
      daysCount: calculatedDays,
      reason: reason.trim(),
      status: 'Pending'
    });

    const populatedLeave = await LeaveRequest.findById(newLeave._id)
      .populate('user', '_id name email role employeeId department designationRole profilePhoto')
      .populate('reviewedBy', '_id name email');

    // Notify all active Admins
    try {
      const admins = await User.find({ role: 'admin', active: true });
      for (const admin of admins) {
        const notif = await Notification.create({
          userId: admin._id,
          message: `${req.user.name} submitted a ${newLeave.leaveType} request for ${newLeave.daysCount} day(s).`,
          type: 'approval'
        });
        await sendInAppNotification(admin._id, notif);
      }

      // If user has an assigned manager, notify manager as well
      const currentUser = await User.findById(req.user._id);
      if (currentUser && currentUser.manager) {
        const mgrNotif = await Notification.create({
          userId: currentUser.manager,
          message: `Your team member ${req.user.name} submitted a ${newLeave.leaveType} request for ${newLeave.daysCount} day(s).`,
          type: 'approval'
        });
        await sendInAppNotification(currentUser.manager, mgrNotif);
      }
    } catch (notifErr) {
      console.error('Error sending leave notifications:', notifErr.message);
    }

    // Emit socket event for real-time dashboard update
    const io = getIo();
    if (io) {
      io.emit('leaveRequestCreated', populatedLeave);
    }

    res.status(201).json(populatedLeave);
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ error: err.message || 'Failed to create leave request' });
  }
});

/* ==========================================================
   GET LOGGED-IN USER'S LEAVE REQUESTS
========================================================== */
router.get('/my', async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ user: req.user._id })
      .populate('reviewedBy', '_id name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error('Error fetching user leaves:', err);
    res.status(500).json({ error: 'Failed to fetch your leave requests' });
  }
});

// Helper to parse duration presets (matching dailyReports)
const parseDuration = (date, startDate, endDate) => {
  if (!date && !startDate && !endDate) return null;

  const now = new Date();

  if (date === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (date === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (date === 'this-week' || date === 'weekly') {
    const start = new Date(now);
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
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
    return { start, end };
  }

  if (date === 'last-7-days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (date === 'this-month' || date === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (date === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('2020-01-01');
    start.setHours(0, 0, 0, 0);
    let end = endDate ? new Date(endDate) : new Date('2099-12-31');
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Specific single date passed (e.g. '2026-09-27')
  const specificDate = new Date(date);
  if (!isNaN(specificDate.getTime())) {
    const start = new Date(specificDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(specificDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return null;
};

/* ==========================================================
   GET LEAVES ACTIVE ON A GIVEN DATE OR DATE RANGE (Approved only)
   Used by Daily Reports & Calendars
========================================================== */
router.get('/on-date', async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;

    let rangeStart;
    let rangeEnd;

    const parsed = parseDuration(date, startDate, endDate);
    if (parsed) {
      rangeStart = parsed.start;
      rangeEnd = parsed.end;
    } else {
      // Default to today
      rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date();
      rangeEnd.setHours(23, 59, 59, 999);
    }

    // Overlapping condition: startDate <= rangeEnd && endDate >= rangeStart
    const leaves = await LeaveRequest.find({
      status: 'Approved',
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart }
    })
      .populate('user', '_id name email role employeeId department designationRole profilePhoto')
      .populate('reviewedBy', '_id name email')
      .sort({ startDate: 1 });

    res.json({ leaves });
  } catch (err) {
    console.error('Error fetching leaves on date:', err);
    res.status(500).json({ error: 'Failed to fetch leaves on date' });
  }
});

/* ==========================================================
   GET ALL LEAVE REQUESTS
   - Admin: sees all leave requests
   - Manager: sees assigned team members + self
   - Member: sees self
========================================================== */
router.get('/', async (req, res) => {
  try {
    const { status, leaveType, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (leaveType && leaveType !== 'all') {
      query.leaveType = leaveType;
    }

    // Role-based scoping
    if (req.user.role === 'admin') {
      // Admin sees all
    } else if (req.user.role === 'manager') {
      // Manager sees themselves + any member whose manager is req.user._id or in assignedMembers
      const currentUser = await User.findById(req.user._id).select('assignedMembers');
      const directReports = await User.find({
        $or: [
          { manager: req.user._id },
          { _id: { $in: currentUser?.assignedMembers || [] } }
        ]
      }).select('_id');

      const allowedUserIds = [
        req.user._id,
        ...directReports.map((u) => u._id)
      ];
      query.user = { $in: allowedUserIds };
    } else {
      // Regular members only see their own
      query.user = req.user._id;
    }

    // If search text provided (matching user's name or email)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { employeeId: searchRegex }]
      }).select('_id');

      const matchingIds = matchingUsers.map((u) => u._id);

      if (query.user && query.user.$in) {
        // Intersect
        query.user = {
          $in: query.user.$in.filter((id) =>
            matchingIds.some((mId) => mId.toString() === id.toString())
          )
        };
      } else {
        query.user = { $in: matchingIds };
      }
    }

    const leaves = await LeaveRequest.find(query)
      .populate('user', '_id name email role employeeId department designationRole profilePhoto')
      .populate('reviewedBy', '_id name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error('Error fetching leave requests:', err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

/* ==========================================================
   APPROVE OR REJECT LEAVE (Admin only)
========================================================== */
router.patch('/:id/status', requireRole('admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'." });
    }

    const leave = await LeaveRequest.findById(req.params.id).populate('user');
    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.rejectionReason = status === 'Rejected' ? (rejectionReason || '').trim() : '';

    await leave.save();

    const updatedLeave = await LeaveRequest.findById(leave._id)
      .populate('user', '_id name email role employeeId department designationRole profilePhoto')
      .populate('reviewedBy', '_id name email');

    // Notify the applicant
    try {
      const applicantId = leave.user._id || leave.user;
      const notifMsg =
        status === 'Approved'
          ? `Your ${leave.leaveType} request for ${leave.daysCount} day(s) was approved by ${req.user.name}.`
          : `Your ${leave.leaveType} request was rejected by ${req.user.name}.${
              leave.rejectionReason ? ` Reason: ${leave.rejectionReason}` : ''
            }`;

      const notification = await Notification.create({
        userId: applicantId,
        message: notifMsg,
        type: status === 'Approved' ? 'approval' : 'rejection'
      });

      await sendInAppNotification(applicantId, notification);

      // Send email if applicant has email
      const userObj = leave.user.email ? leave.user : await User.findById(applicantId);
      if (userObj && userObj.email) {
        const formattedStart = new Date(leave.startDate).toLocaleDateString();
        const formattedEnd = new Date(leave.endDate).toLocaleDateString();
        await sendEmail(
          userObj.email,
          `Leave Request ${status}: ${leave.leaveType}`,
          `<h2>Hello ${userObj.name},</h2>
          <p>Your leave request has been <strong>${status}</strong> by ${req.user.name}.</p>
          <ul>
            <li><strong>Leave Type:</strong> ${leave.leaveType}</li>
            <li><strong>Period:</strong> ${formattedStart} to ${formattedEnd} (${leave.daysCount} days)</li>
            <li><strong>Status:</strong> ${status}</li>
            ${status === 'Rejected' && leave.rejectionReason ? `<li><strong>Reason:</strong> ${leave.rejectionReason}</li>` : ''}
          </ul>
          <p>Please log in to TaskSphere / WorkTrivo to view details.</p>`
        );
      }
    } catch (notifErr) {
      console.error('Error sending approval/rejection notification:', notifErr.message);
    }

    // Socket notification
    const io = getIo();
    if (io) {
      io.emit('leaveRequestUpdated', updatedLeave);
    }

    res.json(updatedLeave);
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ error: err.message || 'Failed to update leave status' });
  }
});

/* ==========================================================
   CANCEL / DELETE LEAVE REQUEST
   - Applicant can delete their own Pending request
   - Admin can delete any request
========================================================== */
router.delete('/:id', async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    const isOwner = leave.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to delete this leave request.' });
    }

    if (!isAdmin && leave.status !== 'Pending') {
      return res.status(400).json({ error: 'You can only cancel pending leave requests.' });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);

    const io = getIo();
    if (io) {
      io.emit('leaveRequestDeleted', { _id: req.params.id });
    }

    res.json({ message: 'Leave request cancelled successfully.' });
  } catch (err) {
    console.error('Error cancelling leave request:', err);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  }
});

module.exports = router;
