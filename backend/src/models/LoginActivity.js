const mongoose = require("mongoose");

const loginActivitySchema = new mongoose.Schema(
  {
    // User Reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // User Details (stored for history)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Login / Logout
    action: {
      type: String,
      enum: ["login", "logout"],
      required: true,
    },

    // Login Method
    loginProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    // Request Information
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },

    userAgent: {
      type: String,
      default: "",
      trim: true,
    },

    // Login & Logout Time
    loginTime: {
      type: Date,
      default: null,
    },

    logoutTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================
// Indexes
// ==========================

// Query login history by user
loginActivitySchema.index({ user: 1 });

// Latest logins first
loginActivitySchema.index({ loginTime: -1 });

// Latest activity first
loginActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("LoginActivity", loginActivitySchema);