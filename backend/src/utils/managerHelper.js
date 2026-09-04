const User = require('../models/User');
const Department = require('../models/Department');

/**
 * Returns a list of all User IDs managed by the given manager user.
 * A user is managed if:
 * 1. The user's department matches any of manager's assignedDepartments, assignedDepartment, manager.department,
 *    or a Department record where manager is set to this manager.
 * 2. The user is in manager's assignedMembers array.
 * 3. The user has this manager set in their `manager` field.
 *
 * @param {Object} manager - The manager User document or object with _id, role, assignedDepartment, assignedDepartments, assignedMembers.
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Array of managed user ObjectIds.
 */
async function getManagedUserIds(manager) {
  if (!manager) return [];
  if (manager.role === 'admin') {
    // Admin manages all users
    const allUsers = await User.find({ _id: { $ne: manager._id } }, '_id');
    return allUsers.map(u => u._id);
  }

  const managerId = manager._id ? manager._id.toString() : manager.id;

  // Collect departments assigned to this manager
  const departments = [];
  if (manager.assignedDepartment && manager.assignedDepartment.trim()) {
    departments.push(manager.assignedDepartment.trim());
  }
  if (Array.isArray(manager.assignedDepartments)) {
    manager.assignedDepartments.forEach(d => {
      if (d && d.trim() && !departments.includes(d.trim())) {
        departments.push(d.trim());
      }
    });
  }
  // Fallback: if manager has department set and no specific assignedDepartment
  if (departments.length === 0 && manager.department && manager.department.trim()) {
    departments.push(manager.department.trim());
  }

  // Also query Department collection for departments where manager is this user
  try {
    const managedDeptDocs = await Department.find({ manager: managerId }, 'name');
    managedDeptDocs.forEach(d => {
      if (d.name && d.name.trim() && !departments.includes(d.name.trim())) {
        departments.push(d.name.trim());
      }
    });
  } catch (err) {
    console.error('Error fetching managed departments:', err);
  }

  // Collect explicitly assigned member IDs
  const directMemberIds = Array.isArray(manager.assignedMembers)
    ? manager.assignedMembers.map(m => (m._id ? m._id.toString() : m.toString()))
    : [];

  const conditions = [];

  // 1. Match users in the manager's assigned department(s)
  if (departments.length > 0) {
    // Case-insensitive regex match for department names
    const deptRegexes = departments.map(d => new RegExp(`^${d.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'));
    conditions.push({ department: { $in: deptRegexes } });
  }

  // 2. Direct members in assignedMembers
  if (directMemberIds.length > 0) {
    conditions.push({ _id: { $in: directMemberIds } });
  }

  // 3. Members referencing this manager
  conditions.push({ manager: managerId });

  if (conditions.length === 0) {
    return [];
  }

  const query = {
    $and: [
      { _id: { $ne: managerId } }, // Do not include the manager themselves in their team list
      { $or: conditions }
    ]
  };

  const users = await User.find(query, '_id');
  return users.map(u => u._id);
}

/**
 * Checks if a target user is managed by the given manager user.
 *
 * @param {Object} manager - Manager User document/object.
 * @param {string|mongoose.Types.ObjectId} targetUserId - The ID of the target user.
 * @returns {Promise<boolean>}
 */
async function isUserManagedBy(manager, targetUserId) {
  if (!manager || !targetUserId) return false;
  if (manager.role === 'admin') return true;

  const targetIdStr = targetUserId.toString();
  const managerIdStr = manager._id ? manager._id.toString() : manager.id;

  // Manager cannot approve themselves as an employee report
  if (targetIdStr === managerIdStr) return false;

  const managedIds = await getManagedUserIds(manager);
  return managedIds.some(id => id.toString() === targetIdStr);
}

/**
 * Returns the list of supervisors (assigned manager(s)) for a given user.
 * If no manager is assigned to the user or their department, returns all active Admin users.
 *
 * @param {Object|string|mongoose.Types.ObjectId} userIdOrDoc - User document or user ObjectId.
 * @returns {Promise<Array<Object>>} Array of user objects (managers or fallback admins).
 */
async function getSupervisorsForUser(userIdOrDoc) {
  let user = userIdOrDoc;
  if (!user || typeof user === 'string' || user._id) {
    const id = user?._id || user;
    user = await User.findById(id);
  }
  if (!user) return [];

  const supervisorMap = new Map();

  // 1. Direct assigned manager
  if (user.manager) {
    const directMgr = await User.findOne({ _id: user.manager, active: true }, '_id name email role profilePhoto designationRole department');
    if (directMgr) {
      supervisorMap.set(directMgr._id.toString(), directMgr);
    }
  }

  // 2. Department manager from Department model
  if (user.department && user.department.trim()) {
    const deptRegex = new RegExp(`^${user.department.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    const deptDoc = await Department.findOne({ name: deptRegex }).populate('manager', '_id name email role profilePhoto designationRole department');
    if (deptDoc && deptDoc.manager && deptDoc.manager.active !== false) {
      supervisorMap.set(deptDoc.manager._id.toString(), deptDoc.manager);
    }

    // Also check manager users with assignedDepartment / assignedDepartments matching user.department
    const deptManagers = await User.find(
      {
        active: true,
        role: 'manager',
        $or: [
          { assignedDepartment: deptRegex },
          { assignedDepartments: { $in: [deptRegex] } }
        ]
      },
      '_id name email role profilePhoto designationRole department'
    );
    deptManagers.forEach(mgr => {
      supervisorMap.set(mgr._id.toString(), mgr);
    });
  }

  // 3. Managers having user in their assignedMembers array
  const directSupervisors = await User.find(
    {
      active: true,
      role: 'manager',
      assignedMembers: user._id
    },
    '_id name email role profilePhoto designationRole department'
  );
  directSupervisors.forEach(mgr => {
    supervisorMap.set(mgr._id.toString(), mgr);
  });

  // If one or more managers found, return them
  if (supervisorMap.size > 0) {
    return Array.from(supervisorMap.values());
  }

  // Fallback: If no manager is assigned, return all active Admins
  const admins = await User.find(
    { active: true, role: 'admin' },
    '_id name email role profilePhoto designationRole department'
  ).sort({ name: 1 });

  return admins;
}

module.exports = {
  getManagedUserIds,
  isUserManagedBy,
  getSupervisorsForUser
};

