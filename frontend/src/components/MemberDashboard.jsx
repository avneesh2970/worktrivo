import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, useAuth } from '../context/AuthContext';
import {
  CheckSquare, Clock, AlertTriangle, CheckCircle, ArrowRight,
  MessageSquare, Megaphone, Pin, CheckCircle2, ChevronRight, Download,
  Sparkles, ShieldAlert, ArrowUpRight, Calendar, Filter
} from 'lucide-react';
import { formatDateTime, formatDate } from '../utils/dateUtils';

const categoryStyle = {
  'Policy Update': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Holiday': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'General News': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  'Urgent': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const MemberDashboard = ({ user, tasks = [], handleDownloadReport }) => {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Task Filter State
  const [filter, setFilter] = useState('All');

  // Cleaned up profile photo URL resolution
    const profilePhotoUrl = user?.profilePhoto
      ? (user.profilePhoto.startsWith('http') 
          ? user.profilePhoto 
          : `${API_BASE.replace(/\/api$/, '')}${user.profilePhoto}`)
      : null;

  // Announcement States
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);

  // Dynamic Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // ---------------- FETCH LATEST ANNOUNCEMENT ----------------
  const fetchLatestAnnouncement = async () => {
    try {
      setAnnouncementLoading(true);
      const res = await fetch(`${API_BASE}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const pinned = data.find(a => a.pinned);
        setLatestAnnouncement(pinned || data[0]);
      } else {
        setLatestAnnouncement(null);
      }
    } catch (err) {
      console.error('Failed to fetch announcements for dashboard', err);
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestAnnouncement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledge = async (id) => {
    try {
      await fetch(`${API_BASE}/announcements/${id}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchLatestAnnouncement();
    } catch (err) {
      console.error('Failed to acknowledge announcement', err);
    }
  };

  const hasAcknowledged = (announcement) =>
    announcement?.acknowledgedBy?.some((a) => (a.user?._id || a.user) === user?._id);

  // ---------------- TASK CALCULATIONS ----------------
  const myTasks = tasks.filter(t => t.status !== 'Approved');
  const totalAssigned = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Approved').length;
  const completionPercentage = totalAssigned > 0 ? Math.round((completedTasks / totalAssigned) * 100) : 0;

  const myDueToday = tasks.filter(
    t => new Date(t.dueDate).toDateString() === new Date().toDateString() && t.status !== 'Approved'
  );
  const myPendingApproval = tasks.filter(t => t.status === 'Completed (Pending Approval)');
  const myRejected = tasks.filter(t => t.status === 'Rejected');

  // Filter logic for "Tasks Requiring Attention"
  const filteredTasks = myTasks.filter(task => {
    const dueDate = new Date(task.dueDate);
    const today = new Date();

    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (filter === 'Today') {
      return startOfDueDate.getTime() === startOfToday.getTime();
    }

    if (filter === 'This Week') {
      const endOfWeek = new Date(startOfToday);
      endOfWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()));
      return startOfDueDate >= startOfToday && startOfDueDate <= endOfWeek;
    }

    if (filter === 'Overdue') {
      return task.status === 'Overdue' || startOfDueDate < startOfToday;
    }

    return true; // 'All'
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-slate-800 dark:text-slate-100">

      {/* 1. HERO & USER HEADER */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/60 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Profile & Welcome Text */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center shrink-0 w-14 h-14 rounded-xl bg-[#10b981] text-slate-950 font-bold text-xl overflow-hidden shadow-sm">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt={user?.name || "User"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <span>{user?.name ? user.name[0].toUpperCase() : 'M'}</span>
              )}
              <span className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0d101c] rounded-full" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold tracking-wider text-[#10b981] uppercase bg-[#10b981]/10 px-2.5 py-0.5 rounded-md border border-[#10b981]/20">
                  {getGreeting()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {user?.name || 'Workspace Member'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Personal focus hub. You've completed <span className="text-[#10b981] font-bold">{completionPercentage}%</span> of assigned goals today.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#0d101c] hover:bg-slate-200 dark:hover:bg-[#141a2e] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#1e2640] font-semibold text-xs sm:text-sm transition-colors"
            >
              <Download size={16} className="text-slate-500 dark:text-slate-400" />
              <span>Report</span>
            </button>

            <button
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#10b981]/20 transition-colors"
            >
              <span>Workspace Tasks</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* 2. ANNOUNCEMENT BANNER */}
      {!announcementLoading && latestAnnouncement && (
        <div className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-4 shadow-sm transition-colors hover:border-[#10b981]/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] shrink-0">
                <Megaphone size={20} />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {latestAnnouncement.pinned && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                      <Pin size={10} /> Pinned
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${categoryStyle[latestAnnouncement.category] || categoryStyle['General News']}`}>
                    {latestAnnouncement.category}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar size={12} /> {new Date(latestAnnouncement.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {latestAnnouncement.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {latestAnnouncement.body}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
              {hasAcknowledged(latestAnnouncement) ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  <CheckCircle2 size={14} /> Acknowledged
                </span>
              ) : (
                <button
                  onClick={() => acknowledge(latestAnnouncement._id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs font-bold transition-colors"
                >
                  <CheckCircle2 size={14} /> Acknowledge
                </button>
              )}

              <button
                onClick={() => navigate('/announcements')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0d101c] hover:bg-slate-200 dark:hover:bg-[#141a2e] text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-[#1e2640] transition-colors"
              >
                All News <ChevronRight size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. METRICS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Tasks */}
        <div 
          onClick={() => navigate('/tasks?filter=active')}
          className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-4 shadow-sm hover:border-[#10b981]/50 transition-colors cursor-pointer">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            <span>Active Tasks</span>
            <div className="p-2 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981]">
              <CheckSquare size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{myTasks.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">assigned to you</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-[#0d101c] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#10b981] h-1.5 rounded-full" style={{ width: `${Math.min(myTasks.length * 10, 100)}%` }} />
          </div>
        </div>

        {/* Due Today */}
        <div 
          onClick={() => navigate("/tasks?filter=today")}
          className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-4 shadow-sm hover:border-amber-500/40 transition-colors cursor-pointer">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            <span>Due Today</span>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{myDueToday.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">requires action</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-[#0d101c] rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: myDueToday.length > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* In Review */}
        <div 
          onClick={() => navigate("/tasks?filter=pendingApproval")}
          className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-4 shadow-sm hover:border-emerald-500/40 transition-colors cursor-pointer">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            <span>In Review</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{myPendingApproval.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">awaiting signoff</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-[#0d101c] rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: myPendingApproval.length > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* Revisions */}
        <div 
          onClick={() => navigate("/tasks?filter=rejected")}
          className="rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-4 shadow-sm hover:border-rose-500/40 transition-colors cursor-pointer">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            <span>Needs Revisions</span>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{myRejected.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">manager feedback</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-[#0d101c] rounded-full h-1.5 overflow-hidden">
            <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: myRejected.length > 0 ? '100%' : '0%' }} />
          </div>
        </div>
      </div>

      {/* 4. WORKFLOW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Focus Action List */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1e2640] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#10b981]" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Focus Action List</h2>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-[#0d101c] p-1 border border-slate-200 dark:border-[#1e2640]">
                {['All', 'Today', 'This Week', 'Overdue'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      filter === tab
                        ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1e2640]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            <div className="mt-4 space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-[#1e2640] rounded-xl">
                  <CheckCircle size={32} className="text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {filter === 'All'
                      ? 'No outstanding tasks waiting for your action.'
                      : `No tasks matched filter "${filter}".`}
                  </p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Approved';
                  return (
                    <div
                      key={task._id}
                      onClick={() => navigate(`/tasks/${task._id}`)}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#1e2640] bg-slate-50 dark:bg-[#141a2e] p-3.5 hover:border-[#10b981] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-rose-500' : 'bg-[#10b981]'}`} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 group-hover:text-[#10b981] transition-colors">
                              {task.title}
                            </p>
                            {task.status === 'Approved' && (task.wasOverdue || (task.dueDate && task.approvedAt && new Date(task.dueDate) < new Date(task.approvedAt)) || (task.dueDate && !task.approvedAt && new Date(task.dueDate) < new Date(task.updatedAt || task.createdAt))) && (
                              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded">
                                Overdue
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                            <Clock size={11} className={isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                            <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                              Due: {formatDateTime(task.dueDate)}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-slate-950 group-hover:bg-[#10b981] transition-colors">
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#1e2640] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Showing {filteredTasks.length} items</span>
            <button onClick={() => navigate('/tasks')} className="text-[#10b981] hover:underline font-bold">
              View All Tasks &rarr;
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Feedback Stream */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#1e2640] bg-white dark:bg-[#1e2640]/40 p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1e2640] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Manager Feedback</h2>
              </div>
              <span className="text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                {myRejected.length} pending
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {myRejected.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-[#1e2640] rounded-xl">
                  <CheckCircle size={32} className="text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Clear Records</p>
                  <p className="text-xs text-slate-500 mt-1">No tasks returned for edit.</p>
                </div>
              ) : (
                myRejected.map(task => (
                  <div
                    key={task._id}
                    onClick={() => navigate(`/tasks/${task._id}`)}
                    className="group rounded-xl border border-slate-200 dark:border-[#1e2640] bg-slate-50 dark:bg-[#141a2e] p-3.5 space-y-2 cursor-pointer hover:border-[#10b981] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {task.title}
                      </p>
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase">
                        Revision
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0d101c] p-2.5 rounded-lg border border-slate-200 dark:border-[#1e2640]">
                      <MessageSquare size={14} className="shrink-0 text-rose-500 mt-0.5" />
                      <p className="italic leading-relaxed">"{task.feedback || 'Please review and resubmit changes.'}"</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#1e2640] text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
            Click any task to review and submit revisions
          </div>
        </div>

      </div>
    </div>
  );
};

export default MemberDashboard;