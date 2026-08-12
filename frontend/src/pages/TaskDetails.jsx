import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  ArrowLeft, Calendar, User, MessageSquare, History, FileText,
  Play, CheckCircle, XCircle, AlertCircle, ArrowUpCircle, Send
} from 'lucide-react';
import FileUpload from "../components/FileUpload";
import FileList from "../components/FileList";

const TaskDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { socket } = useSocket();

  // Task & Sub-states
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshFiles, setRefreshFiles] = useState(false);

  const refreshTaskFiles = () => {
    setRefreshFiles(prev => !prev);
  };

  // Input states
  const [newComment, setNewComment] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchTaskDetails = async () => {
    try {
      // 1. Fetch Task
      const taskRes = await fetch(`${API_BASE}/tasks/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!taskRes.ok) {
        if (taskRes.status === 403) alert('You do not have permission to view this task.');
        navigate('/tasks');
        return;
      }
      const taskData = await taskRes.json();
      setTask(taskData);

      // 2. Fetch Comments
      const commentsRes = await fetch(`${API_BASE}/tasks/${id}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const commentsData = await commentsRes.json();
      setComments(Array.isArray(commentsData) ? commentsData : []);

      // 3. Fetch History Logs
      const historyRes = await fetch(`${API_BASE}/tasks/${id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const historyData = await historyRes.json();
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error('Error loading task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  useEffect(() => {
    if (!socket) {
      console.log("Socket not available");
      return;
    }
    console.log("Socket connected, listener registered");
    const handleTaskUpdate = (data) => {
      if (data.taskId === id) {
        console.log("Fetching latest task...");
        fetchTaskDetails();
      }
    };

    socket.on('taskUpdated', handleTaskUpdate);

    return () => {
      socket.off('taskUpdated', handleTaskUpdate);
    };
  }, [socket, id]);

  const handleStatusChange = async (newStatus, feedback = '') => {
    setActionError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, feedback })
      });

      const data = await res.json();
      if (res.ok) {
        setIsRejectDialogOpen(false);
        setIsApproveConfirmOpen(false);
        setFeedbackText('');
        fetchTaskDetails();
      } else {
        setActionError(data.error || 'Failed to update task status.');
      }
    } catch (err) {
      setActionError('Network error. Failed to update status.');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: newComment.trim() })
      });

      if (res.ok) {
        setNewComment('');
        fetchTaskDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to post comment.');
      }
    } catch (err) {
      alert('Error posting comment.');
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    const styles = {
      'To Do': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      'In Progress': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'Completed (Pending Approval)': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      'Approved': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      'Rejected': 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      'Overdue': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800',
    };
    const defaultStyle = 'bg-slate-100 text-slate-700 border-slate-200';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || defaultStyle}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      High: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      Low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[priority] || 'bg-slate-100 text-slate-800'}`}>
        {priority} Priority
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#dc9750]/90 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500">
        <p className="text-lg font-medium">Task not found.</p>
      </div>
    );
  }

  const isAssignee = task.assignedTo.some(u => u._id === user._id);
  const isAdmin = user.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Navigation Top Bar */}
      <div>
        <button
          onClick={() => navigate('/tasks')}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Tasks</span>
        </button>
      </div>

      {/* Global Error Alert Banner */}
      {actionError && (
        <div className="flex items-center gap-3 p-4 text-sm text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-xl">
          <AlertCircle size={18} className="shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Grid Layout (Dark Theme Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Details & Discussion */}
        <div className="lg:col-span-2 space-y-6">

          {/* Main Task Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{task.title}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(task.status)}
                  {getPriorityBadge(task.priority)}
                </div>
              </div>

              {/* Dynamic Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Assignee Actions */}
                {isAssignee && !isAdmin && (
                  <>
                    {(task.status === 'To Do' || task.status === 'Overdue') && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('In Progress')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                      >
                        <Play size={16} />
                        <span>Start Work</span>
                      </button>
                    )}
                    {(task.status === 'To Do' || task.status === 'In Progress' || task.status === 'Rejected' || task.status === 'Overdue') && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('Completed (Pending Approval)')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                      >
                        <ArrowUpCircle size={16} />
                        <span>Submit for Approval</span>
                      </button>
                    )}
                  </>
                )}

                {/* Manager / Admin Actions */}
                {isAdmin && (
                  <>
                    {task.status === 'Completed (Pending Approval)' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsApproveConfirmOpen(true)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
                        >
                          <CheckCircle size={16} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRejectDialogOpen(true)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-colors"
                        >
                          <XCircle size={16} />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Description Block */}
            <div className="py-6 space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</h4>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {task.description || 'No description provided.'}
              </p>
            </div>

            {/* Rejection Alert Box */}
            {task.status === 'Rejected' && task.feedback && (
              <div className="mb-6 p-4 flex gap-3 bg-rose-950/40 border border-rose-800 rounded-xl">
                <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Manager Rejection Feedback</h5>
                  <p className="text-sm italic text-rose-200">"{task.feedback}"</p>
                </div>
              </div>
            )}

            {/* Attachments Section */}
            <div className="py-6 space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Attachments
              </h4>

              <FileUpload
                taskId={task._id}
                onUpload={refreshTaskFiles}
              />

              <FileList
                taskId={task._id}
                refresh={refreshFiles}
                onDelete={refreshTaskFiles}
              />
            </div>

            {/* Task Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-800 rounded-lg text-slate-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Due Date</span>
                  <span className="text-sm font-semibold text-slate-200">{new Date(task.dueDate).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-800 rounded-lg text-slate-400">
                  <User size={18} />
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-400">Created By</span>
                  <span className="text-sm font-semibold text-slate-200">{task.createdBy ? task.createdBy.name : 'Unknown'}</span>
                </div>
              </div>

              <div className="sm:col-span-2 pt-2">
                <span className="block text-xs font-medium text-slate-400 mb-2">Assigned Team Members</span>
                <div className="flex flex-wrap gap-2">
                  {task.assignedTo.map(u => (
                    <div key={u._id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-[#dc9750] text-white flex items-center justify-center text-[10px] font-bold uppercase">
                        {u.name.charAt(0)}
                      </span>
                      <span>{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Discussion / Comments Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-4">
              <MessageSquare size={20} className="text-[#dc9750]" />
              <span>Discussion ({comments.length})</span>
            </h3>

            {/* Comments List */}
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
              {comments.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No comments yet. Start the conversation!</p>
              ) : (
                comments.map(c => (
                  <div key={c._id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#dc9750] to-[#b97737] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {c.userId?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-bold text-slate-200">{c.userId?.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300 rounded">
                          {c.userId?.role === 'admin' ? 'Manager' : 'Team Member'}
                        </span>
                        <span className="text-slate-500 ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{c.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Box */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#dc9750]/20 focus:border-[#dc9750]/60 text-slate-100 placeholder:text-slate-500"
                placeholder="Type your message here..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#dc9750] hover:bg-[#b97737] rounded-xl shadow-sm transition-colors"
              >
                <span>Post</span>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Audit Trail / History */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-4 mb-6">
            <History size={20} className="text-[#dc9750]" />
            <span>Audit Trail / History</span>
          </h3>

          <div className="relative pl-4 border-l-2 border-slate-800 space-y-6">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No history events logged.</p>
            ) : (
              history.map((log) => (
                <div key={log._id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#dc9750] ring-4 ring-slate-900" />

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-300">{log.userId ? log.userId.name : 'System'}</span>
                      <span>•</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>

                    <p className="text-xs font-medium text-slate-200 leading-snug">
                      {log.action}
                    </p>

                    {log.oldValue && (
                      <div className="p-2 bg-slate-800/50 rounded-lg text-xs space-y-0.5 border border-slate-800">
                        <div className="text-slate-400">From: <span className="line-through text-rose-400 font-medium">{log.oldValue}</span></div>
                        <div className="text-slate-400">To: <span className="text-emerald-400 font-medium">{log.newValue}</span></div>
                      </div>
                    )}

                    {!log.oldValue && log.newValue && (
                      <div className="p-2 bg-slate-800/50 rounded-lg text-xs text-slate-400 border border-slate-800">
                        Info: <span className="text-slate-300 font-medium">{log.newValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* APPROVE CONFIRMATION DIALOG MODAL */}
{isApproveConfirmOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <h3 className="text-lg font-bold text-slate-100">Approve Completed Task</h3>
      <p className="text-sm text-slate-300 leading-relaxed">
        Are you sure you want to mark this task as approved? The task status will move to "Approved" and the assigned team members will be notified.
      </p>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          onClick={() => setIsApproveConfirmOpen(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
          onClick={() => handleStatusChange('Approved')}
        >
          Approve Task
        </button>
      </div>
    </div>
  </div>
)}

{/* REJECT FEEDBACK MODAL */}
{isRejectDialogOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-slate-100">Reject Completed Task</h3>
        <p className="text-xs text-slate-400">
          Provide feedback to guide the team member on required edits. Feedback is required.
        </p>
      </div>

      <textarea
        className="w-full p-3 text-sm bg-slate-800/80 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/60 text-slate-100 placeholder:text-slate-500 min-h-[100px] resize-none"
        placeholder="Ex. Coordinates translation missing. Please complete section 3..."
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          onClick={() => setIsRejectDialogOpen(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 rounded-lg shadow-sm transition-colors"
          onClick={() => handleStatusChange('Rejected', feedbackText)}
          disabled={!feedbackText.trim()}
        >
          Reject Task
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default TaskDetails;