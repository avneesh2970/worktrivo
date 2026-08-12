const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "tasksphere/task-files",
    // Only true images go through Cloudinary's "image" pipeline (so
    // thumbnails/transformations still work). Everything else — PDFs,
    // Word/Excel/PowerPoint docs, ZIPs — goes through "raw", which is
    // NOT subject to Cloudinary's image-delivery PDF/ZIP restriction.
    resource_type: file.mimetype.startsWith("image/") ? "image" : "raw",
    public_id: `${Date.now()}-${file.originalname
      .replace(/\s+/g, "-")
      .replace(/\.[^/.]+$/, "")}`,
  }),
});
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
      "text/plain",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type."));
    }
  },
});

module.exports = {
  upload,
  cloudinary,
};