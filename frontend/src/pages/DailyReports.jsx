import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Shield,
  ShieldCheck,
  BarChart3,
  Users,
  Printer,
  Download,
  LayoutGrid,
  CalendarRange,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Activity,
  ExternalLink,
  ListTodo
} from 'lucide-react';

const DailyReports = () => {
  const navigate = useNavigate();
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

  // View mode for Manager / Admin: 'cards' (individual daily cards) or 'summary' (team aggregated breakdown)
  const [viewMode, setViewMode] = useState('cards');
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Reports data
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, submittedToday: 0, totalHours: 0, totalBlockers: 0, submitterCount: 0, durationLabel: 'This Week' });
  const [loading, setLoading] = useState(true);

  // Filter states - default to 'this-week' as requested for weekly report review
  const [dateFilter, setDateFilter] = useState('this-week'); // 'this-week', 'today', 'yesterday', 'last-week', 'last-7-days', 'this-month', 'last-month', 'all', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Pending', 'Approved', 'Rejected'
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // =========================================================
  // CANDIDATE / EMPLOYEE 360 OVERVIEW STATE
  // =========================================================
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateOverview, setCandidateOverview] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateTab, setCandidateTab] = useState('overview'); // 'overview' | 'tasks' | 'reports'
  const [candidateDuration, setCandidateDuration] = useState('all');
  const [candidateTaskSearch, setCandidateTaskSearch] = useState('');
  const [candidateTaskStatus, setCandidateTaskStatus] = useState('all');

  const handleOpenCandidateModal = async (candidateUser) => {
    if (!candidateUser) return;
    const userId = candidateUser._id || (typeof candidateUser === 'string' ? candidateUser : null);
    if (!userId) return;

    const initialUserObj = typeof candidateUser === 'object' ? candidateUser : { _id: userId, name: 'Employee' };
    setSelectedCandidate(initialUserObj);
    setCandidateModalOpen(true);
    setCandidateTab('overview');
    setCandidateDuration('all');
    setCandidateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/overview?date=all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCandidateOverview(data);
        if (data.user) {
          setSelectedCandidate(data.user);
        }
      } else {
        toast.error('Failed to load candidate overview');
      }
    } catch (err) {
      toast.error('Error loading employee profile');
    } finally {
      setCandidateLoading(false);
    }
  };

  const handleCandidateDurationChange = async (duration) => {
    setCandidateDuration(duration);
    if (!selectedCandidate?._id) return;
    setCandidateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${selectedCandidate._id}/overview?date=${duration}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCandidateOverview(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCandidateLoading(false);
    }
  };

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

  // Helper to append duration query parameters
  const appendDurationParams = (baseUrl) => {
    let url = baseUrl.includes('?') ? baseUrl : `${baseUrl}?`;
    if (dateFilter === 'custom') {
      if (startDate) url += `startDate=${encodeURIComponent(startDate)}&`;
      if (endDate) url += `endDate=${encodeURIComponent(endDate)}&`;
    } else if (dateFilter && dateFilter !== 'all') {
      url += `date=${encodeURIComponent(dateFilter)}&`;
    }
    return url;
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = appendDurationParams(`${API_BASE}/daily-reports`);
      if (statusFilter !== 'all') url += `status=${encodeURIComponent(statusFilter)}&`;
      if (deptFilter !== 'all') url += `department=${encodeURIComponent(deptFilter)}&`;
      if (selectedMemberId !== 'all') url += `userId=${encodeURIComponent(selectedMemberId)}&`;
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
      let url = appendDurationParams(`${API_BASE}/daily-reports/stats`);
      if (deptFilter !== 'all') url += `department=${encodeURIComponent(deptFilter)}&`;
      if (selectedMemberId !== 'all') url += `userId=${encodeURIComponent(selectedMemberId)}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const fetchSummary = async () => {
    if (!isAdmin && !isManager) return;
    setSummaryLoading(true);
    try {
      let url = appendDurationParams(`${API_BASE}/daily-reports/summary`);
      if (deptFilter !== 'all') url += `department=${encodeURIComponent(deptFilter)}&`;
      if (selectedMemberId !== 'all') url += `userId=${encodeURIComponent(selectedMemberId)}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to load duration summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fetch users for member filter dropdown (admin / manager)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin && !isManager) return;
      try {
        const res = await fetch(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    };
    if (token) fetchUsers();
  }, [token, isAdmin, isManager]);

  useEffect(() => {
    if (token) {
      fetchReports();
      fetchStats();
      if (isAdmin || isManager) {
        fetchSummary();
      }
    }
  }, [token, dateFilter, startDate, endDate, statusFilter, deptFilter, selectedMemberId, searchQuery, activeTab]);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchReports();
      fetchStats();
      if (isAdmin || isManager) fetchSummary();
    };
    socket.on('dailyReportUpdated', handleUpdate);
    return () => {
      socket.off('dailyReportUpdated', handleUpdate);
    };
  }, [socket, isAdmin, isManager, dateFilter, startDate, endDate, statusFilter, deptFilter, selectedMemberId, searchQuery]);

  // Export reports to CSV
  const handleExportCSV = () => {
    if (!reports || reports.length === 0) {
      toast.error('No reports found to export for the selected duration.');
      return;
    }
    const headers = [
      'Report Date',
      'Employee Name',
      'Email',
      'Role / Designation',
      'Department',
      'Hours Logged',
      'Status',
      'Accomplishments',
      'Plans Tomorrow',
      'Blockers',
      'Reviewed By',
      'Reviewed At'
    ];

    const rows = reports.map(r => [
      `"${new Date(r.reportDate).toLocaleDateString()}"`,
      `"${(r.user?.name || '').replace(/"/g, '""')}"`,
      `"${(r.user?.email || '').replace(/"/g, '""')}"`,
      `"${(r.user?.designationRole || r.user?.role || '').replace(/"/g, '""')}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      r.totalHours || 8,
      `"${r.status || ''}"`,
      `"${(r.todayWork || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(r.tomorrowPlan || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(r.blockers || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(r.reviewedBy?.name || '').replace(/"/g, '""')}"`,
      `"${r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const label = (stats?.durationLabel || dateFilter).toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `TaskSphere_Daily_Reports_${label}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV successfully!');
  };

  const handlePrint = () => {
    window.print();
  };

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

  // Handle Approve or Reject (Instant Optimistic UI)
  const handleReviewDecision = async (status) => {
    if (!viewingReport) return;
    if (status === 'Rejected' && !decisionFeedback.trim()) {
      toast.error('Please provide feedback/reason for rejection.');
      return;
    }

    const reportToUpdate = viewingReport;
    const feedbackValue = decisionFeedback.trim();

    // Instant UI update: close modal & update state immediately
    setViewingReport(null);
    setDecisionFeedback('');
    toast.success(`Daily report ${status.toLowerCase()}!`);

    setReports(prev => prev.map(r => r._id === reportToUpdate._id ? { ...r, status, feedback: feedbackValue } : r));

    try {
      const res = await fetch(`${API_BASE}/daily-reports/${reportToUpdate._id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          feedback: feedbackValue
        })
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Failed to ${status.toLowerCase()} report.`);
        fetchReports();
      } else {
        fetchStats();
      }
    } catch (err) {
      toast.error('Network error while processing decision.');
      fetchReports();
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
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
                  ? 'Review, track, and approve daily & duration work logs across all departments.'
                  : isManager
                  ? 'Monitor your assigned team reports, check weekly/duration submissions, and submit your accomplishments.'
                  : 'Submit your daily work accomplishments, upcoming plans, and blockers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            title="Export reports to CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Download size={15} className="text-[#10b981]" />
            <span>Export CSV</span>
          </button>

          {/* Print / PDF Button */}
          <button
            onClick={handlePrint}
            title="Print report summary"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Printer size={15} className="text-sky-500" />
            <span>Print Report</span>
          </button>

          {/* Submit Report Button (Non-Admins only) */}
          {!isAdmin && (
            <button
              onClick={() => handleOpenSubmitModal()}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#10b981]/20 cursor-pointer active:scale-95"
            >
              <Plus size={17} />
              <span>Submit Daily Report</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          DURATION SELECTOR & FILTER CHIPS
      ========================================================= */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-[#10b981]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Report Duration Filter
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#10b981] font-semibold">
              {stats.durationLabel || 'This Week'}
            </span>
          </div>

          {/* View Mode Toggle for Admin / Manager */}
          {(isAdmin || isManager) && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B101E] p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-[#121826] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Individual Feed</span>
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'summary'
                    ? 'bg-white dark:bg-[#121826] text-[#10b981] shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={14} />
                <span>Team Breakdown</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Duration Preset Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {[
            { key: 'this-week', label: 'This Week (Weekly)' },
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last-week', label: 'Last Week' },
            { key: 'last-7-days', label: 'Last 7 Days' },
            { key: 'this-month', label: 'This Month (Monthly)' },
            { key: 'last-month', label: 'Last Month' },
            { key: 'all', label: 'All Dates' },
            { key: 'custom', label: 'Custom Range' },
          ].map((preset) => {
            const isActive = dateFilter === preset.key;
            return (
              <button
                key={preset.key}
                onClick={() => {
                  setDateFilter(preset.key);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#10b981] text-slate-950 shadow-md shadow-[#10b981]/25 font-bold scale-[1.02]'
                    : 'bg-slate-50 dark:bg-[#0B101E] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 animate-in fade-in">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs text-rose-500 hover:underline cursor-pointer ml-2"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overview Stat Cards for the Selected Duration */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reports</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">{stats.total}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">In {stats.durationLabel || 'selected period'}</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Hours Logged</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-2 font-mono">
            {stats.totalHours || 0} <span className="text-sm font-sans font-normal text-slate-500">hrs</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">
            {stats.submitterCount ? `${stats.submitterCount} member(s) logged` : 'Total logged time'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2 font-mono">{stats.pending}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">Awaiting review</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">{stats.approved}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">Verified & locked</p>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Blockers</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2 font-mono">{stats.totalBlockers || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">Issues needing help</p>
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

          {/* Member Filter (Admins and Managers) */}
          {(isAdmin || isManager) && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMemberId}
                onChange={(e) => { setSelectedMemberId(e.target.value); setCurrentPage(1); }}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981] max-w-[180px]"
              >
                <option value="all">All Team Members</option>
                {teamMembers.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>

              {selectedMemberId !== 'all' && (
                <button
                  onClick={() => {
                    const found = teamMembers.find(m => m._id === selectedMemberId);
                    if (found) handleOpenCandidateModal(found);
                  }}
                  title="View this employee's complete profile, assigned tasks, and daily reports"
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <User size={14} />
                  <span>Candidate 360°</span>
                </button>
              )}
            </div>
          )}

          {/* Clear Filters button if filtered */}
          {(statusFilter !== 'all' || deptFilter !== 'all' || selectedMemberId !== 'all' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setDeptFilter('all');
                setSelectedMemberId('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          VIEW MODE: TEAM SUMMARY BREAKDOWN
      ========================================================= */}
      {viewMode === 'summary' && (isAdmin || isManager) && activeTab === 'team' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-[#10b981]" />
                Team Duration Summary ({summaryData?.duration || stats.durationLabel})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aggregated breakdown of submissions, hours, and blockers by team member for this period.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/15 px-3 py-1 rounded-full">
                {summaryData?.activeMembersCount || 0} Submitting Members
              </span>
            </div>
          </div>

          {summaryLoading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#121826]/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <Loader2 className="h-8 w-8 text-[#10b981] animate-spin mb-3" />
              <p className="text-sm text-slate-500">Calculating duration statistics...</p>
            </div>
          ) : !summaryData?.members || summaryData.members.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#121826]/30">
              <Users size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No submissions in this duration</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No team members have logged reports for {stats.durationLabel || 'the selected period'}. Try choosing a different duration.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaryData.members.map((item) => (
                <div
                  key={item.user._id}
                  className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 hover:border-[#10b981]/40 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div
                      onClick={() => handleOpenCandidateModal(item.user)}
                      title="Click to view candidate 360° overview (Profile, Assigned Tasks & Reports)"
                      className="flex items-center gap-3 mb-4 cursor-pointer group/cand hover:opacity-90 transition-opacity"
                    >
                      <div className="h-11 w-11 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-sm shrink-0 group-hover/cand:scale-105 transition-transform shadow-xs">
                        {item.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover/cand:text-[#10b981] transition-colors flex items-center gap-1.5">
                          <span>{item.user?.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#10b981]/15 text-[#10b981] font-bold">360°</span>
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          {item.user?.designationRole || item.user?.role || 'Member'}
                          {item.user?.department && ` • ${item.user.department}`}
                        </p>
                      </div>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 mb-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Reports Submitted</span>
                        <p className="font-bold text-slate-900 dark:text-white mt-0.5 text-sm font-mono">
                          {item.reportsCount} <span className="text-[11px] font-sans font-normal text-slate-500">entries</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Hours</span>
                        <p className="font-bold text-sky-600 dark:text-sky-400 mt-0.5 text-sm font-mono">
                          {item.totalHours} <span className="text-[11px] font-sans font-normal text-slate-500">hrs</span>
                        </p>
                      </div>
                    </div>

                    {/* Status pills breakdown */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold">
                        ✓ {item.approved} Approved
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                        ⏳ {item.pending} Pending
                      </span>
                      {item.rejected > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 font-semibold">
                          ✕ {item.rejected} Rejected
                        </span>
                      )}
                    </div>

                    {/* Blockers alert */}
                    {item.blockersCount > 0 ? (
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5 mb-2 font-medium">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{item.blockersCount} blocker(s) flagged during period</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mb-2">No blockers reported</p>
                    )}
                  </div>

                  {/* Drilldown button */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenCandidateModal(item.user)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#10b981] transition-colors cursor-pointer"
                    >
                      <User size={13} className="text-[#10b981]" />
                      <span>Candidate 360°</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMemberId(item.user._id);
                        setViewMode('cards');
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-[#10b981] hover:underline cursor-pointer"
                    >
                      <span>Filter Feed</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* =========================================================
            VIEW MODE: INDIVIDUAL REPORT CARDS (FEED)
        ========================================================= */
        <div>
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
                  ? `You haven't submitted any daily report for ${stats.durationLabel || 'this duration'}.`
                  : `No daily reports submitted under "${stats.durationLabel || 'this duration'}" matching the active filters.`}
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCandidateModal(report.user);
                    }}
                    title="Click to view candidate 360° (Profile, Assigned Tasks & Reports)"
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group/candidate hover:opacity-90"
                  >
                    <div className="h-9 w-9 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-xs shrink-0 group-hover/candidate:scale-105 transition-transform shadow-xs">
                      {report.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover/candidate:text-[#10b981] transition-colors flex items-center gap-1.5">
                        <span>{report.user?.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#10b981]/15 text-[#10b981] font-semibold">360°</span>
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

      {/* Pagination (only in cards feed view) */}
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
              <div
                onClick={() => handleOpenCandidateModal(viewingReport.user)}
                title="Click to view full employee profile, tasks & reports"
                className="flex items-center gap-3 cursor-pointer group/user hover:opacity-90 transition-opacity"
              >
                <div className="h-11 w-11 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-sm shrink-0 group-hover/user:scale-105 transition-transform shadow-xs">
                  {viewingReport.user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover/user:text-[#10b981] transition-colors flex items-center gap-2">
                    <span>{viewingReport.user?.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] font-bold flex items-center gap-1">
                      <User size={12} /> 360°
                    </span>
                  </h3>
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

      {/* =========================================================
          CANDIDATE / EMPLOYEE 360° OVERVIEW MODAL
      ========================================================= */}
      {candidateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl relative max-h-[92vh] flex flex-col text-slate-800 dark:text-slate-100 overflow-hidden">
            
            {/* Modal Header Card */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#10b981]/15 via-emerald-500/5 to-transparent shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#10b981] font-extrabold text-xl shrink-0 shadow-md">
                    {candidateOverview?.user?.profilePhoto ? (
                      <img
                        src={candidateOverview.user.profilePhoto}
                        alt={candidateOverview.user.name}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      candidateOverview?.user?.name?.charAt(0).toUpperCase() || selectedCandidate?.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {candidateOverview?.user?.name || selectedCandidate?.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                        {candidateOverview?.user?.role || selectedCandidate?.role || 'Member'}
                      </span>
                      {candidateOverview?.user?.employeeId && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          ID: {candidateOverview.user.employeeId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2 font-medium">
                      <span>{candidateOverview?.user?.designationRole || selectedCandidate?.designationRole || 'Team Member'}</span>
                      {(candidateOverview?.user?.department || selectedCandidate?.department) && (
                        <>
                          <span>•</span>
                          <span className="text-[#10b981] font-semibold">{candidateOverview?.user?.department || selectedCandidate?.department}</span>
                        </>
                      )}
                      {(candidateOverview?.user?.workLocation || selectedCandidate?.workLocation) && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1"><MapPin size={11} /> {candidateOverview?.user?.workLocation || selectedCandidate?.workLocation}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 sm:ml-auto">
                  {/* Direct Chat Shortcut */}
                  <button
                    onClick={() => {
                      setCandidateModalOpen(false);
                      navigate('/chat');
                    }}
                    title="Start 1-on-1 direct chat with employee"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Message Employee</span>
                  </button>

                  {/* Filter Daily Reports page to this candidate */}
                  <button
                    onClick={() => {
                      setSelectedMemberId(selectedCandidate._id);
                      setViewMode('cards');
                      setCandidateModalOpen(false);
                      toast.success(`Filtered daily reports feed to ${selectedCandidate.name}`);
                    }}
                    title="Filter reports feed to this employee"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Filter size={13} />
                    <span>Filter Feed</span>
                  </button>

                  <button
                    onClick={() => setCandidateModalOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer ml-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs within 360 Modal */}
              <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
                <button
                  onClick={() => setCandidateTab('overview')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateTab === 'overview'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User size={14} />
                  <span>360° Profile & Metrics</span>
                </button>

                <button
                  onClick={() => setCandidateTab('tasks')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateTab === 'tasks'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ListTodo size={14} />
                  <span>Assigned Tasks ({candidateOverview?.tasks?.total || 0})</span>
                </button>

                <button
                  onClick={() => setCandidateTab('reports')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    candidateTab === 'reports'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  <span>Daily Work Reports ({candidateOverview?.reports?.total || 0})</span>
                </button>
              </div>
            </div>

            {/* Modal Body with Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {candidateLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 text-[#10b981] animate-spin mb-3" />
                  <p className="text-xs text-slate-500 font-medium">Loading employee dossier...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: 360 PROFILE & SUMMARY */}
                  {candidateTab === 'overview' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                      {/* 4 High-Level KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Work Logged</span>
                          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                            {candidateOverview?.reports?.totalHours || 0} <span className="text-xs font-sans text-slate-500 font-normal">hrs</span>
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1 block">Across {candidateOverview?.reports?.total || 0} daily submissions</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Tasks Completed</span>
                          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                            {candidateOverview?.tasks?.completed || 0}
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1 block">Out of {candidateOverview?.tasks?.total || 0} assigned</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 block">In Progress Tasks</span>
                          <p className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 font-mono">
                            {candidateOverview?.tasks?.inProgress || 0}
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1 block">Active assignments</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Reported Blockers</span>
                          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                            {candidateOverview?.reports?.blockers || 0}
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1 block">Obstacles flagged</span>
                        </div>
                      </div>

                      {/* Detailed Profile Information */}
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                          <User size={14} className="text-[#10b981]" />
                          Employee Information & Hierarchy
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Email Address</span>
                            <a
                              href={`mailto:${candidateOverview?.user?.email}`}
                              className="font-semibold text-slate-900 dark:text-white hover:text-[#10b981] transition-colors flex items-center gap-1"
                            >
                              <Mail size={12} className="text-slate-400" />
                              <span className="truncate">{candidateOverview?.user?.email || 'N/A'}</span>
                            </a>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Department</span>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                              <Building2 size={12} className="text-[#10b981]" />
                              <span>{candidateOverview?.user?.department || 'Unassigned'}</span>
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Reporting Manager</span>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                              <Shield size={12} className="text-amber-500" />
                              <span>{candidateOverview?.user?.manager?.name || 'Direct / Admin'}</span>
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Work Location</span>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                              <MapPin size={12} className="text-rose-500" />
                              <span>{candidateOverview?.user?.workLocation || 'Remote / Office'}</span>
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Account Status</span>
                            <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>{candidateOverview?.user?.active ? 'Active' : 'Inactive'}</span>
                            </p>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Joined Date</span>
                            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              <span>
                                {candidateOverview?.user?.createdAt
                                  ? new Date(candidateOverview.user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'N/A'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Work Activity Snapshots */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Latest Daily Submission */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <FileText size={14} className="text-[#10b981]" />
                              Latest Work Report
                            </span>
                            {candidateOverview?.reports?.list?.[0] && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(candidateOverview.reports.list[0].reportDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {candidateOverview?.reports?.list?.[0] ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-[#0B101E] p-3 rounded-xl">
                                {candidateOverview.reports.list[0].todayWork}
                              </p>
                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <span className="font-semibold text-sky-600">
                                  {candidateOverview.reports.list[0].totalHours || 8} hrs logged
                                </span>
                                {getStatusBadge(candidateOverview.reports.list[0].status)}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-4 text-center">No reports submitted yet.</p>
                          )}
                        </div>

                        {/* Current Active Task */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <ListTodo size={14} className="text-sky-500" />
                              Active Assigned Task
                            </span>
                            {candidateOverview?.tasks?.list?.[0] && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-500 font-semibold font-mono">
                                {candidateOverview.tasks.list[0].priority}
                              </span>
                            )}
                          </div>
                          {candidateOverview?.tasks?.list?.[0] ? (
                            <div className="space-y-2">
                              <div className="bg-slate-50 dark:bg-[#0B101E] p-3 rounded-xl">
                                <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {candidateOverview.tasks.list[0].title}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                  {candidateOverview.tasks.list[0].description || 'No description provided.'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <span className="text-slate-500">
                                  Due: {candidateOverview.tasks.list[0].dueDate ? new Date(candidateOverview.tasks.list[0].dueDate).toLocaleDateString() : 'No date'}
                                </span>
                                <span className="font-semibold px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#10b981]">
                                  {candidateOverview.tasks.list[0].status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-4 text-center">No active tasks assigned.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: ASSIGNED TASKS */}
                  {candidateTab === 'tasks' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Filter tasks */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter assigned tasks..."
                            value={candidateTaskSearch}
                            onChange={(e) => setCandidateTaskSearch(e.target.value)}
                            className="w-full py-1.5 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B101E] text-xs outline-none focus:border-[#10b981]"
                          />
                        </div>

                        <select
                          value={candidateTaskStatus}
                          onChange={(e) => setCandidateTaskStatus(e.target.value)}
                          className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B101E] text-xs outline-none focus:border-[#10b981]"
                        >
                          <option value="all">All Task Statuses</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="To Do">To Do</option>
                          <option value="Pending">Pending Review</option>
                        </select>
                      </div>

                      {/* Tasks List */}
                      {(() => {
                        const filteredTasks = (candidateOverview?.tasks?.list || []).filter(task => {
                          const matchesSearch = !candidateTaskSearch.trim() || 
                            task.title?.toLowerCase().includes(candidateTaskSearch.toLowerCase()) ||
                            task.description?.toLowerCase().includes(candidateTaskSearch.toLowerCase());
                          const matchesStatus = candidateTaskStatus === 'all' || task.status === candidateTaskStatus;
                          return matchesSearch && matchesStatus;
                        });

                        if (filteredTasks.length === 0) {
                          return (
                            <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#121826]/30">
                              <ListTodo size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white">No tasks found</h5>
                              <p className="text-xs text-slate-500 mt-0.5">No assigned tasks match the criteria for this employee.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2.5">
                            {filteredTasks.map((t) => (
                              <div
                                key={t._id}
                                className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 hover:border-[#10b981]/40 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {t.title}
                                    </h5>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                      t.priority === 'Urgent' ? 'bg-rose-500/15 text-rose-500' :
                                      t.priority === 'High' ? 'bg-amber-500/15 text-amber-500' :
                                      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                      {t.priority}
                                    </span>
                                  </div>
                                  {t.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-1.5">
                                      {t.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                    {t.dueDate && (
                                      <span className="flex items-center gap-1 font-medium">
                                        <Clock size={11} className="text-sky-500" />
                                        Due: {new Date(t.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                    {t.createdBy?.name && (
                                      <span>Assigned by {t.createdBy.name}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    t.status === 'Completed' || t.status === 'Approved'
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : t.status === 'In Progress'
                                      ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  }`}>
                                    {t.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TAB 3: DAILY WORK REPORTS */}
                  {candidateTab === 'reports' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Duration selector for candidate reports */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <CalendarRange size={15} className="text-[#10b981]" />
                          <span>Filter Duration:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { key: 'all', label: 'All History' },
                            { key: 'this-week', label: 'This Week' },
                            { key: 'last-week', label: 'Last Week' },
                            { key: 'this-month', label: 'This Month' },
                          ].map((dur) => (
                            <button
                              key={dur.key}
                              onClick={() => handleCandidateDurationChange(dur.key)}
                              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                candidateDuration === dur.key
                                  ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
                                  : 'bg-white dark:bg-[#121826] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {dur.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Candidate Reports List */}
                      {(!candidateOverview?.reports?.list || candidateOverview.reports.list.length === 0) ? (
                        <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#121826]/30">
                          <FileText size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white">No reports submitted</h5>
                          <p className="text-xs text-slate-500 mt-0.5">This employee has not submitted any reports for this duration.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {candidateOverview.reports.list.map((r) => (
                            <div
                              key={r._id}
                              className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
                                  <Calendar size={13} className="text-[#10b981]" />
                                  <span>{new Date(r.reportDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  <span>•</span>
                                  <Clock size={13} className="text-sky-500" />
                                  <span>{r.totalHours || 8} hrs</span>
                                </div>
                                {getStatusBadge(r.status)}
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Accomplishments</span>
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                  {r.todayWork}
                                </p>
                              </div>

                              {r.tomorrowPlan && (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Tomorrow's Plan</span>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                    {r.tomorrowPlan}
                                  </p>
                                </div>
                              )}

                              {r.blockers && (
                                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-1.5">
                                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                  <span>Blocker: {r.blockers}</span>
                                </div>
                              )}

                              {r.reviewedBy && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                                  <span>Reviewed by {r.reviewedBy.name}</span>
                                  {r.feedback && <span className="italic">"{r.feedback}"</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B101E] flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Employee ID: <code className="text-slate-700 dark:text-slate-300 font-mono">{candidateOverview?.user?._id || selectedCandidate?._id}</code>
              </span>
              <button
                onClick={() => setCandidateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReports;
