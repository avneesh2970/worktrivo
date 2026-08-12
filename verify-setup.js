const net = require('net');
const fs = require('fs');
const path = require('path');

console.log('=== TaskSphere Setup Verification Tool ===\n');

// 1. Check Node & Platform
console.log(`Node.js Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

// 2. Check configuration files
const backendEnvPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(backendEnvPath)) {
  console.log('✓ backend/.env configuration file exists.');
} else {
  console.log('✗ backend/.env file is missing!');
}

// 3. Test MongoDB connection on Port 27017
console.log('\nChecking MongoDB availability on Port 27017...');

const checkPort = (port, host) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
};

checkPort(27017, '127.0.0.1').then((isOpen) => {
  if (isOpen) {
    console.log('✓ MongoDB is RUNNING on port 27017!');
    console.log('You can now safely run:');
    console.log('  1. npm run seed  (to seed the database)');
    console.log('  2. npm run dev   (to start the app)');
  } else {
    console.log('✗ MongoDB is NOT RUNNING on port 27017.');
    console.log('\n[Troubleshooting Guide]');
    console.log('The backend crashed because it requires a MongoDB connection. To fix this:');
    console.log('------------------------------------------------------------');
    console.log('Option A: Start Docker (Recommended)');
    console.log('  1. Open the "Docker Desktop" application on your computer.');
    console.log('  2. Wait for the docker engine icon to turn green (online).');
    console.log('  3. In your terminal, run: npm run db:up');
    console.log('  4. Once running, seed the data: npm run seed');
    console.log('------------------------------------------------------------');
    console.log('Option B: Use MongoDB Atlas (Cloud Database)');
    console.log('  1. Create a free database at https://www.mongodb.com/cloud/atlas');
    console.log('  2. Open "backend/.env" and replace MONGODB_URI with your Atlas connection string, for example:');
    console.log('     MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/task_tracker');
    console.log('  3. Run the database seed: npm run seed');
  }
  console.log('\n==========================================');
});
