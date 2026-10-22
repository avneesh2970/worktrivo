const User = require('../models/User');
const Department = require('../models/Department');

// High performance in-memory TTL caches to eliminate redundant DB roundtrips over Atlas WAN
const managedUserCache = new Map();   // key: managerId -> { value: ObjectId[], expiresAt: number }
const delegatedUserCache = new Map(); // key: actorId -> { value: string[], expiresAt: number }

function clearManagerCache() {
  managedUserCache.clear();
  delegatedUserCache.clear();
}

function areDepartmentsMatching(deptA, deptB) {
  if (!deptA || !deptB) return false;
  const a = deptA.trim().toLowerCase();
  const b = deptB.trim().toLowerCase();
  if (a === b) return true;
  const isHrA = /(hr|human\s*resources?|talent\s*acquisition|recruiter)/i.test(a);
  const isHrB = /(hr|human\s*resources?|talent\s*acquisition|recruiter)/i.test(b);
  if (isHrA && isHrB) return true;
  return false;
}


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
async function getManagedUserIds(managerOrId) {
  if (!managerOrId) return [];

  let manager = managerOrId;
  if (typeof managerOrId === 'string' || (!manager.role && manager._id)) {
    manager = await User.findById(managerOrId).lean();
    if (!manager) return [];
  }

  const managerId = manager._id ? manager._id.toString() : manager.id;

  // Check TTL cache (30s cache)
  const now = Date.now();
  const cached = managedUserCache.get(managerId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (manager.role === 'admin') {
    // Admin manages all users
    const allUsers = await User.find({ _id: { $ne: manager._id } }, '_id').lean();
    const result = allUsers.map(u => u._id);
    managedUserCache.set(managerId, { value: result, expiresAt: now + 30000 });
    return result;
  }

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
    const managedDeptDocs = await Department.find({ manager: managerId }, 'name').lean();
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
      if (clean === 'hr' || clean === 'human resource' || clean === 'human resources' || clean.includes('talent acquisition') || clean.includes('recruiter')) {
        return /(hr|human\s*resources?|talent\s*acquisition|recruiter)/i;
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

  const users = await User.find(query, '_id').lean();
  const ids = users.map(u => u._id);
  managedUserCache.set(managerId, { value: ids, expiresAt: now + 30000 });
  return ids;
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

  const targetIdStr = (targetUserId?._id || targetUserId).toString();
  const managerIdStr = (manager._id || manager.id || manager).toString();

  // Manager cannot approve themselves as an employee report
  if (targetIdStr === managerIdStr) return false;

  // 1. Direct check in manager's managedUserIds (guarantees consistency between list view & action)
  const managedIds = await getManagedUserIds(manager);
  if (managedIds.some(id => id.toString() === targetIdStr)) {
    return true;
  }

  // Direct check in manager's assignedMembers if populated or array of IDs
  if (Array.isArray(manager.assignedMembers)) {
    const isDirectMember = manager.assignedMembers.some(m => (m._id ? m._id.toString() : m.toString()) === targetIdStr);
    if (isDirectMember) return true;
  }

  // Direct check on target user
  const targetUser = await User.findById(targetIdStr, 'department manager').lean();
  if (!targetUser) return false;

  if (targetUser.manager && targetUser.manager.toString() === managerIdStr) {
    return true;
  }

  const departments = [];
  if (manager.assignedDepartment && manager.assignedDepartment.trim()) {
    departments.push(manager.assignedDepartment.trim());
  }
  if (Array.isArray(manager.assignedDepartments)) {
    manager.assignedDepartments.forEach(d => {
      if (d && d.trim()) departments.push(d.trim());
    });
  }
  if (departments.length === 0 && manager.department && manager.department.trim()) {
    departments.push(manager.department.trim());
  }

  if (targetUser.department && departments.some(d => areDepartmentsMatching(d, targetUser.department))) {
    return true;
  }

  // Check if manager manages targetUser's department via Department doc
  if (targetUser.department) {
    const deptDoc = await Department.findOne({
      name: new RegExp(`^${targetUser.department.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'),
      manager: managerIdStr
    }, '_id').lean();
    if (deptDoc) return true;
  }

  return false;
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
  if (!user) return [];
  if (typeof user === 'string' || (!user.department && !user.manager && user._id)) {
    const id = user?._id || user;
    user = await User.findById(id).lean();
  }
  if (!user) return [];

  const supervisorMap = new Map();

  // 1. Direct assigned manager
  if (user.manager) {
    const directMgr = await User.findOne({ _id: user.manager, active: true }, '_id name email role profilePhoto designationRole department').lean();
    if (directMgr) {
      supervisorMap.set(directMgr._id.toString(), directMgr);
    }
  }

  // 2. Department manager from Department model
  if (user.department && user.department.trim()) {
    const isHr = /(hr|human\s*resources?|talent\s*acquisition|recruiter)/i.test(user.department);
    const deptRegex = isHr
      ? /(hr|human\s*resources?|talent\s*acquisition|recruiter)/i
      : new RegExp(`^${user.department.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    const deptDoc = await Department.findOne({ name: deptRegex }).populate('manager', '_id name email role profilePhoto designationRole department').lean();
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
    ).lean();
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
  ).lean();
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
  ).sort({ name: 1 }).lean();

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
 * Efficiently finds user IDs that this manager can proxy-approve for
 * because their primary managers are currently on approved leave today.
 * Instead of checking every user in the company in an O(N) loop with multiple DB queries,
 * this checks active manager leaves in ONE single indexed query.
 */
async function getDelegatedUserIdsForManager(actor) {
  if (!actor || actor.role !== 'manager') return [];

  const actorIdStr = (actor._id || actor.id).toString();
  const now = Date.now();
  const cached = delegatedUserCache.get(actorIdStr);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const LeaveRequest = require('../models/LeaveRequest');
  const d = new Date();
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Find all managers on approved leave today in ONE single indexed query
  const activeManagerLeaves = await LeaveRequest.find({
    status: 'Approved',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay }
  }).populate({
    path: 'user',
    select: '_id role department assignedDepartment assignedDepartments assignedMembers'
  }).lean();

  const onLeaveManagers = activeManagerLeaves
    .filter(l => l.user && l.user.role === 'manager' && l.user._id.toString() !== actorIdStr)
    .map(l => l.user);

  if (onLeaveManagers.length === 0) {
    delegatedUserCache.set(actorIdStr, { value: [], expiresAt: now + 30000 });
    return [];
  }

  // 2. For each manager on leave, get their team's user IDs
  const delegatedUserIds = new Set();
  for (const leaveMgr of onLeaveManagers) {
    const teamOfLeaveMgr = await getManagedUserIds(leaveMgr);
    teamOfLeaveMgr.forEach(id => delegatedUserIds.add(id.toString()));
  }

  const result = Array.from(delegatedUserIds);
  delegatedUserCache.set(actorIdStr, { value: result, expiresAt: now + 30000 });
  return result;
}

/**
 * Resolves the active approvers for a given target member.
 * If their primary manager(s) are on approved leave, delegating fallback managers (or admins) become eligible.
 * Returns { primaryManagers, availableManagers, admins, fallbackUsed }
 */
async function getEffectiveApproversForUser(userIdOrDoc) {
  let user = userIdOrDoc;
  if (!user || typeof user === 'string' || (!user.department && !user.manager && user._id)) {
    const id = user?._id || user;
    user = await User.findById(id).lean();
  }
  if (!user) return { primaryManagers: [], availableManagers: [], admins: [], fallbackUsed: false };

  const allSupervisors = await getSupervisorsForUser(user);
  const admins = await User.find({ active: true, role: 'admin' }, '_id name email role department').lean();

  const managersOnly = allSupervisors.filter(s => s.role === 'manager');
  const availableManagers = [];

  if (managersOnly.length > 0) {
    const d = new Date();
    const startOfDay = new Date(d);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);
    const LeaveRequest = require('../models/LeaveRequest');

    const onLeaveLeaves = await LeaveRequest.find({
      user: { $in: managersOnly.map(m => m._id) },
      status: 'Approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay }
    }, 'user').lean();

    const onLeaveSet = new Set(onLeaveLeaves.map(l => l.user.toString()));
    for (const mgr of managersOnly) {
      if (!onLeaveSet.has(mgr._id.toString())) {
        availableManagers.push(mgr);
      }
    }
  }

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

  const targetIdStr = (targetUserId?._id || targetUserId).toString();
  const actorIdStr = (actor._id || actor.id).toString();

  // Manager cannot approve themselves
  if (targetIdStr === actorIdStr) return false;

  // 1. Direct normal management check
  const directlyManages = await isUserManagedBy(actor, targetUserId);
  if (directlyManages) return true;

  // 2. Check if all primary managers for targetUserId are on leave
  const targetUser = await User.findById(targetUserId, 'department manager').lean();
  if (!targetUser) return false;

  const supervisors = await getSupervisorsForUser(targetUser);
  const primaryManagers = supervisors.filter(s => s.role === 'manager');

  if (primaryManagers.length > 0) {
    const pmIds = primaryManagers.map(pm => pm._id);
    const LeaveRequest = require('../models/LeaveRequest');
    const d = new Date();
    const startOfDay = new Date(d);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);

    const onLeaveCount = await LeaveRequest.countDocuments({
      user: { $in: pmIds },
      status: 'Approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay }
    });

    return onLeaveCount >= primaryManagers.length;
  } else {
    // If user has no manager assigned at all, any manager or admin can approve
    return true;
  }
}

module.exports = {
  areDepartmentsMatching,
  getManagedUserIds,
  isUserManagedBy,
  getSupervisorsForUser,
  isUserOnLeave,
  getEffectiveApproversForUser,
  canUserApproveFor,
  getDelegatedUserIdsForManager,
  clearManagerCache
};

