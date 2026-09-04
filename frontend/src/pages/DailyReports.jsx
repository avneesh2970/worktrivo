import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  MessageSquare,
  HelpCircle,
  Sparkles,
  ArrowRight,
  CheckSquare,
  X,
  Eye,
  Check,
  Ban,
  TrendingUp,
  Briefcase,
  Edit3,
  Lock,
  ShieldCheck
} from 'lucide-react';

const DailyReports = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isMember = user?.role === 'member';

  // Tabs:
  // For Admin: always 'team' (all reports)
  // For Manager: 'team' | 'my'
  // For Member: 'my' | 'submit'
  const [activeTab, setActiveTab] = useState(isAdmin || isManager ? 'team' : 'my');

  // Reports data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, submittedToday: 0 });
  const [loading, setLoading] = useState(true);

  // Filter states
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', 'custom'
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Pending', 'Approved', 'Rejected'
  const [deptFilter, setDeptFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Submit / Edit Form state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formHours, setFormHours] = useState(8);
  const [formTodayWork, setFormTodayWork] = useState('');
  const [formTomorrowPlan, setFormTomorrowPlan] = useState('');
  const [formBlockers, setFormBlockers] = useState('');
  const [userTasks, setUserTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Open Submit / Edit modal
  const handleOpenSubmitModal = (reportToEdit = null) => {
    if (reportToEdit) {
      setEditingReportId(reportToEdit._id);
      setFormDate(new Date(reportToEdit.reportDate).toISOString().split('T')[0]);
      setFormHours(reportToEdit.totalHours || 8);
      setFormTodayWork(reportToEdit.todayWork || '');
      setFormTomorrowPlan(reportToEdit.tomorrowPlan || '');
      setFormBlockers(reportToEdit.blockers || '');
      setSelectedTaskIds(
        Array.isArray(reportToEdit.tasksCompleted)
          ? reportToEdit.tasksCompleted.map(t => (t.taskId?._id || t.taskId)).filter(Boolean)
          : []
      );
    } else {
      setEditingReportId(null);
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormHours(8);
      setFormTodayWork('');
      setFormTomorrowPlan('');
      setFormBlockers('');
      setSelectedTaskIds([]);
    }
    setIsSubmitModalOpen(true);
  };

  // Detailed View & Approval Modal
  const [viewingReport, setViewingReport] = useState(null);
  const [decisionFeedback, setDecisionFeedback] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  // Fetch departments for filter dropdown
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch(`${API_BASE}/departments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDepartments(data);
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    if (token) fetchDepts();
  }, [token]);

  // Fetch user's tasks for task selection in submit form
  useEffect(() => {
    const fetchUserTasks = async () => {
      if (isAdmin) return;
      try {
        const res = await fetch(`${API_BASE}/tasks?status=In Progress`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUserTasks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load user tasks', err);
      }
    };
    if (token) fetchUserTasks();
  }, [token, isAdmin]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/daily-reports?`;
      if (dateFilter === 'today') url += 'date=today&';
      else if (dateFilter === 'yesterday') url += 'date=yesterday&';
      else if (dateFilter === 'custom' && customDate) url += `date=${customDate}&`;

      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (deptFilter !== 'all') url += `department=${encodeURIComponent(deptFilter)}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      toast.error('Failed to load daily reports.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/daily-reports/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReports();
      fetchStats();
    }
  }, [token, dateFilter, customDate, statusFilter, deptFilter, searchQuery, activeTab]);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;
    socket.on('dailyReportUpdated', () => {
      fetchReports();
      fetchStats();
    });
    return () => {
      socket.off('dailyReportUpdated');
    };
  }, [socket]);

  // Handle Form Submission / Editing
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!formTodayWork.trim()) {
      toast.error("Please enter today's work accomplishments.");
      return;
    }

    setSubmitting(true);
    try {
      const tasksCompleted = selectedTaskIds.map(taskId => {
        const t = userTasks.find(item => item._id === taskId);
        return {
          title: t?.title || 'Task',
          taskId: taskId,
          hoursSpent: 0
        };
      });

      const payload = {
        reportDate: formDate,
        totalHours: Number(formHours) || 8,
        todayWork: formTodayWork.trim(),
        tomorrowPlan: formTomorrowPlan.trim(),
        blockers: formBlockers.trim(),
        tasksCompleted
      };

      const isEdit = !!editingReportId;
      const endpoint = isEdit ? `${API_BASE}/daily-reports/${editingReportId}` : `${API_BASE}/daily-reports`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(isEdit ? 'Daily report updated and submitted for review!' : 'Daily report submitted successfully!');
        setIsSubmitModalOpen(false);
        setEditingReportId(null);
        // Reset form
        setFormTodayWork('');
        setFormTomorrowPlan('');
        setFormBlockers('');
        setSelectedTaskIds([]);
        if (viewingReport) setViewingReport(null);
        fetchReports();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to submit report.');
      }
    } catch (err) {
      toast.error('Error submitting daily report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve or Reject
  const handleReviewDecision = async (status) => {
    if (!viewingReport) return;
    if (status === 'Rejected' && !decisionFeedback.trim()) {
      toast.error('Please provide feedback/reason for rejection.');
      return;
    }

    setDecisionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/daily-reports/${viewingReport._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          feedback: decisionFeedback.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Daily report ${status.toLowerCase()} successfully!`);
        setViewingReport(null);
        setDecisionFeedback('');
        fetchReports();
        fetchStats();
      } else {
        toast.error(data.error || `Failed to ${status.toLowerCase()} report.`);
      }
    } catch (err) {
      toast.error('Network error while processing decision.');
    } finally {
      setDecisionLoading(false);
    }
  };

  // Filtered reports for current view
  const displayReports = reports.filter(r => {
    if (activeTab === 'my') {
      return r.user?._id === user?._id;
    }
    // Team tab: show reports from team members (or all if admin)
    return true;
  });

  const totalPages = Math.ceil(displayReports.length / itemsPerPage);
  const paginatedReports = displayReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={13} /> Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle size={13} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={13} /> Pending Review
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen text-slate-800 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981]">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Daily <span className="text-[#10b981]">Reports</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                {isAdmin
                  ? 'Review, track, and approve daily work logs across all departments.'
                  : isManager
                  ? 'Monitor your assigned team reports and submit your daily accomplishments.'
                  : 'Submit your daily work accomplishments, upcoming plans, and blockers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Report Button (Non-Admins only) */}
        {!isAdmin && (
          <button
            onClick={() => handleOpenSubmitModal()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-sm transition-all shadow-md shadow-[#10b981]/20 cursor-pointer active:scale-95"
          >
            <Plus size={18} />
            <span>Submit Daily Report</span>
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Reports</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
              <FileText size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 font-mono">{stats.total}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Total submitted records</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-3 font-mono">{stats.pending}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Awaiting manager/admin action</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3 font-mono">{stats.approved}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Successfully approved</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <XCircle size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-3 font-mono">{stats.rejected}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Need revision or feedback</p>
        </div>
      </div>

      {/* Navigation Tabs (for Managers who have both team reports and my report) */}
      {isManager && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
          <button
            onClick={() => { setActiveTab('team'); setCurrentPage(1); }}
            className={`pb-3 px-5 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'team'
                ? 'text-[#10b981] border-b-2 border-[#10b981]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 size={16} />
            <span>Assigned Team Reports ({stats.total})</span>
          </button>
          <button
            onClick={() => { setActiveTab('my'); setCurrentPage(1); }}
            className={`pb-3 px-5 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'my'
                ? 'text-[#10b981] border-b-2 border-[#10b981]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User size={16} />
            <span>My Daily Submissions</span>
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-sm">
        <div className="flex-1 relative min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search accomplishments, tasks, or blockers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full py-2 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
          >
            <option value="all">All Dates</option>
            <option value="today">Today's Reports</option>
            <option value="yesterday">Yesterday's Reports</option>
            <option value="custom">Custom Date</option>
          </select>

          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
            />
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Department Filter (Admins and Managers) */}
          {(isAdmin || isManager) && (
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d._id} value={d.name}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Reports Table / Card List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#121826]/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Loader2 className="h-10 w-10 text-[#10b981] animate-spin mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Loading reports...</p>
        </div>
      ) : displayReports.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#121826]/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/50 text-slate-500 mx-auto mb-4 border border-slate-200 dark:border-slate-700/50">
            <FileText size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Daily Reports Found</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-6">
            {activeTab === 'my'
              ? "You haven't submitted any daily report matching this criteria yet."
              : 'No daily reports submitted by team members under this filter.'}
          </p>
          {!isAdmin && (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10b981] text-slate-950 hover:bg-[#059669] font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Submit Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedReports.map((report) => (
            <div
              key={report._id}
              onClick={() => {
                setViewingReport(report);
                setDecisionFeedback(report.feedback || '');
              }}
              className="group bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 hover:border-[#10b981]/50 rounded-2xl p-5 transition-all hover:shadow-md flex flex-col justify-between cursor-pointer"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-xs shrink-0">
                      {report.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[#10b981] transition-colors">
                        {report.user?.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 font-medium">
                        <span>{report.user?.designationRole || report.user?.role || 'Member'}</span>
                        {report.department && (
                          <>
                            <span>•</span>
                            <span className="text-[#10b981] font-semibold">{report.department}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                {/* Report Date & Hours */}
                <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 mb-4 font-mono font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#10b981]" />
                    <span>{new Date(report.reportDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-sky-500 dark:text-sky-400" />
                    <span>{report.totalHours || 8} hrs logged</span>
                  </div>
                </div>

                {/* Accomplishments Snippet */}
                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Today's Accomplishments
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {report.todayWork}
                  </p>
                </div>

                {/* Blockers alert if present */}
                {report.blockers && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs mb-3 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <p className="line-clamp-2 text-[11px] font-medium">{report.blockers}</p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {report.status === 'Approved' ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Lock size={12} /> Approved
                    </span>
                  ) : report.reviewedBy ? (
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      Reviewed by <strong className="text-slate-900 dark:text-white font-semibold">{report.reviewedBy.name}</strong>
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">Awaiting Review</span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {report.user?._id === user?._id && report.status !== 'Approved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSubmitModal(report);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        report.status === 'Rejected'
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      <Edit3 size={12} />
                      <span>{report.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit'}</span>
                    </button>
                  )}

                  <span className="text-[11px] font-bold text-[#10b981] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    View <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 p-4 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Page <span className="text-slate-900 dark:text-white font-bold">{currentPage}</span> of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* =========================================================
          SUBMIT DAILY REPORT MODAL (Non-Admin Users)
      ========================================================= */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingReportId ? 'Edit & Resubmit Daily Report' : 'Submit Daily Report'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {editingReportId
                      ? 'Revise your daily accomplishments and resubmit for manager/admin approval.'
                      : 'Record your work summary, future plans, and any blockers.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitReport} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Report Date *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Total Hours Worked Today *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Task linking (optional) */}
              {userTasks.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center justify-between">
                    <span>Tasks Worked On Today</span>
                    <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                  </label>
                  <div className="max-h-28 overflow-y-auto p-2 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                    {userTasks.map(task => {
                      const isSelected = selectedTaskIds.includes(task._id);
                      return (
                        <div
                          key={task._id}
                          onClick={() => {
                            setSelectedTaskIds(prev =>
                              isSelected ? prev.filter(id => id !== task._id) : [...prev, task._id]
                            );
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#10b981]/15 text-slate-950 dark:text-white font-semibold border border-[#10b981]/30' : 'text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded flex items-center justify-center border ${isSelected ? 'bg-[#10b981] border-[#10b981] text-slate-950' : 'border-slate-400 dark:border-slate-600'}`}>
                            {isSelected && <Check size={12} className="stroke-[3]" />}
                          </div>
                          <span className="truncate flex-1 font-medium">{task.title}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-mono">{task.priority}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Today's Accomplishments & Work Done *
                </label>
                <textarea
                  rows={4}
                  value={formTodayWork}
                  onChange={(e) => setFormTodayWork(e.target.value)}
                  placeholder="Detail the tasks completed, progress made, meetings attended..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Plans for Tomorrow
                </label>
                <textarea
                  rows={2}
                  value={formTomorrowPlan}
                  onChange={(e) => setFormTomorrowPlan(e.target.value)}
                  placeholder="What are your goals and next priorities for tomorrow?"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center justify-between">
                  <span>Blockers & Challenges</span>
                  <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                </label>
                <textarea
                  rows={2}
                  value={formBlockers}
                  onChange={(e) => setFormBlockers(e.target.value)}
                  placeholder="Any roadblocks, dependencies, or support needed from manager/team?"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-sm transition-all shadow-md shadow-[#10b981]/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>{editingReportId ? 'Update & Resubmit' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW & REVIEW REPORT MODAL
      ========================================================= */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-sm shrink-0">
                  {viewingReport.user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewingReport.user?.name}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {viewingReport.user?.designationRole || viewingReport.user?.role || 'Team Member'}
                    {viewingReport.department && ` • ${viewingReport.department}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(viewingReport.status)}
                <button
                  onClick={() => setViewingReport(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Report Content */}
            <div className="space-y-5 my-6">
              {/* Meta details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Report Date</span>
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#10b981]" />
                    {new Date(viewingReport.reportDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Time Logged</span>
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock size={13} className="text-sky-500 dark:text-sky-400" />
                    {viewingReport.totalHours || 8} Hours
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Submitted At</span>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {new Date(viewingReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Today's Accomplishments */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <CheckSquare size={14} className="text-[#10b981]" />
                  Today's Accomplishments
                </h4>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {viewingReport.todayWork}
                </div>
              </div>

              {/* Tomorrow's Plan */}
              {viewingReport.tomorrowPlan && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                    <ArrowRight size={14} className="text-sky-500 dark:text-sky-400" />
                    Plans for Tomorrow
                  </h4>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {viewingReport.tomorrowPlan}
                  </div>
                </div>
              )}

              {/* Blockers / Obstacles */}
              {viewingReport.blockers && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
                    Blockers / Roadblocks
                  </h4>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-800 dark:text-rose-200 whitespace-pre-wrap leading-relaxed font-medium">
                    {viewingReport.blockers}
                  </div>
                </div>
              )}

              {/* Reviewer Feedback (if already reviewed) */}
              {viewingReport.reviewedBy && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Reviewed by <strong className="text-slate-900 dark:text-white font-semibold">{viewingReport.reviewedBy.name}</strong> on {new Date(viewingReport.reviewedAt).toLocaleString()}
                  </p>
                  {viewingReport.feedback && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic pt-1">"{viewingReport.feedback}"</p>
                  )}
                </div>
              )}
            </div>

            {/* If Report is Approved -> Permanent Lock Banner (No actions allowed) */}
            {viewingReport.status === 'Approved' ? (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck size={22} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">Approved & Permanently Locked</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-0.5">
                      This daily report was approved by {viewingReport.reviewedBy?.name || 'an Administrator'}. It cannot be edited, modified, or rejected.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* If Report is NOT Approved -> Action Controls */
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                {/* Review controls for Managers / Admins */}
                {(isAdmin || isManager) && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Decision Feedback / Note</span>
                        <span className="text-[10px] text-slate-500">Required if rejecting</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter review notes, feedback, or instructions..."
                        value={decisionFeedback}
                        onChange={(e) => setDecisionFeedback(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#10b981] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      {/* Author Edit Shortcut if manager is reviewing own rejected/pending report */}
                      {viewingReport.user?._id === user?._id && (
                        <button
                          onClick={() => {
                            const r = viewingReport;
                            setViewingReport(null);
                            handleOpenSubmitModal(r);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>{viewingReport.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit My Report'}</span>
                        </button>
                      )}

                      <div className="flex items-center gap-3 ml-auto">
                        <button
                          onClick={() => handleReviewDecision('Rejected')}
                          disabled={decisionLoading}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={15} />
                          <span>Reject Report</span>
                        </button>
                        <button
                          onClick={() => handleReviewDecision('Approved')}
                          disabled={decisionLoading}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs transition-all shadow-md shadow-[#10b981]/20 cursor-pointer disabled:opacity-50"
                        >
                          {decisionLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          <span>Approve Report</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Author Edit Button for non-admin/non-manager members */}
                {!isAdmin && !isManager && viewingReport.user?._id === user?._id && (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {viewingReport.status === 'Rejected'
                        ? 'Your report was rejected. You can edit the accomplishments and resubmit for review.'
                        : 'Your report is currently awaiting review.'}
                    </p>
                    <button
                      onClick={() => {
                        const r = viewingReport;
                        setViewingReport(null);
                        handleOpenSubmitModal(r);
                      }}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                        viewingReport.status === 'Rejected'
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40'
                      }`}
                    >
                      <Edit3 size={15} />
                      <span>{viewingReport.status === 'Rejected' ? 'Edit & Resubmit Report' : 'Edit Report'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReports;
