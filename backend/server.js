const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load Environment Variables
dotenv.config();

// Config
const connectDB = require("./src/config/db");
const setupMiddleware = require("./src/middleware");
const { init: initSocket } = require("./src/utils/socket");
const { startScheduler } = require("./src/utils/reminders");

// Routes
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const taskRoutes = require("./src/routes/tasks");
const announcementRoutes = require("./src/routes/announcements");
const notificationRoutes = require("./src/routes/notifications");
const groupRoutes = require("./src/routes/groups");
const chatRoutes = require("./src/routes/chatRoutes");
const departmentRoutes = require("./src/routes/departments");
const settingsRoutes = require("./src/routes/settings");
const calendarRoutes = require("./src/routes/calendarRoutes");
const fileRoutes = require("./src/routes/fileRoute");
const loginActivityRoutes = require("./src/routes/loginActivityRoute");

// Express App
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// ===============================
// Global Middleware
// ===============================
setupMiddleware(app);

// ===============================
// Serve Static Files (Uploads)
// MUST BE PLACED BEFORE API ROUTES
// ===============================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// Root Route
// ===============================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 API Working",
    application: "TaskSphere Backend",
    version: "1.0.0",
    status: "Running",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ===============================
// Health Check
// ===============================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ===============================
// API Routes
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/login-activity", loginActivityRoutes);

// ===============================
// 404 Route
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===============================
// Initialize Socket.IO
// ===============================
initSocket(server);

// ===============================
// Start Server
// ===============================
const startServer = async () => {
  try {
    await connectDB();

    // Start Reminder Scheduler
    startScheduler();

    // Listen on all network interfaces
    server.listen(PORT, "0.0.0.0", () => {
      console.log("====================================");
      console.log("🚀 TaskSphere Backend Started");
      console.log(`🌐 Server : http://localhost:${PORT}`);
      console.log(`❤️ Health : http://localhost:${PORT}/health`);
      console.log(`📦 API    : http://localhost:${PORT}/`);
      console.log("====================================");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };