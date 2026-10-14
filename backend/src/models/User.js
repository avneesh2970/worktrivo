const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: function () {
        return this.loginProvider === 'local';
      }
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'member'],
      default: 'member'
    },
    active: {
      type: Boolean,
      default: true
    },
    googleId: {
      type: String,
      default: ''
    },
    loginProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    profilePhoto: {
      type: String,
      default: ''
    },
    employeeId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    dob: {
      type: Date,
      default: null
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', ''],
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    // For managers: assigned department(s) and assigned direct members
    assignedDepartment: {
      type: String,
      trim: true,
      default: ''
    },
    assignedDepartments: [{
      type: String,
      trim: true
    }],
    assignedMembers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    // For members: directly assigned manager
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    workLocation: {
      type: String,
      trim: true,
      default: ''
    },
    designationRole: {
      type: String,
      trim: true,
      default: ''
    },
    leaveBalances: {
      casual: { type: Number, default: 12 },
      sick: { type: Number, default: 10 },
      paid: { type: Number, default: 15 },
      wfh: { type: Number, default: 24 }
    },
    resetOtp: {
      type: String,
      default: ''
    },
    resetOtpExpiryAt: {
      type: Number,
      default: 0
    },
    isEmailVerified: {
      type: Boolean,
      default: true
    },
    verificationOtp: {
      type: String,
      default: ''
    },
    verificationOtpExpiryAt: {
      type: Number,
      default: 0
    },
    activeSessionId: {
      type: String,
      default: null
    },
    lastSeen: {
      type: Date,
      default: null
    },
    notificationMuted: {
      type: Boolean,
      default: false
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    lastLogoutAt: {
      type: Date,
      default: null
    },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String, default: '' },
      refreshToken: { type: String, default: '' },
      tokenExpiry: { type: Date, default: null },
    }
  },
  {
    timestamps: true
  }
);

// Performance Indexes
userSchema.index({ role: 1, active: 1 });
userSchema.index({ manager: 1 });
userSchema.index({ department: 1 });
userSchema.index({ assignedDepartment: 1 });
userSchema.index({ assignedMembers: 1 });
userSchema.index({ active: 1 });
userSchema.index({ name: 1 });

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetOtp;
    delete ret.resetOtpExpiryAt;
    delete ret.verificationOtp;
    delete ret.verificationOtpExpiryAt;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
