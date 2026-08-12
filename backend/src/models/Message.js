const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      default: "",
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const readReceiptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    readBy: {
      type: [readReceiptSchema],
      default: [],
    },

    edited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    deleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    pinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Custom Validator: Prevent empty messages (must have text OR attachments)
messageSchema.path("text").validate(function (value) {
  // If deleted, bypass check
  if (this.deleted) return true;
  const hasText = value && value.trim().length > 0;
  const hasAttachments = this.attachments && this.attachments.length > 0;
  return hasText || hasAttachments;
}, "Message cannot be empty. Must contain text or at least one attachment.");

// Optimized Indexes
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ mentions: 1, chatRoom: 1 }); // Fast lookup for user @mentions per room
messageSchema.index({ chatRoom: 1, pinned: 1 });   // Fast lookup for pinned messages per room

module.exports = mongoose.model("Message", messageSchema);