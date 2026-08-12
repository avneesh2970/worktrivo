const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');
const Department = require('./models/Department');
const Group = require('./models/Group');
const Task = require('./models/Task');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_tracker';

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully.');

    // 1. Password Hashing
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 2. Define Initial Users
    const usersData = [
      {
        name: 'System Admin',
        email: 'admin@company.com',
        passwordHash,
        role: 'admin',
        active: true,
        department: 'Engineering',
        workLocation: 'Headquarters',
        designationRole: 'System Administrator'
      },
      {
        name: 'Project Manager',
        email: 'manager@company.com',
        passwordHash,
        role: 'manager',
        active: true,
        department: 'Product',
        workLocation: 'Remote',
        designationRole: 'Senior Product Manager'
      },
      {
        name: 'John Member',
        email: 'member@company.com',
        passwordHash,
        role: 'member',
        active: true,
        department: 'Engineering',
        workLocation: 'Headquarters',
        designationRole: 'Full Stack Engineer'
      },
      {
        name: 'Alice Smith',
        email: 'alice@company.com',
        passwordHash,
        role: 'member',
        active: true,
        department: 'Marketing',
        workLocation: 'Headquarters',
        designationRole: 'Marketing Specialist'
      }
    ];

    const seededUsers = [];
    for (const userData of usersData) {
      const user = await User.findOneAndUpdate(
        { email: userData.email },
        { $setOnInsert: userData },
        { upsert: true, new: true }
      );
      seededUsers.push(user);
      console.log(`✓ User ready: ${user.email} (${user.role})`);
    }

    const adminUser = seededUsers.find((u) => u.role === 'admin');
    const managerUser = seededUsers.find((u) => u.role === 'manager');
    const memberUser = seededUsers.find((u) => u.email === 'member@company.com');

    // 3. Define Departments
    const deptNames = ['Engineering', 'Product', 'Marketing', 'Human Resources'];
    for (const dName of deptNames) {
      await Department.findOneAndUpdate(
        { name: dName },
        { $setOnInsert: { name: dName, description: `${dName} Department`, createdBy: adminUser._id } },
        { upsert: true }
      );
    }
    console.log('✓ Departments created.');

    // 4. Create Sample Group
    const group = await Group.findOneAndUpdate(
      { name: 'WorkTrivo Launch Team' },
      {
        $setOnInsert: {
          name: 'WorkTrivo Launch Team',
          description: 'Core team responsible for WorkTrivo MVP launch',
          members: seededUsers.map((u) => u._id),
          createdBy: adminUser._id,
          approvalStatus: 'Approved',
          approvedBy: adminUser._id,
          approvedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    console.log('✓ Group created:', group.name);

    // 5. Create Sample Tasks
    const existingTasksCount = await Task.countDocuments();
    if (existingTasksCount === 0) {
      const sampleTasks = [
        {
          title: 'Setup Initial Project Architecture',
          description: 'Initialize Node.js backend with Express and React frontend with Vite.',
          status: 'Approved',
          priority: 'High',
          startDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedHours: 10,
          assignedTo: [memberUser._id],
          createdBy: managerUser._id,
          approvedBy: managerUser._id,
          group: group._id,
          tags: ['architecture', 'setup']
        },
        {
          title: 'Design Dashboard & Authentication UI',
          description: 'Build sleek modern login page and user dashboard with responsive layouts.',
          status: 'In Progress',
          priority: 'Medium',
          startDate: new Date(),
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          estimatedHours: 8,
          assignedTo: [memberUser._id],
          createdBy: managerUser._id,
          group: group._id,
          tags: ['frontend', 'ui']
        },
        {
          title: 'Implement Voice-to-Task Feature',
          description: 'Integrate Speech-to-Text parsing for automated task creation.',
          status: 'To Do',
          priority: 'Urgent',
          startDate: new Date(),
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          estimatedHours: 12,
          assignedTo: [memberUser._id],
          createdBy: adminUser._id,
          group: group._id,
          tags: ['ai', 'voice']
        }
      ];

      await Task.insertMany(sampleTasks);
      console.log('✓ Sample tasks created.');
    }

    console.log('\n=============================================');
    console.log('🎉 Seed completed successfully!');
    console.log('Sample Accounts for Login:');
    console.log('  1. Admin   : admin@company.com   / password123');
    console.log('  2. Manager : manager@company.com / password123');
    console.log('  3. Member  : member@company.com  / password123');
    console.log('=============================================\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDatabase();
