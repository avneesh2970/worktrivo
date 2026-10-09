const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const DailyReport = require('../models/DailyReport');
const Group = require('../models/Group');
const LoginActivity = require('../models/LoginActivity');
const sendEmail = require('../utils/sendEmail');
const csv = require('csv-parser');
const { Readable } = require('stream'); // Core Node.js module
const { v4: uuidv4 } = require("uuid");
const { getSupervisorsForUser, getManagedUserIds } = require('../utils/managerHelper');

// --- SELF PROFILE CONTROLLERS ---

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateProfile = async (req, res) => {
  const {
    name,
    employeeId,
    dob,
    gender,
    department,
    workLocation,
    designationRole
  } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.file && req.file.path) {
      user.profilePhoto = req.file.path;
    }

    if (name !== undefined) user.name = name;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (department !== undefined) user.department = department;
    if (workLocation !== undefined) user.workLocation = workLocation;
    if (designationRole !== undefined) user.designationRole = designationRole;

    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- AUTH CONTROLLERS ---

exports.sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpiryAt = Date.now() + 15 * 60 * 1000;

    await user.save();

    await sendEmail(
      user.email,
      'Password Reset OTP - WorkTrivo',
      `<div style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
        <h2 style="color: #10b981; margin-top: 0;">Password Reset Request</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>You requested a one-time password (OTP) to reset your WorkTrivo account password.</p>
        <div style="margin: 24px 0; padding: 16px; background: #1e293b; border: 1px solid #334155; border-radius: 12px; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #10b981;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #334155; margin: 20px 0;" />
        <p style="font-size: 11px; color: #64748b;">WorkTrivo Workspace System</p>
      </div>`
    );

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (user.resetOtpExpiryAt < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP Expired' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetOtp = '';
    user.resetOtpExpiryAt = 0;

    user.activeSessionId = uuidv4();

    await user.save();

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: 'Password Reset Successful',
      text: `Hi ${user.name || ''},\n\nYour password has been reset successfully for email: ${user.email}\n\nBest regards,\nCollabZoneX Team`
    });

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error resetting password', error: error.message });
  }
};

const sendVerificationCodeEmail = async (email, name, otp) => {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #0b101e; color: #f8fafc; border-radius: 20px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 8px 18px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; color: #10b981; font-weight: 700; font-size: 15px; letter-spacing: 0.5px;">
          WorkTrivo Workspace
        </div>
      </div>
      
      <h2 style="color: #ffffff; font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 12px 0;">
        Verify Your Email Address
      </h2>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
        Hi <strong style="color: #f1f5f9;">${name || 'there'}</strong>, welcome to WorkTrivo! Please enter the 6-digit verification code below to verify your email and activate your account:
      </p>

      <div style="background: #121826; border: 1px solid #1e293b; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #10b981; display: inline-block;">
          ${otp}
        </span>
        <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0;">
          This code is valid for 15 minutes.
        </p>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; text-align: center; margin: 0 0 24px 0;">
        If you did not request to create an account, you can safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #1e293b; margin: 20px 0;" />
      
      <div style="text-align: center; color: #475569; font-size: 11px;">
        WorkTrivo • Secure Collaborative Workspace Management
      </div>
    </div>
  `;

  return await sendEmail(
    email,
    'Verify Your Email - WorkTrivo',
    html
  );
};

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });

    // Generate 6-digit verification code
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = Date.now() + 15 * 60 * 1000;

    if (existingUser) {
      // If user is already verified, reject duplicate registration
      if (existingUser.isEmailVerified !== false) {
        return res.status(400).json({ error: 'An account with this email is already registered. Please sign in.' });
      }

      // If user exists but is unverified (previous incomplete registration):
      const salt = await bcrypt.genSalt(10);
      existingUser.passwordHash = await bcrypt.hash(password, salt);
      existingUser.name = name.trim();
      existingUser.verificationOtp = otp;
      existingUser.verificationOtpExpiryAt = otpExpiry;
      await existingUser.save();

      await sendVerificationCodeEmail(existingUser.email, existingUser.name, otp);

      return res.status(200).json({
        success: true,
        requireVerification: true,
        email: existingUser.email,
        message: 'A 6-digit verification code has been sent to your email.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'member',
      active: true,
      loginProvider: 'local',
      isEmailVerified: false,
      verificationOtp: otp,
      verificationOtpExpiryAt: otpExpiry
    });

    await newUser.save();

    await sendVerificationCodeEmail(newUser.email, newUser.name, otp);

    return res.status(201).json({
      success: true,
      requireVerification: true,
      email: newUser.email,
      message: 'Account created! Please enter the 6-digit verification code sent to your email.'
    });
  } catch (err) {
    console.error('registerUser error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and 6-digit verification code are required.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isEmailVerified && !user.verificationOtp) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Email is already verified. You can log in directly.'
      });
    }

    if (!user.verificationOtp || user.verificationOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check your email and try again.' });
    }

    if (Date.now() > (user.verificationOtpExpiryAt || 0)) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }

    // Mark as verified and clear OTP
    user.isEmailVerified = true;
    user.verificationOtp = '';
    user.verificationOtpExpiryAt = 0;

    // Create session & JWT token
    const sessionId = uuidv4();
    const now = new Date();
    user.activeSessionId = sessionId;
    user.lastSeen = now;
    user.lastLoginAt = now;

    await user.save();

    // Log login activity
    LoginActivity.create({
      user: user._id,
      name: user.name,
      email: user.email,
      action: 'register_verified',
      loginProvider: user.loginProvider || 'local',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      loginTime: now
    }).catch(e => console.error('LoginActivity error:', e.message));

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

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to WorkTrivo.',
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
        department: user.department,
        designationRole: user.designationRole,
        isEmailVerified: true
      }
    });
  } catch (err) {
    console.error('verifyEmail error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
};

exports.resendVerificationOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isEmailVerified && !user.verificationOtp) {
      return res.status(400).json({ success: false, message: 'Your email is already verified. You can sign in.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verificationOtp = otp;
    user.verificationOtpExpiryAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    await sendVerificationCodeEmail(user.email, user.name, otp);

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    console.error('resendVerificationOtp error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
};

// --- SUPERVISOR CONTROLLERS ---

exports.getMySupervisors = async (req, res) => {
  try {
    const supervisors = await getSupervisorsForUser(req.user);
    res.json(supervisors);
  } catch (err) {
    console.error('getMySupervisors error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- USER MANAGEMENT CONTROLLERS ---

exports.getUsers = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const users = await User.find()
        .populate('assignedMembers', '_id name email role department employeeId profilePhoto designationRole')
        .populate('manager', '_id name email role profilePhoto designationRole department')
        .sort({ name: 1 });
      res.json(users);
    } else if (req.user.role === 'manager') {
      const fullManager = await User.findById(req.user._id);
      const managedIds = await getManagedUserIds(fullManager);

      // Manager can strictly ONLY see members belonging to their assigned team
      const users = await User.find({ _id: { $in: managedIds }, active: true })
        .populate('assignedMembers', '_id name email role department employeeId profilePhoto designationRole')
        .populate('manager', '_id name email role profilePhoto designationRole department')
        .sort({ name: 1 });

      const usersWithMeta = users.map(u => {
        const uObj = u.toObject();
        uObj.isDirectReport = true;
        return uObj;
      });

      res.json(usersWithMeta);
    } else {
      const users = await User.find(
        { active: true },
        '_id name email role profilePhoto designationRole department employeeId manager'
      )
        .populate('manager', '_id name email role profilePhoto designationRole department')
        .sort({ name: 1 });
      res.json(users);
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createUser = async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    role, 
    employeeId, 
    profilePhoto, 
    designationRole, 
    department, 
    assignedDepartment,
    assignedDepartments,
    assignedMembers,
    manager,
    workLocation 
  } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Check for duplicate employeeId if provided
    if (employeeId && employeeId.trim() !== '') {
      const employeeIdExists = await User.findOne({ employeeId: employeeId.trim() });
      if (employeeIdExists) {
        return res.status(400).json({ error: 'Employee ID is already in use.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'member',
      employeeId: employeeId && employeeId.trim() ? employeeId.trim() : undefined,
      profilePhoto: profilePhoto ? profilePhoto.trim() : undefined,
      designationRole: designationRole ? designationRole.trim() : undefined,
      department: department ? department.trim() : undefined,
      assignedDepartment: assignedDepartment ? assignedDepartment.trim() : undefined,
      assignedDepartments: Array.isArray(assignedDepartments) ? assignedDepartments : (assignedDepartment ? [assignedDepartment.trim()] : []),
      assignedMembers: Array.isArray(assignedMembers) ? assignedMembers : [],
      manager: manager || null,
      workLocation: workLocation ? workLocation.trim() : undefined
    });

    await newUser.save();
    const populatedUser = await User.findById(newUser._id)
      .populate('assignedMembers', '_id name email role department employeeId profilePhoto designationRole')
      .populate('manager', '_id name email role profilePhoto designationRole department');
    res.status(201).json(populatedUser);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ error: `${field} must be unique.` });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateUser = async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    role, 
    active, 
    employeeId, 
    profilePhoto, 
    designationRole, 
    department, 
    assignedDepartment,
    assignedDepartments,
    assignedMembers,
    manager,
    workLocation 
  } = req.body;
  const userId = req.params.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use by another user.' });
      }
      user.email = email.toLowerCase().trim();
    }

    // Check employee ID uniqueness if modified
    if (employeeId !== undefined) {
      const trimmedEmpId = employeeId ? employeeId.trim() : '';
      if (trimmedEmpId !== '' && trimmedEmpId !== user.employeeId) {
        const employeeIdExists = await User.findOne({ employeeId: trimmedEmpId });
        if (employeeIdExists) {
          return res.status(400).json({ error: 'Employee ID is already in use.' });
        }
        user.employeeId = trimmedEmpId;
      } else if (trimmedEmpId === '') {
        user.employeeId = undefined;
      }
    }

    if (name) user.name = name.trim();
    if (role) user.role = role;
    if (active !== undefined) user.active = active;
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto.trim();
    if (designationRole !== undefined) user.designationRole = designationRole;
    if (department !== undefined) user.department = department;
    if (assignedDepartment !== undefined) user.assignedDepartment = assignedDepartment;
    if (assignedDepartments !== undefined) user.assignedDepartments = assignedDepartments;
    if (assignedMembers !== undefined) user.assignedMembers = assignedMembers;
    if (manager !== undefined) user.manager = manager || null;
    if (workLocation !== undefined) user.workLocation = workLocation;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();
    const populatedUser = await User.findById(user._id)
      .populate('assignedMembers', '_id name email role department employeeId profilePhoto designationRole')
      .populate('manager', '_id name email role profilePhoto designationRole department');
    res.json(populatedUser);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ error: `${field} must be unique.` });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    user.active = !user.active;
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- BULK IMPORT CONTROLLER ---

exports.bulkImportUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a CSV file.' });
  }

  const results = [];
  try {
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('Welcome@123', salt); 

    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv())
      .on('data', (data) => {
        if (data.name && data.email) {
          results.push({
            name: data.name.trim(),
            email: data.email.toLowerCase().trim(),
            passwordHash: defaultPasswordHash,
            role: data.role || 'member',
            employeeId: data.employeeId ? data.employeeId.trim() : undefined,
            department: data.department || '',
            designationRole: data.designationRole || ''
          });
        }
      })
      .on('end', async () => {
        try {
          if (results.length === 0) {
            return res.status(400).json({ error: 'CSV file is empty or missing required name/email columns.' });
          }

          await User.insertMany(results, { ordered: false });
          
          res.status(200).json({ message: `Successfully processed ${results.length} users.` });
        } catch (dbError) {
          console.error('Bulk Import DB Error:', dbError);
          if (dbError.code === 11000) {
             res.status(200).json({ message: 'Import finished. Duplicate entries were skipped.', totalProcessed: results.length });
          } else {
             res.status(500).json({ error: 'An error occurred while saving users to the database.' });
          }
        }
      });
  } catch (err) {
    console.error('CSV Parsing Error:', err);
    res.status(500).json({ error: 'Failed to parse the CSV file.' });
  }
};

// --- NOTIFICATION CONTROLLER ---

exports.toggleNotificationMute = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.notificationMuted = !user.notificationMuted;

    await user.save();

    res.json({
      success: true,
      notificationMuted: user.notificationMuted,
      message: user.notificationMuted
        ? "In-app notifications muted."
        : "In-app notifications enabled.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// --- CANDIDATE / EMPLOYEE 360 OVERVIEW CONTROLLER ---
exports.getUserOverview = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startDate, endDate } = req.query;

    // Permissions check: regular members can only view their own profile.
    if (req.user.role === 'member' && req.user._id.toString() !== id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
    }

    // Managers can strictly ONLY view members of their assigned team (or themselves)
    if (req.user.role === 'manager' && req.user._id.toString() !== id.toString()) {
      const fullManager = await User.findById(req.user._id);
      const managedIds = await getManagedUserIds(fullManager);
      const allowedIds = managedIds.map(m => m.toString());
      if (!allowedIds.includes(id.toString())) {
        return res.status(403).json({ error: 'Access denied. You can only view members of your assigned team.' });
      }
    }

    const targetUser = await User.findById(id)
      .select('-passwordHash -resetOtp -resetOtpExpiryAt')
      .populate('manager', '_id name email role profilePhoto designationRole department')
      .populate('assignedMembers', '_id name email role profilePhoto designationRole department');

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 1. Fetch Assigned Tasks
    const tasks = await Task.find({ assignedTo: id })
      .populate('createdBy', '_id name email role')
      .populate('verballyAssignedBy', '_id name email role')
      .populate('group', '_id name')
      .sort({ updatedAt: -1 });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
    const pendingTasks = tasks.filter(t => ['To Do', 'Pending', 'In Review', 'Completed (Pending Approval)'].includes(t.status)).length;
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !['Completed', 'Approved'].includes(t.status)).length;

    // 2. Fetch Daily Reports (support optional duration filter)
    const reportQuery = { user: id };
    const now = new Date();
    if (date === 'today') {
      const s = new Date(now); s.setHours(0,0,0,0);
      const e = new Date(now); e.setHours(23,59,59,999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (date === 'yesterday') {
      const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0,0,0,0);
      const e = new Date(now); e.setDate(e.getDate() - 1); e.setHours(23,59,59,999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (date === 'this-week' || date === 'weekly') {
      const s = new Date(now);
      const day = s.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      s.setDate(s.getDate() + diff);
      s.setHours(0,0,0,0);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      e.setHours(23,59,59,999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (date === 'last-week') {
      const s = new Date(now);
      const day = s.getDay();
      const diff = (day === 0 ? -6 : 1) - day - 7;
      s.setDate(s.getDate() + diff);
      s.setHours(0,0,0,0);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      e.setHours(23,59,59,999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (date === 'this-month' || date === 'monthly') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (date === 'last-month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      reportQuery.reportDate = { $gte: s, $lte: e };
    } else if (startDate || endDate) {
      reportQuery.reportDate = {};
      if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); reportQuery.reportDate.$gte = s; }
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); reportQuery.reportDate.$lte = e; }
    }

    const reports = await DailyReport.find(reportQuery)
      .populate('reviewedBy', '_id name email role')
      .sort({ reportDate: -1 });

    const totalHours = reports.reduce((sum, r) => sum + (Number(r.totalHours) || 8), 0);
    const approvedReports = reports.filter(r => r.status === 'Approved').length;
    const pendingReports = reports.filter(r => r.status === 'Pending').length;
    const rejectedReports = reports.filter(r => r.status === 'Rejected').length;
    const blockersCount = reports.filter(r => r.blockers && r.blockers.trim()).length;

    // 3. Fetch Projects / Groups (User is a member or creator)
    const groups = await Group.find({
      $or: [
        { members: id },
        { createdBy: id }
      ]
    })
      .populate('createdBy', '_id name email role')
      .populate('members', '_id name email role profilePhoto designationRole department')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      user: targetUser,
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        overdue: overdueTasks,
        list: tasks
      },
      reports: {
        total: reports.length,
        totalHours,
        approved: approvedReports,
        pending: pendingReports,
        rejected: rejectedReports,
        blockers: blockersCount,
        list: reports
      },
      projects: {
        total: groups.length,
        list: groups
      }
    });
  } catch (err) {
    console.error('getUserOverview error:', err);
    res.status(500).json({ error: err.message });
  }
};