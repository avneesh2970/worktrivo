const bcrypt = require('bcryptjs');
const User = require('../models/User');
const transporter = require('../utils/nodemailer');
const csv = require('csv-parser');
const { Readable } = require('stream'); // Core Node.js module
const { v4: uuidv4 } = require("uuid");

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

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Hi ${user.name || ''},\n\nYour password reset OTP is: ${otp}\n\nThis OTP is valid for 15 minutes.\n\nBest regards,\nCollabZoneX Team`
    });

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

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'member'
    });

    await newUser.save();
    res.status(201).json({ message: 'Registration successful', user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- USER MANAGEMENT CONTROLLERS ---

exports.getUsers = async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const users = await User.find().sort({ name: 1 });
      res.json(users);
    } else {
      const users = await User.find(
        { active: true },
        '_id name email role profilePhoto designationRole department employeeId'
      ).sort({ name: 1 });
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
      workLocation: workLocation ? workLocation.trim() : undefined
    });

    await newUser.save();
    res.status(201).json(newUser);
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
    if (workLocation !== undefined) user.workLocation = workLocation;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();
    res.json(user);
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