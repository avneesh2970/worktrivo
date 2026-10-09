const mongoose = require('mongoose');

const taskItemSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: ''
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  hoursSpent: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: true });

const dailyReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reportDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    todayWork: {
      type: String,
      required: true,
      trim: true
    },
    tomorrowPlan: {
      type: String,
      trim: true,
      default: ''
    },
    blockers: {
      type: String,
      trim: true,
      default: ''
    },
    totalHours: {
      type: Number,
      default: 8
    },
    tasksCompleted: [taskItemSchema],
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    feedback: {
      type: String,
      trim: true,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    attachments: [{
      type: String
    }],
    autoRejectedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for quick lookups by user and reportDate
dailyReportSchema.index({ user: 1, reportDate: -1 });
dailyReportSchema.index({ department: 1, reportDate: -1 });
dailyReportSchema.index({ status: 1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
