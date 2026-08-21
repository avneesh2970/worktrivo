const bcrypt = require('bcryptjs');
const User = require('../models/User');

const initAdminUser = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@company.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    const adminName = process.env.ADMIN_NAME || 'System Admin';

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      admin = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'admin',
        active: true,
        loginProvider: 'local',
        designationRole: 'System Administrator'
      });

      console.log(`✅ Default Admin user initialized automatically from .env: ${adminEmail}`);
    } else {
      console.log(`ℹ️ Admin user exists: ${adminEmail}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize default Admin user:', error.message);
  }
};

module.exports = initAdminUser;
