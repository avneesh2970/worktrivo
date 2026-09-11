const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  chatRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    default: null
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DailyReport',
    default: null
  },
  type: {
    type: String,
    enum: [
        "assignment",
        "project",
        "reminder",
        "approval",
        "rejection",
        "deadline",
        "overdue",
        "completed",
        "update",
        "report",
        "announcement",
        "chat"
    ],
    required: true
},
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

