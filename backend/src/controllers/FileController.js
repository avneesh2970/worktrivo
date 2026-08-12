const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");

const File = require("../models/File");
const FileVersion = require("../models/FileVersion");
const Task = require("../models/Task");

/**
 * -----------------------------------------
 * Helper : Add Activity Log
 * -----------------------------------------
 */
const addActivity = async (taskId, action, userId) => {
  try {
    await Task.findByIdAndUpdate(taskId, {
      $push: {
        activityLogs: {
          action,
          performedBy: userId,
          timestamp: new Date(),
        },
      },
    });
  } catch (err) {
    console.error("Activity Log Error:", err.message);
  }
};

/**
 * -----------------------------------------
 * Upload New File
 * POST /api/files/upload/:taskId
 * -----------------------------------------
 */
const uploadFile = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { taskId } = req.params;

    const task = await Task.findById(taskId);

    if (!task) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!req.file) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Please upload a file.",
      });
    }

    const uploadedFile = await File.create(
      [
        {
          task: task._id,
          uploadedBy: req.user._id,

          originalName: req.file.originalname,
          displayName: req.file.originalname,

          publicId: req.file.filename,
          url: req.file.path,
          secureUrl: req.file.path,

          resourceType: req.file.resource_type || "raw",
          format: req.file.format || "",

          mimeType: req.file.mimetype,

          size: req.file.size,

          folder: "tasksphere/task-files",

          currentVersion: 1,
        },
      ],
      { session }
    );

    await FileVersion.create(
      [
        {
          file: uploadedFile[0]._id,

          version: 1,

          uploadedBy: req.user._id,

          originalName: req.file.originalname,

          publicId: req.file.filename,

          url: req.file.path,

          secureUrl: req.file.path,

          resourceType: req.file.resource_type || "raw",

          format: req.file.format || "",

          mimeType: req.file.mimetype,

          size: req.file.size,

          changeLog: "Initial Upload",
        },
      ],
      { session }
    );

    await addActivity(
      task._id,
      `Uploaded file "${req.file.originalname}"`,
      req.user._id
    );

    await session.commitTransaction();

    session.endSession();

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully.",
      data: uploadedFile[0],
    });
  } catch (err) {
    await session.abortTransaction();

    session.endSession();

    console.error(err);

    if (req.file?.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename, {
          resource_type: "auto",
        });
      } catch (e) {}
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload file.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Get All Files for a Task
 * GET /api/files/task/:taskId
 * -----------------------------------------
 */
const getTaskFiles = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const files = await File.find({
      task: taskId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email profilePhoto")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: files.length,
      data: files,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch files.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Delete File
 * DELETE /api/files/:fileId
 * -----------------------------------------
 */
const deleteFile = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { fileId } = req.params;

    const file = await File.findById(fileId);

    if (!file) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.publicId, {
        resource_type: file.resourceType || "raw",
      });
    } catch (cloudErr) {
      console.error("Cloudinary Delete Error:", cloudErr.message);
    }

    // Delete all versions from Cloudinary
    const versions = await FileVersion.find({
      file: file._id,
    });

    for (const version of versions) {
      try {
        await cloudinary.uploader.destroy(version.publicId, {
          resource_type: version.resourceType || "raw",
        });
      } catch (err) {}
    }

    await FileVersion.deleteMany(
      {
        file: file._id,
      },
      { session }
    );

    await File.findByIdAndDelete(file._id, { session });

    await addActivity(
      file.task,
      `Deleted file "${file.originalName}"`,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "File deleted successfully.",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete file.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Upload New Version
 * POST /api/files/:fileId/version
 * -----------------------------------------
 */
const uploadNewVersion = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { fileId } = req.params;
    const { changeLog = "" } = req.body;

    const file = await File.findById(fileId);

    if (!file) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    if (!req.file) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Please upload a file.",
      });
    }

    const nextVersion = file.currentVersion + 1;

    await FileVersion.create(
      [
        {
          file: file._id,
          version: nextVersion,

          uploadedBy: req.user._id,

          originalName: req.file.originalname,

          publicId: req.file.filename,

          url: req.file.path,
          secureUrl: req.file.path,

          resourceType: req.file.resource_type || "raw",
          format: req.file.format || "",
          mimeType: req.file.mimetype,

          size: req.file.size,

          changeLog:
            changeLog.trim() || `Uploaded Version ${nextVersion}`,
        },
      ],
      { session }
    );

    file.currentVersion = nextVersion;
    file.originalName = req.file.originalname;
    file.displayName = req.file.originalname;

    file.publicId = req.file.filename;
    file.url = req.file.path;
    file.secureUrl = req.file.path;

    file.resourceType = req.file.resource_type || "raw";
    file.format = req.file.format || "";
    file.mimeType = req.file.mimetype;
    file.size = req.file.size;

    await file.save({ session });

    await addActivity(
      file.task,
      `Uploaded Version ${nextVersion} of "${file.originalName}"`,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "New file version uploaded successfully.",
      data: file,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(err);

    if (req.file?.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename, {
          resource_type: "auto",
        });
      } catch (e) {}
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload new version.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Get Version History
 * GET /api/files/:fileId/history
 * -----------------------------------------
 */
const getVersionHistory = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    const versions = await FileVersion.find({
      file: fileId,
    })
      .populate("uploadedBy", "name email profilePhoto")
      .sort({ version: -1 });

    return res.status(200).json({
      success: true,
      currentVersion: file.currentVersion,
      totalVersions: versions.length,
      data: versions,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch version history.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Restore Previous Version
 * POST /api/files/:fileId/restore/:versionId
 * -----------------------------------------
 */
const restoreVersion = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { fileId, versionId } = req.params;

    const file = await File.findById(fileId);

    if (!file) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    const version = await FileVersion.findOne({
      _id: versionId,
      file: fileId,
    });

    if (!version) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "Version not found.",
      });
    }

    file.currentVersion = version.version;

    file.originalName = version.originalName;

    file.displayName = version.originalName;

    file.publicId = version.publicId;

    file.url = version.url;

    file.secureUrl = version.secureUrl;

    file.resourceType = version.resourceType;

    file.format = version.format;

    file.mimeType = version.mimeType;

    file.size = version.size;

    await file.save({ session });

    await addActivity(
      file.task,
      `Restored "${file.originalName}" to Version ${version.version}`,
      req.user._id
    );

    await session.commitTransaction();

    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Version ${version.version} restored successfully.`,
      data: file,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to restore version.",
      error: err.message,
    });
  }
};

/**
 * -----------------------------------------
 * Exports
 * -----------------------------------------
 */

module.exports = {
  uploadFile,
  getTaskFiles,
  deleteFile,
  uploadNewVersion,
  getVersionHistory,
  restoreVersion,
};