import React, { useMemo, useState } from 'react';
import { Calendar, GripVertical, AlertTriangle, X } from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

const COLUMNS = [
  { key: 'To Do', dot: 'bg-slate-400' },
  { key: 'In Progress', dot: 'bg-blue-500' },
  { key: 'In Review', dot: 'bg-violet-500' },
  { key: 'Blocked', dot: 'bg-orange-500' },
  { key: 'Completed (Pending Approval)', dot: 'bg-amber-500' },
  { key: 'Approved', dot: 'bg-emerald-500' },
  { key: 'Rejected', dot: 'bg-rose-500' },
];

const HEADER_STYLES = {
  'To Do': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  'In Progress': 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
  'In Review': 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400',
  'Blocked': 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400',
  'Completed (Pending Approval)': 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
  'Approved': 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400',
  'Rejected': 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400',
};

const priorityDot = {
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  High: 'bg-rose-500',
  Urgent: 'bg-red-600',
};

/**
 * Props:
 *  - tasks: array of task objects (already filtered/searched by the parent)
 *  - user: current logged in user ({ _id, role, ... })
 *  - token: auth JWT
 *  - navigate: react-router navigate fn
 *  - showToast(msg): parent's toast helper
 *  - refreshTasks(): re-fetch tasks from the parent after any change
 */
const KanbanBoard = ({ tasks, user, token, navigate, showToast, refreshTasks }) => {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { taskId, title }
  const [rejectFeedback, setRejectFeedback] = useState('');

  const isManagement = user?.role === 'admin' || user?.role === 'manager';

  const columns = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach((c) => (grouped[c.key] = []));
    tasks.forEach((t) => {
      const key = grouped[t.status] !== undefined ? t.status : 'To Do';
      grouped[key].push(t);
    });
    return grouped;
  }, [tasks]);

  const canDrag = (task) => {
    if (isManagement) return true;
    return task.assignedTo?.some((u) => u._id === user?._id);
  };

  const patchStatus = async (taskId, status, feedback) => {
    setUpdatingId(taskId);
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(feedback !== undefined ? { status, feedback } : { status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast?.(data.error || 'Could not update task status.');
      } else {
        showToast?.(`Moved to "${status}"`);
      }
    } catch (err) {
      console.error('Kanban status update failed', err);
      showToast?.('Network error while updating task.');
    } finally {
      setUpdatingId(null);
      refreshTasks?.();
    }
  };

  const handleDrop = (columnKey) => {
    setDragOverCol(null);
    const taskId = draggedId;
    setDraggedId(null);
    if (!taskId) return;

    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    if (task.status === columnKey) return;

    if (!canDrag(task)) {
      showToast?.('You are not authorized to move this task.');
      return;
    }

    if ((columnKey === 'Approved') && !isManagement) {
      showToast?.('Only managers and administrators can approve tasks.');
      return;
    }

    if (columnKey === 'Rejected') {
      if (!isManagement) {
        showToast?.('Only managers and administrators can reject tasks.');
        return;
      }
      setRejectFeedback('');
      setRejectModal({ taskId, title: task.title });
      return;
    }

    patchStatus(taskId, columnKey);
  };

  const submitRejection = () => {
    if (!rejectFeedback.trim()) return;
    patchStatus(rejectModal.taskId, 'Rejected', rejectFeedback.trim());
    setRejectModal(null);
  };

  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const colTasks = columns[col.key] || [];
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.key);
              }}
              className={`flex-shrink-0 w-72 flex flex-col rounded-xl border transition-colors ${
                dragOverCol === col.key
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'
              }`}
            >
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${HEADER_STYLES[col.key]}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold truncate">{col.key}</span>
                </div>
                <span className="text-[11px] font-bold bg-white/60 dark:bg-black/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                {colTasks.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-6">No tasks</p>
                )}
                {colTasks.map((task) => {
                  const draggable = canDrag(task);
                  const daysLeft = Math.round((new Date(task.dueDate) - new Date()) / (24 * 60 * 60 * 1000));
                  const isOverdue = task.status === 'Overdue' || (daysLeft < 0 && !['Approved'].includes(task.status));
                  const isUpdating = updatingId === task._id;

                  return (
                    <div
                      key={task._id}
                      draggable={draggable}
                      onDragStart={() => draggable && setDraggedId(task._id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => navigate(`/tasks/${task._id}`)}
                      className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer ${
                        draggedId === task._id ? 'opacity-40' : ''
                      } ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      <div className="flex items-start gap-1.5 mb-1.5">
                        {draggable && (
                          <GripVertical size={14} className="text-slate-300 dark:text-slate-700 mt-0.5 flex-shrink-0 group-hover:text-slate-400" />
                        )}
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                          {task.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[task.priority] || 'bg-slate-400'}`} />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{task.priority}</span>
                        {task.dependencies?.length > 0 && (
                          <span className="text-[10px] text-slate-400" title="Has dependencies">🔗</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                          <Calendar size={11} />
                          {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex -space-x-1 overflow-hidden">
                          {(task.assignedTo || []).slice(0, 3).map((u) => (
                            <div
                              key={u._id}
                              title={u.name}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold border-2 border-white dark:border-slate-900"
                            >
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        Drag a card to change its status. Only assignees, managers, or admins can move a task — approving/rejecting requires manager/admin rights.
      </p>

      {rejectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-500" />
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Reject task</h4>
              </div>
              <button onClick={() => setRejectModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-1">"{rejectModal.title}"</p>
            <textarea
              autoFocus
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="Reason for rejection (required)..."
              rows={3}
              className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={!rejectFeedback.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                Reject task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;