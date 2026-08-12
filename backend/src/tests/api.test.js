const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { app, server } = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/task_tracker_test';

beforeAll(async () => {
  // Disconnect from the default connection if connected
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  // Connect to test database
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  // Cleanup test database
  await User.deleteMany({});
  await Task.deleteMany({});
  await AuditLog.deleteMany({});
  await mongoose.connection.close();
  
  // Close the server instance to let Jest exit
  await new Promise(resolve => server.close(resolve));
});

describe('Task Tracker API Test Suite', () => {
  let adminToken = '';
  let memberToken = '';
  let testMemberId = null;
  let testTaskId = null;

  beforeEach(async () => {
    // Clear data between tests
    await User.deleteMany({});
    await Task.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed test users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const admin = new User({
      name: 'Test Manager',
      email: 'admin_test@company.com',
      passwordHash,
      role: 'admin',
      active: true
    });

    const member = new User({
      name: 'Test Member',
      email: 'member_test@company.com',
      passwordHash,
      role: 'member',
      active: true
    });

    await admin.save();
    await member.save();

    testMemberId = member._id;

    // Login to get tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin_test@company.com', password: 'password123' });
    
    adminToken = adminLoginRes.body.token;

    const memberLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'member_test@company.com', password: 'password123' });
    
    memberToken = memberLoginRes.body.token;
  });

  // 1. Authentication Tests
  test('POST /api/auth/login - should issue token for correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin_test@company.com', password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('admin_test@company.com');
  });

  test('POST /api/auth/login - should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin_test@company.com', password: 'wrongpassword' });
    
    expect(res.status).toBe(401);
  });

  // 2. Authorization (RBAC) Tests
  test('GET /api/users - Member user should NOT be able to view full admin details', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${memberToken}`);
    
    // Member should only receive sanitized user details (_id, name, email, role)
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty('passwordHash');
    expect(res.body[0]).not.toHaveProperty('active'); // active is admin-only visibility in full
  });

  test('POST /api/users - Member user should be BLOCKED from creating users', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'Hacker Member',
        email: 'hacker@company.com',
        password: 'password123',
        role: 'member'
      });
    
    expect(res.status).toBe(403);
  });

  // 3. Task Workflow State Machine Tests
  test('Full task workflow transitions (Create -> Start -> Complete -> Approve/Reject)', async () => {
    // A. Manager creates a task assigned to Member
    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Integrate OAuth 2.0 Auth',
        description: 'Complete the Azure AD login integrations.',
        priority: 'High',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: [testMemberId]
      });

    expect(createTaskRes.status).toBe(201);
    expect(createTaskRes.body.status).toBe('To Do');
    testTaskId = createTaskRes.body._id;

    // B. Member starts the task (updates status to 'In Progress')
    const startWorkRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'In Progress' });
    
    expect(startWorkRes.status).toBe(200);
    expect(startWorkRes.body.status).toBe('In Progress');

    // C. Member marks the task completed (status becomes 'Completed (Pending Approval)')
    const completeRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'Completed (Pending Approval)' });
    
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('Completed (Pending Approval)');

    // D. Member attempts to approve it themselves (should be blocked)
    const unauthorizedApproveRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'Approved' });
    
    expect(unauthorizedApproveRes.status).toBe(403);

    // E. Manager rejects it with feedback comment
    const rejectRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Rejected', feedback: 'Please verify the Redirect URLs in Azure Console.' });
    
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('Rejected');
    expect(rejectRes.body.feedback).toBe('Please verify the Redirect URLs in Azure Console.');

    // F. Member submits it again
    const resubmitRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'Completed (Pending Approval)' });
    
    expect(resubmitRes.status).toBe(200);

    // G. Manager approves it
    const approveRes = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Approved' });
    
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('Approved');
  });
});
