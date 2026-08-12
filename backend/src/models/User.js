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
      resetOtp: {
      type: String,
      default: ''
    },
    resetOtpExpiryAt: {
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
    lastSeen:{
    type:Date,
    default:null
},
    // Google Calendar sync (spec section 15). Each user connects their own
    // Google account via OAuth2; tasks assigned to them are then mirrored
    // as events on their personal calendar. NOTE: tokens are stored in
    // plain text here for simplicity — for a real production deployment
    // these should be encrypted at rest (e.g. via a KMS or a library like
    // mongoose-encryption) before going live with real user data.
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


userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetOtp;
    delete ret.resetOtpExpiryAt;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);