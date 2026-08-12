import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadReport } from "../utils/reportGenerator";
import { useAuth, API_BASE } from '../context/AuthContext';
import LoginActivity from "../components/LoginActivity";
import MemberDashboard from "../components/MemberDashboard";
import {
  CheckSquare, Clock, AlertTriangle, Users,
  ArrowRight, History, Download, Plus, Activity,
  TrendingUp, AlertCircle, FileText, CheckCircle2,
  XCircle, PlayCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper check for admin or manager role
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const fetchData = async () => {
    setLoading(true);
    try {
      const tasksRes = await fetch(`${API_BASE}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tasksData = await tasksRes.json();
      setTasks(Array.isArray(tasksData) ? tasksData : []);

      if (isAdminOrManager) {
        const usersRes = await fetch(`${API_BASE}/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);

        const logsRes = await fetch(`${API_BASE}/tasks/audit/logs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const logsData = await logsRes.json();
        setAuditLogs(Array.isArray(logsData) ? logsData : []);
      }
    } catch (err) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse p-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-7 w-52 bg-white/10 rounded-lg"></div>
            <div className="h-4 w-80 bg-white/5 rounded-md"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-36 bg-white/10 rounded-xl"></div>
            <div className="h-10 w-36 bg-white/10 rounded-xl"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-white/5 bg-white/5 p-5"></div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-2xl border border-white/5 bg-white/5"></div>
          <div className="h-80 rounded-2xl border border-white/5 bg-white/5"></div>
        </div>
      </div>
    );
  }

  // Common Metrics
  const totalTasks = tasks.length;
  const pendingApprovals = tasks.filter(t => t.status === 'Completed (Pending Approval)').length;
  const overdueTasks = tasks.filter(t => t.status === 'Overdue').length;
  const approvedTasks = tasks.filter(t => t.status === 'Approved').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const todoTasks = tasks.filter(t => t.status === 'To Do').length;
  const rejectedTasks = tasks.filter(t => t.status === 'Rejected').length;
  const activeMembers = users.filter(u => u.role === 'member' && u.active).length;

  const getPercentage = (count) => (totalTasks === 0 ? 0 : Math.round((count / totalTasks) * 100));

  const handleDownloadReport = () => {
    downloadReport({
      generatedBy: user.name,
      role: user.role,
      totalTasks,
      approvedTasks,
      pendingApprovals,
      overdueTasks,
      inProgressTasks,
      todoTasks,
      rejectedTasks,
      activeMembers,
      totalMembers: users.length
    });
  };

  const getLogBadge = (action) => {
    switch (action) {
      case 'Created':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Created</span>;
      case 'Status Changed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Status</span>;
      case 'Comment Added':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Comment</span>;
      case 'Feedback Added':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Feedback</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">Updated</span>;
    }
  };

  const formatLogAction = (log) => {
    const taskTitle = log.taskId ? log.taskId.title : 'Deleted Task';
    switch (log.action) {
      case 'Created': return `created "${taskTitle}"`;
      case 'Status Changed': return `changed status of "${taskTitle}" to ${log.newValue}`;
      case 'Comment Added': return `commented on "${taskTitle}"`;
      case 'Feedback Added': return `added rejection feedback to "${taskTitle}"`;
      case 'Title Updated': return `renamed task to "${taskTitle}"`;
      default: return `${log.action.toLowerCase()} on "${taskTitle}"`;
    }
  };

  // ---------------- TEAM MEMBER DASHBOARD ----------------
  if (!isAdminOrManager) {
    return (
      <MemberDashboard
        user={user}
        tasks={tasks}
        handleDownloadReport={handleDownloadReport}
      />
    );
  }

  // ---------------- MANAGER / ADMIN DASHBOARD ----------------
  const pendingTasksList = tasks.filter(t => t.status === 'Completed (Pending Approval)');
  const overdueTasksList = tasks.filter(t => t.status === 'Overdue');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1426] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Left: User Info */}
          <div>
            <div className="mb-2">
              <span className="inline-block rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 border border-slate-700 capitalize">
                {user.role} Workspace
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user.name}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Here is what's happening across your team's workflow today.
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Export Report
            </button>

            <button
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#dc9750] hover:bg-[#c4823f] px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
            >
              <Plus size={16} />
              Create Task
            </button>
          </div>

        </div>
      </div>

      {/* Metrics Grid */}
      <div 
        onClick={() => navigate("/tasks?filter=active")}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="group rounded-2xl border border-white/10 bg-[#0d1426]/80 p-5 backdrop-blur-md hover:border-indigo-500/30 transition-all duration-300 shadow-md cursor-pointer">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Total Active Tasks</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <CheckSquare size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white">{totalTasks}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp size={12} /> Active
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>{todoTasks} To Do</span>
            <span className="h-1 w-1 rounded-full bg-gray-600"></span>
            <span>{inProgressTasks} In Progress</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => navigate("/approvals?filter=pending")}
          className="group rounded-2xl border border-white/10 bg-[#0d1426]/80 p-5 backdrop-blur-md hover:border-amber-500/30 transition-all duration-300 shadow-md cursor-pointer">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Pending Approvals</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-amber-400">{pendingApprovals}</span>
            {pendingApprovals > 0 && (
              <span className="animate-pulse text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Action Required
              </span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400 truncate">
            {pendingApprovals === 0 ? "All caught up!" : "Awaiting management review"}
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => navigate("/tasks?filter=overdue")}className="group rounded-2xl border border-white/10 bg-[#0d1426]/80 p-5 backdrop-blur-md hover:border-rose-500/30 transition-all duration-300 shadow-md cursor-pointer">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Overdue Tasks</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-rose-400">{overdueTasks}</span>
            {overdueTasks > 0 && (
              <span className="text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                Critical
              </span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400">
            Missed completion deadlines
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          onClick={() => navigate("/manage-team?filter=active")}
          className="group rounded-2xl border border-white/10 bg-[#0d1426]/80 p-5 backdrop-blur-md hover:border-emerald-500/30 transition-all duration-300 shadow-md cursor-pointer">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Active Team Members</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-white">{activeMembers}</span>
            <span className="text-[11px] font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              Total {users.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400">
            Currently assigned members
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Status Breakdown Card */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1426]/80 p-6 backdrop-blur-md space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" />
                <h3 className="font-heading text-base font-semibold text-white">Task Status Breakdown</h3>
              </div>
              <span className="text-xs text-gray-400">{totalTasks} Total Tasks</span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Approved */}
              <div>
                <div className="flex justify-between items-center text-gray-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Approved / Completed</span>
                  <span className="text-gray-400">{getPercentage(approvedTasks)}% <span className="text-gray-500">({approvedTasks})</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 p-0.5 border border-white/5">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${getPercentage(approvedTasks)}%` }}></div>
                </div>
              </div>

              {/* In Progress */}
              <div>
                <div className="flex justify-between items-center text-gray-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><PlayCircle size={14} className="text-blue-400" /> In Progress</span>
                  <span className="text-gray-400">{getPercentage(inProgressTasks)}% <span className="text-gray-500">({inProgressTasks})</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 p-0.5 border border-white/5">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${getPercentage(inProgressTasks)}%` }}></div>
                </div>
              </div>

              {/* Pending Approval */}
              <div>
                <div className="flex justify-between items-center text-gray-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-amber-400" /> Pending Approval</span>
                  <span className="text-gray-400">{getPercentage(pendingApprovals)}% <span className="text-gray-500">({pendingApprovals})</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 p-0.5 border border-white/5">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${getPercentage(pendingApprovals)}%` }}></div>
                </div>
              </div>

              {/* Overdue */}
              <div>
                <div className="flex justify-between items-center text-gray-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><XCircle size={14} className="text-rose-400" /> Overdue</span>
                  <span className="text-gray-400">{getPercentage(overdueTasks)}% <span className="text-gray-500">({overdueTasks})</span></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 p-0.5 border border-white/5">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${getPercentage(overdueTasks)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approvals Action List */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1426]/80 p-6 backdrop-blur-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-amber-400" />
                <h3 className="font-heading text-base font-semibold text-white">
                  Pending Approvals
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {pendingTasksList.length} Tasks
              </span>
            </div>

            {pendingTasksList.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400/50" />
                <p className="text-xs text-gray-400">All submissions have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {pendingTasksList.map(task => (
                  <div
                    key={task._id}
                    onClick={() => navigate(`/tasks/${task._id}`)}
                    className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:bg-white/5 hover:border-amber-500/30 cursor-pointer transition-all duration-200"
                  >
                    <div className="space-y-1 pr-2">
                      <p className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Users size={12} className="text-gray-500" />
                        <span>Assigned: {task.assignedTo?.map(u => u.name).join(', ') || 'Unassigned'}</span>
                      </p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-amber-500 group-hover:text-slate-900 text-gray-400 transition-all shrink-0">
                      <ArrowRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Audit Activity Feed */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1426]/80 p-6 backdrop-blur-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-indigo-400" />
                <h3 className="font-heading text-base font-semibold text-white">Recent Activity Feed</h3>
              </div>
              <span className="text-xs text-gray-400">Live System Logs</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <FileText size={32} className="mx-auto text-gray-600" />
                <p className="text-xs text-gray-400">No activity logged yet.</p>
              </div>
            ) : (
              <div className="relative pl-3 space-y-4 max-h-80 overflow-y-auto pr-1 border-l border-white/10 custom-scrollbar ml-2">
                {auditLogs.map(log => (
                  <div key={log._id} className="relative flex items-start justify-between gap-3 text-xs pl-4 group">
                    {/* Timeline Node */}
                    <div className="absolute -left-[17px] top-1 h-2.5 w-2.5 rounded-full border border-indigo-500 bg-[#0d1426] group-hover:bg-indigo-500 transition-colors"></div>

                    <div className="space-y-1">
                      <p className="text-gray-300 leading-relaxed">
                        <strong className="text-white font-medium">{log.userId ? log.userId.name : 'System'}</strong>{' '}
                        <span className="text-gray-400">{formatLogAction(log)}</span>
                      </p>
                      <p className="text-gray-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {getLogBadge(log.action)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical Overdue Tasks Alert */}
          {overdueTasksList.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-md space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-rose-500/10 pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-400" />
                  <h3 className="font-heading text-base font-semibold text-rose-400">
                    Critical Overdue Tasks
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  High Priority
                </span>
              </div>

              <div className="space-y-2">
                {overdueTasksList.slice(0, 3).map(task => (
                  <div
                    key={task._id}
                    onClick={() => navigate(`/tasks/${task._id}`)}
                    className="group flex items-center justify-between rounded-xl border border-rose-500/10 bg-white/[0.02] p-3 hover:bg-rose-500/10 cursor-pointer transition-all duration-200"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors line-clamp-1">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-rose-400 font-medium">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-rose-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Width Login Activity Section */}
      <div className="pt-2">
        <LoginActivity />
      </div>
    </div>
  );
};

export default Dashboard;