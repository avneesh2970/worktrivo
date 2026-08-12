const AuditLog = require('../models/AuditLog');

const logAction = async ({ taskId, userId, action, oldValue = '', newValue = '' }) => {
  try {
    const auditEntry = new AuditLog({
      taskId,
      userId,
      action,
      oldValue,
      newValue
    });
    await auditEntry.save();
    return auditEntry;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};

module.exports = {
  logAction
};
