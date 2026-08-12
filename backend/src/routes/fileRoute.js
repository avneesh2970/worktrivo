const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth");

const {
  uploadFile,
  getTaskFiles,
  deleteFile,
  uploadNewVersion,
  getVersionHistory,
  restoreVersion,
} = require("../controllers/FileController");

const { upload } = require("../config/taskFileUpload");

/**
 * ==========================================
 * Task Files
 * ==========================================
 */

// Upload a new file to a task
router.post(
  "/upload/:taskId",
  authenticate,
  upload.single("file"),
  uploadFile
);

// Get all files of a task
router.get(
  "/task/:taskId",
  authenticate,
  getTaskFiles
);

// Delete a file
router.delete(
  "/:fileId",
  authenticate,
  deleteFile
);

/**
 * ==========================================
 * File Versioning
 * ==========================================
 */

// Upload a new version of an existing file
router.post(
  "/:fileId/version",
  authenticate,
  upload.single("file"),
  uploadNewVersion
);

// Get version history
router.get(
  "/:fileId/history",
  authenticate,
  getVersionHistory
);

// Restore a previous version
router.post(
  "/:fileId/restore/:versionId",
  authenticate,
  restoreVersion
);

module.exports = router;