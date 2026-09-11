const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load Environment Variables
dotenv.config();

// Config
const connectDB = require("./src/config/db");
const initAdminUser = require("./src/config/initAdmin");
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
const dailyReportRoutes = require("./src/routes/dailyReports");

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
    application: "WorkTrivo Backend",
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
// Health Check (/health and /api/health)
// ===============================
app.get(["/health", "/api/health"], (req, res) => {
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
// Auto Keep-Alive (Prevents Render Free Tier from sleeping)
// ===============================
const startKeepAlive = () => {
  const targetUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.SERVER_URL ||
    process.env.KEEP_ALIVE_URL;

  if (!targetUrl) return;

  const pingUrl = `${targetUrl.replace(/\/$/, "")}/health`;
  const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render idle timeout is 15 mins)

  const httpModule = pingUrl.startsWith("https") ? require("https") : require("http");

  setInterval(() => {
    httpModule
      .get(pingUrl, (res) => {
        console.log(`[Keep-Alive] Pinged ${pingUrl} - Status: ${res.statusCode}`);
      })
      .on("error", (err) => {
        console.warn(`[Keep-Alive] Ping failed:`, err.message);
      });
  }, PING_INTERVAL);

  console.log(`⏱️ Auto Keep-Alive active: pinging ${pingUrl} every 14 minutes`);
};

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
app.use("/api/daily-reports", dailyReportRoutes);

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
    await initAdminUser();

    // Start Reminder Scheduler
    startScheduler();

    // Start Auto Keep-Alive (for Render / cloud deployments)
    startKeepAlive();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another process.`);
        console.error(`👉 Please stop the existing process running on port ${PORT}.`);
      } else {
        console.error('❌ Server error:', err.message);
      }
      process.exit(1);
    });

    // Listen on all network interfaces
    server.listen(PORT, "0.0.0.0", () => {
      console.log("====================================");
      console.log("🚀 WorkTrivo Backend Started");
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