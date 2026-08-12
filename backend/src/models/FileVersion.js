const mongoose = require("mongoose");

const fileVersionSchema = new mongoose.Schema(
  {
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },

    version: {
      type: Number,
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    secureUrl: {
      type: String,
      required: true,
    },

    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      default: "raw",
    },

    format: {
      type: String,
      default: "",
    },

    mimeType: {
      type: String,
      default: "",
    },

    size: {
      type: Number,
      required: true,
    },

    changeLog: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

fileVersionSchema.index(
  {
    file: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("FileVersion", fileVersionSchema);