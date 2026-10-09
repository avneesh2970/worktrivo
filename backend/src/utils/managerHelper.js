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
    // Case-insensitive regex match for department names with common aliases
    const deptRegexes = departments.map(d => {
      const clean = d.trim().toLowerCase();
      if (clean === 'hr' || clean === 'human resource' || clean === 'human resources') {
        return /^(hr|human\s*resources?)$/i;
      }
      return new RegExp(`^${d.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    });
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

/**
 * Checks if a user is currently on an approved leave on a given date (defaults to now).
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Date} [onDate]
 * @returns {Promise<boolean>}
 */
async function isUserOnLeave(userId, onDate = new Date()) {
  if (!userId) return false;
  const LeaveRequest = require('../models/LeaveRequest');
  const d = new Date(onDate);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);

  const activeLeave = await LeaveRequest.findOne({
    user: userId,
    status: 'Approved',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay }
  });

  return Boolean(activeLeave);
}

/**
 * Resolves the active approvers for a given target member.
 * If their primary manager(s) are on approved leave, delegating fallback managers (or admins) become eligible.
 * Returns { primaryManagers, availableManagers, admins, fallbackUsed }
 */
async function getEffectiveApproversForUser(userIdOrDoc) {
  let user = userIdOrDoc;
  if (!user || typeof user === 'string' || user._id) {
    const id = user?._id || user;
    user = await User.findById(id);
  }
  if (!user) return { primaryManagers: [], availableManagers: [], admins: [], fallbackUsed: false };

  const allSupervisors = await getSupervisorsForUser(user);
  const admins = await User.find({ active: true, role: 'admin' }, '_id name email role department');

  const managersOnly = allSupervisors.filter(s => s.role === 'manager');
  const availableManagers = [];

  for (const mgr of managersOnly) {
    const onLeave = await isUserOnLeave(mgr._id);
    if (!onLeave) {
      availableManagers.push(mgr);
    }
  }

  // If all assigned managers are on leave (or none exist), fallback to other managers or admins
  let fallbackUsed = false;
  if (managersOnly.length > 0 && availableManagers.length === 0) {
    fallbackUsed = true;
  }

  return {
    primaryManagers: managersOnly,
    availableManagers,
    admins,
    fallbackUsed
  };
}

/**
 * Checks whether an actor (manager/admin) is allowed to approve/reject an item belonging to targetUserId.
 * If actor is Admin: always allowed.
 * If actor is Manager:
 *   1. Allowed if actor is normally a manager for targetUserId AND not on leave.
 *   2. If the user's primary assigned manager is on leave:
 *      Another manager (e.g. In the same department or assigned) or any active manager/admin can step in.
 */
async function canUserApproveFor(actor, targetUserId) {
  if (!actor || !targetUserId) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'manager') return false;

  const targetIdStr = targetUserId.toString();
  const actorIdStr = (actor._id || actor.id).toString();

  // Manager cannot approve themselves
  if (targetIdStr === actorIdStr) return false;

  // 1. Direct normal management check
  const directlyManages = await isUserManagedBy(actor, targetUserId);
  if (directlyManages) return true;

  // 2. Check if all primary managers for targetUserId are on leave
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return false;

  const supervisors = await getSupervisorsForUser(targetUser);
  const primaryManagers = supervisors.filter(s => s.role === 'manager');

  if (primaryManagers.length > 0) {
    let allOnLeave = true;
    for (const pm of primaryManagers) {
      const onLeave = await isUserOnLeave(pm._id);
      if (!onLeave) {
        allOnLeave = false;
        break;
      }
    }

    // If all primary managers are on leave, another manager can approve if:
    // a) They share the same department with targetUser or primary manager, OR
    // b) If no department manager is available, any active manager is allowed as proxy
    if (allOnLeave) {
      const actorDept = (actor.department || actor.assignedDepartment || '').trim().toLowerCase();
      const targetDept = (targetUser.department || '').trim().toLowerCase();
      if (actorDept && targetDept && actorDept === targetDept) {
        return true;
      }
      // Or if actor is an assigned manager in the organisation
      return true;
    }
  } else {
    // If user has no manager assigned at all, any manager or admin can approve
    return true;
  }

  return false;
}

module.exports = {
  getManagedUserIds,
  isUserManagedBy,
  getSupervisorsForUser,
  isUserOnLeave,
  getEffectiveApproversForUser,
  canUserApproveFor
};

