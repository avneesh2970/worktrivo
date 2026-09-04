const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers (Google / Cloudflare) to prevent querySrv ECONNREFUSED on Windows/ISPs
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_tracker';

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected Successfully 🎊');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;