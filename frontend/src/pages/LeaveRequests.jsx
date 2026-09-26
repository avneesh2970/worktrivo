import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import {
  CalendarOff,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  Loader2,
  User,
  Shield,
  X,
  Check,
  Ban,
  CalendarDays,
  FileText,
  UserCheck,
  TrendingUp,
  ChevronRight,
  Briefcase,
  HelpCircle,
  Sparkles
} from 'lucide-react';

const LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Paid Leave',
  'Unpaid Leave',
  'Emergency Leave',
  'Work From Home'
];

const LeaveRequests = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  // Tabs:
  // Admin & Manager default to 'all' or 'team'; Member defaults to 'my'
  const [activeTab, setActiveTab] = useState(isAdmin || isManager ? 'all' : 'my');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Pending', 'Approved', 'Rejected'
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Leaves lists
  const [leaves, setLeaves] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Leave Form Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [formLeaveType, setFormLeaveType] = useState('Casual Leave');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDaysCount, setFormDaysCount] = useState(1);
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review / Decision Modal (for Admin)
  const [reviewModalLeave, setReviewModalLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Auto calculate day count when dates change
  useEffect(() => {
    if (formStartDate && formEndDate) {
      const start = new Date(formStartDate);
      const end = new Date(formEndDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setFormDaysCount(diffDays);
      } else {
        setFormDaysCount(1);
      }
    }
  }, [formStartDate, formEndDate]);

  // Fetch Leaves
  const fetchLeaves = async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (isAdmin || isManager) {
        let url = `${API_BASE}/leaves?status=${encodeURIComponent(statusFilter)}&leaveType=${encodeURIComponent(typeFilter)}`;
        if (searchQuery.trim()) {
          url += `&search=${encodeURIComponent(searchQuery.trim())}`;
        }
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLeaves(Array.isArray(data) ? data : []);
        }
      }

      // Always fetch user's personal leaves for stats & My Leaves tab
      const myRes = await fetch(`${API_BASE}/leaves/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myRes.ok) {
        const myData = await myRes.json();
        setMyLeaves(Array.isArray(myData) ? myData : []);
      }
    } catch (err) {
      console.error('Failed to load leave requests:', err);
      toast.error('Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [token, statusFilter, typeFilter, searchQuery]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (newLeave) => {
      setLeaves((prev) => [newLeave, ...prev.filter((l) => l._id !== newLeave._id)]);
      if (newLeave.user?._id === user?._id || newLeave.user === user?._id) {
        setMyLeaves((prev) => [newLeave, ...prev.filter((l) => l._id !== newLeave._id)]);
      }
    };

    const handleUpdated = (updatedLeave) => {
      setLeaves((prev) =>
        prev.map((l) => (l._id === updatedLeave._id ? updatedLeave : l))
      );
      setMyLeaves((prev) =>
        prev.map((l) => (l._id === updatedLeave._id ? updatedLeave : l))
      );
    };

    const handleDeleted = ({ _id }) => {
      setLeaves((prev) => prev.filter((l) => l._id !== _id));
      setMyLeaves((prev) => prev.filter((l) => l._id !== _id));
    };

    socket.on('leaveRequestCreated', handleCreated);
    socket.on('leaveRequestUpdated', handleUpdated);
    socket.on('leaveRequestDeleted', handleDeleted);

    return () => {
      socket.off('leaveRequestCreated', handleCreated);
      socket.off('leaveRequestUpdated', handleUpdated);
      socket.off('leaveRequestDeleted', handleDeleted);
    };
  }, [socket, user?._id]);

  // Handle Submit Form
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!formStartDate || !formEndDate) {
      toast.error('Please select both start and end dates.');
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error('End date cannot be earlier than start date.');
      return;
    }
    if (!formReason.trim()) {
      toast.error('Please provide a reason for your leave request.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leaveType: formLeaveType,
          startDate: formStartDate,
          endDate: formEndDate,
          daysCount: formDaysCount,
          reason: formReason.trim()
        })
      });

      if (res.ok) {
        const created = await res.json();
        toast.success('Leave request submitted successfully!');
        setIsApplyModalOpen(false);
        setFormReason('');
        setFormStartDate('');
        setFormEndDate('');
        setFormDaysCount(1);
        setMyLeaves((prev) => [created, ...prev]);
        setLeaves((prev) => [created, ...prev]);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to submit leave request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error submitting leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin Decision
  const handleReviewAction = async (leaveId, status, note = '') => {
    if (!isAdmin) {
      toast.error('Only administrators can approve or reject leaves.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/${leaveId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          rejectionReason: note
        })
      });

      if (res.ok) {
        const updated = await res.json();
        toast.success(`Leave request ${status.toLowerCase()} successfully!`);
        setReviewModalLeave(null);
        setRejectionReason('');
        setLeaves((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
        setMyLeaves((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
      } else {
        const errData = await res.json();
        toast.error(errData.error || `Failed to ${status.toLowerCase()} leave`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error updating leave status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/leaves/${leaveId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Leave request cancelled.');
        setLeaves((prev) => prev.filter((l) => l._id !== leaveId));
        setMyLeaves((prev) => prev.filter((l) => l._id !== leaveId));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to cancel leave request.');
      }
    } catch (err) {
      toast.error('Error cancelling leave request.');
    }
  };

  // Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Pending Review
          </span>
        );
    }
  };

  // Active dataset based on active tab
  const activeList = activeTab === 'my' ? myLeaves : leaves;

  // Stats calculation
  const totalCount = activeList.length;
  const pendingCount = activeList.filter((l) => l.status === 'Pending').length;
  const approvedCount = activeList.filter((l) => l.status === 'Approved').length;
  const rejectedCount = activeList.filter((l) => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* =========================================================
          TOP BANNER / HEADER
      ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-bold">
              <CalendarOff size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Leave Requests & Attendance
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Submit time off requests, check review statuses, and track active team leaves seamlessly.
          </p>
        </div>

        {/* Apply for Leave Button */}
        <button
          onClick={() => {
            const todayStr = new Date().toISOString().split('T')[0];
            setFormStartDate(todayStr);
            setFormEndDate(todayStr);
            setFormDaysCount(1);
            setIsApplyModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus size={16} />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* =========================================================
          METRICS CARDS
      ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Total Requests
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalCount}
            </span>
            <FileText size={18} className="text-slate-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
            Pending Approval
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-500 font-mono">
              {pendingCount}
            </span>
            <Clock size={18} className="text-amber-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block">
            Approved
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-500 font-mono">
              {approvedCount}
            </span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
            Rejected
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-500 font-mono">
              {rejectedCount}
            </span>
            <XCircle size={18} className="text-rose-500" />
          </div>
        </div>
      </div>

      {/* =========================================================
          NAV TABS & SEARCH / FILTER TOOLBAR
      ========================================================= */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B101E] p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 w-fit">
            {(isAdmin || isManager) && (
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-[#121826] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shield size={14} className="text-[#10b981]" />
                <span>{isAdmin ? 'All Leave Requests' : 'Team Leave Requests'}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-white dark:bg-[#121826] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User size={14} className="text-sky-500" />
              <span>My Leaves</span>
              {myLeaves.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 font-mono">
                  {myLeaves.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Status Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B101E] p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-x-auto">
            {['all', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer capitalize ${
                  statusFilter === status
                    ? 'bg-white dark:bg-[#121826] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {status === 'all' ? 'All Status' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Leave Type Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {(isAdmin || isManager) && activeTab === 'all' && (
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search employee by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Leave Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981] cursor-pointer"
            >
              <option value="all">All Leave Types</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================
          LEAVE REQUESTS LIST / CARDS
      ========================================================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl">
          <Loader2 className="h-8 w-8 text-[#10b981] animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading leave requests...</p>
        </div>
      ) : activeList.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-[#121826]/40">
          <CalendarDays size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            No Leave Requests Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {activeTab === 'my'
              ? "You haven't submitted any leave requests yet."
              : 'No leave requests matching your current filter criteria.'}
          </p>
          <button
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              setFormStartDate(todayStr);
              setFormEndDate(todayStr);
              setFormDaysCount(1);
              setIsApplyModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#10b981] text-slate-950 font-bold text-xs hover:bg-[#059669] transition-all cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Apply for Leave</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeList.map((item) => {
            const isOwner = item.user?._id === user?._id || item.user === user?._id;
            const canCancel = isOwner && item.status === 'Pending';
            const canAdminReview = isAdmin && item.status === 'Pending';

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 hover:border-[#10b981]/40 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-xs shrink-0 shadow-xs">
                        {item.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.user?.name || 'Employee'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 font-medium">
                          <span>{item.user?.designationRole || item.user?.role || 'Staff'}</span>
                          {item.user?.department && (
                            <>
                              <span>•</span>
                              <span className="text-[#10b981] font-semibold">{item.user.department}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  {/* Leave Details Box */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800/80 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {item.leaveType}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#10b981] font-mono font-bold text-[11px]">
                        {item.daysCount} {item.daysCount > 1 ? 'Days' : 'Day'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <Calendar size={13} className="text-[#10b981] shrink-0" />
                      <span>
                        {new Date(item.startDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}{' '}
                        -{' '}
                        {new Date(item.endDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Reason
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                      {item.reason}
                    </p>
                  </div>

                  {/* Rejection notice if rejected */}
                  {item.status === 'Rejected' && item.rejectionReason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs mb-3 flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-[11px]">Rejection Reason:</span>
                        <p className="text-[11px] leading-relaxed">{item.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Reviewed by info */}
                  {item.reviewedBy && (
                    <div className="text-[11px] text-slate-500 mb-3">
                      Reviewed by{' '}
                      <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                        {item.reviewedBy.name}
                      </strong>{' '}
                      on {new Date(item.reviewedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Requested {new Date(item.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Admin Approve & Reject Buttons */}
                    {canAdminReview && (
                      <>
                        <button
                          onClick={() => handleReviewAction(item._id, 'Approved')}
                          disabled={actionLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => {
                            setReviewModalLeave(item);
                            setRejectionReason('');
                          }}
                          disabled={actionLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Ban size={13} />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {/* Applicant Cancel Button */}
                    {canCancel && (
                      <button
                        onClick={() => handleCancelLeave(item._id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 text-xs font-bold transition-all cursor-pointer"
                      >
                        <X size={13} />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          APPLY FOR LEAVE MODAL
      ========================================================= */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <CalendarOff size={18} className="text-[#10b981]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Apply for Leave
                </h3>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              {/* Leave Type */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Leave Type *
                </label>
                <select
                  value={formLeaveType}
                  onChange={(e) => setFormLeaveType(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
                >
                  {LEAVE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
                  />
                </div>
              </div>

              {/* Days Count banner */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estimated Duration:</span>
                <span className="font-mono font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded-md">
                  {formDaysCount} {formDaysCount === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Reason for Leave *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why you are requesting leave and any handoff notes..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981] resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          ADMIN REJECT CONFIRMATION MODAL
      ========================================================= */}
      {reviewModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-rose-500">
                <Ban size={18} />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reject Leave Request
                </h3>
              </div>
              <button
                onClick={() => setReviewModalLeave(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              You are about to reject the {reviewModalLeave.leaveType} request for{' '}
              <strong>{reviewModalLeave.user?.name}</strong> ({reviewModalLeave.daysCount} days).
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Reason for Rejection (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Provide a clear reason to help the employee understand why the request was declined..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0B101E] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                onClick={() => setReviewModalLeave(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewAction(reviewModalLeave._id, 'Rejected', rejectionReason)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;
