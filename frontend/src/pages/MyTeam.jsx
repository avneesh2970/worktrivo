import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import {
  Users,
  Search,
  CheckSquare,
  FileText,
  FolderKanban,
  UserCircle,
  Clock,
  AlertCircle,
  Calendar,
  ChevronRight,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  Briefcase,
  Mail,
  MapPin,
  Building2,
  CalendarRange,
  ListTodo,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime, formatDate } from '../utils/dateUtils';

// Helper Avatar component with initials fallback
const EmployeeAvatar = ({ user, size = 'md' }) => {
  const name = user?.name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const rawPhoto = user?.profilePhoto || user?.avatar || user?.avatarUrl;

  const photoUrl = rawPhoto
    ? (rawPhoto.startsWith('http')
      ? rawPhoto
      : `${API_BASE.replace(/\/api$/, '')}${rawPhoto.startsWith('/') ? '' : '/'}${rawPhoto}`)
    : null;

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  }[size] || 'w-10 h-10 text-sm';

  return (
    <div className={`relative shrink-0 rounded-2xl flex items-center justify-center font-bold overflow-hidden shadow-xs ${sizeClasses}`}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className="w-full h-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 flex items-center justify-center"
        style={{ display: photoUrl ? 'none' : 'flex' }}
      >
        {initial}
      </div>
    </div>
  );
};

const MyTeam = () => {
  const { user: currentUser, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected member from URL params or default
  const paramUserId = searchParams.get('userId') || searchParams.get('id');

  // State
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'my-team' | 'all'
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Overview 360 data state
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'reports' | 'projects' | 'profile'

  // Sub-filters within tabs
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [reportDuration, setReportDuration] = useState('all'); // 'all' | 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month'

  // Fetch team members accessible to this user
  const fetchMembers = async () => {
    if (!token) return;
    try {
      setLoadingMembers(true);
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch team members');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setTeamMembers(list);

      // If user param exists, select them; else default to first direct report or first member
      if (paramUserId) {
        const found = list.find(m => m._id === paramUserId);
        if (found) setSelectedMember(found);
      } else if (list.length > 0 && !selectedMember) {
        const direct = list.find(m => m.isDirectReport && m._id !== currentUser?._id);
        const initial = direct || list.find(m => m._id !== currentUser?._id) || list[0];
        if (initial) {
          setSelectedMember(initial);
          setSearchParams({ userId: initial._id }, { replace: true });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load team directory');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Fetch 360 Overview for the selected member
  const fetchOverview = async (userId, duration = reportDuration) => {
    if (!userId || !token) return;
    try {
      setLoadingOverview(true);
      const url = `${API_BASE}/users/${userId}/overview?date=${encodeURIComponent(duration)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch employee 360 overview');
      }
      const data = await res.json();
      setOverviewData(data);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error fetching 360 details');
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [token]);

  // When URL param changes or members load, sync selection
  useEffect(() => {
    if (paramUserId && teamMembers.length > 0) {
      const match = teamMembers.find(m => m._id === paramUserId);
      if (match && (!selectedMember || selectedMember._id !== match._id)) {
        setSelectedMember(match);
      }
    }
  }, [paramUserId, teamMembers]);

  // Fetch overview when selectedMember changes or duration changes
  useEffect(() => {
    if (selectedMember?._id) {
      fetchOverview(selectedMember._id, reportDuration);
    }
  }, [selectedMember?._id, reportDuration]);

  // Handle selecting a member
  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setSearchParams({ userId: member._id });
  };

  // Available departments list
  const departments = useMemo(() => {
    const depts = new Set();
    teamMembers.forEach(m => {
      if (m.department && m.department.trim()) {
        depts.add(m.department.trim());
      }
    });
    return Array.from(depts).sort();
  }, [teamMembers]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      // For manager, members are strictly their assigned team
      if (currentUser?.role === 'admin' && scopeFilter === 'my-team' && !m.isDirectReport) {
        return false;
      }

      // Match department
      if (selectedDepartment !== 'all' && m.department?.toLowerCase() !== selectedDepartment.toLowerCase()) {
        return false;
      }

      // Match search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.name?.toLowerCase().includes(q);
        const matchesEmail = m.email?.toLowerCase().includes(q);
        const matchesDept = m.department?.toLowerCase().includes(q);
        const matchesRole = m.designationRole?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q);
        const matchesEmpId = m.employeeId?.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesDept || matchesRole || matchesEmpId;
      }
      return true;
    });
  }, [teamMembers, scopeFilter, selectedDepartment, searchQuery]);

  // Direct reports count
  const directReportsCount = useMemo(() => {
    return teamMembers.filter(m => m.isDirectReport).length;
  }, [teamMembers]);

  // Filtered tasks for the selected member
  const memberTasks = useMemo(() => {
    const list = overviewData?.tasks?.list || [];
    return list.filter(t => {
      const matchSearch = !taskSearch.trim() ||
        t.title?.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.description?.toLowerCase().includes(taskSearch.toLowerCase());
      const matchStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [overviewData?.tasks?.list, taskSearch, taskStatusFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50/50 dark:bg-[#070b13] text-slate-800 dark:text-slate-100">
      {/* Top Header Bar */}
      <header className="shrink-0 px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  My Team
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {teamMembers.length} Members
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser?.role === 'manager'
                    ? 'Select an employee from your assigned team to check their tasks, reports, projects, and profile.'
                    : 'Select any employee to check their assigned tasks, daily work reports, enrolled projects, and profile.'}
                </p>
              </div>
            </div>
          </div>

          {/* Direct Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (selectedMember?._id) {
                  fetchOverview(selectedMember._id, reportDuration);
                }
                fetchMembers();
                toast.success('Refreshed team data');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <RefreshCw size={14} className={loadingOverview ? 'animate-spin text-[#10b981]' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#10b981] hover:bg-[#0ea5e9] text-slate-950 font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <PlusCircle size={14} />
              <span>Create Task</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT PANEL: Member Selector & Directory ================= */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/30 flex flex-col h-full overflow-hidden">
          {/* Controls: Search, Scope Toggle, Dept Dropdown */}
          <div className="p-4 space-y-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role, email..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
              />
            </div>

            {/* Scope: For manager, show Assigned Team; for admin, allow toggling Direct vs All */}
            {currentUser?.role === 'admin' ? (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-medium">
                <button
                  onClick={() => setScopeFilter('my-team')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    scopeFilter === 'my-team'
                      ? 'bg-white dark:bg-slate-800 text-[#10b981] font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Direct Team ({directReportsCount})
                </button>
                <button
                  onClick={() => setScopeFilter('all')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    scopeFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-[#10b981] font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Members ({teamMembers.length})
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Assigned Team:</span>
                <span className="font-bold text-[#10b981] px-2 py-0.5 rounded-md bg-[#10b981]/10 border border-[#10b981]/20">
                  {teamMembers.length} Members
                </span>
              </div>
            )}

            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:border-[#10b981]"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Members Scroll List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/40">
            {loadingMembers ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw size={20} className="animate-spin mx-auto text-[#10b981] mb-2" />
                Loading team directory...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Users size={28} className="mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No members match filters</p>
                <p className="text-[11px] text-slate-500 mt-1">Try resetting the search query or department filter.</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedMember?._id === member._id;
                return (
                  <div
                    key={member._id}
                    onClick={() => handleSelectMember(member)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 border ${
                      isSelected
                        ? 'bg-[#10b981]/10 border-[#10b981]/50 shadow-sm'
                        : 'border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <EmployeeAvatar user={member} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-[#10b981]' : 'text-slate-900 dark:text-white'}`}>
                            {member.name}
                          </h4>
                          {member.isDirectReport && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                              Direct
                            </span>
                          )}
                          {member.role === 'manager' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-500 border border-purple-500/30">
                              Manager
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {member.designationRole || member.department || member.email}
                        </p>
                      </div>
                    </div>

                    <ChevronRight size={16} className={`shrink-0 transition-transform ${isSelected ? 'text-[#10b981] translate-x-0.5' : 'text-slate-400'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT PANEL: Selected Member 360 Workspace ================= */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white/40 dark:bg-slate-950/40 p-4 lg:p-6 space-y-6">
          {!selectedMember ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Users size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Employee Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose an employee from the directory on the left to inspect their active tasks, daily reports, and enrolled projects.
              </p>
            </div>
          ) : (
            <>
              {/* Member Profile Banner Card */}
              <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 md:p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: Avatar & Identity Details */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <EmployeeAvatar user={overviewData?.user || selectedMember} size="lg" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                          {overviewData?.user?.name || selectedMember.name}
                        </h2>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                          {overviewData?.user?.role || selectedMember.role || 'Member'}
                        </span>
                        {(overviewData?.user?.isDirectReport || selectedMember.isDirectReport) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30">
                            Direct Report
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="text-slate-400" />
                          {overviewData?.user?.email || selectedMember.email}
                        </span>
                        {(overviewData?.user?.department || selectedMember.department) && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            {overviewData?.user?.department || selectedMember.department}
                          </span>
                        )}
                        {(overviewData?.user?.designationRole || selectedMember.designationRole) && (
                          <span className="flex items-center gap-1">
                            <Briefcase size={12} className="text-slate-400" />
                            {overviewData?.user?.designationRole || selectedMember.designationRole}
                          </span>
                        )}
                        {(overviewData?.user?.workLocation || selectedMember.workLocation) && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            {overviewData?.user?.workLocation || selectedMember.workLocation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate('/chat')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#10b981] hover:bg-[#0ea5e9] text-slate-950 font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <MessageSquare size={14} />
                      <span>Message</span>
                    </button>
                    <button
                      onClick={() => navigate('/tasks')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95"
                    >
                      <PlusCircle size={14} className="text-[#10b981]" />
                      <span>Assign Task</span>
                    </button>
                  </div>
                </div>

                {/* 360 Summary Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Tasks</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.tasks?.total ?? '...'}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-semibold">
                        {overviewData?.tasks?.completed ?? 0} Done
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Work Reports</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.reports?.total ?? '...'}
                      </span>
                      <span className="text-[10px] text-sky-500 font-semibold">
                        {overviewData?.reports?.totalHours ?? 0} hrs logged
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Active Projects</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {overviewData?.projects?.total ?? '...'}
                      </span>
                      <span className="text-[10px] text-purple-500 font-semibold">Enrolled</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Pending / Blockers</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-xl font-extrabold ${(overviewData?.reports?.blockers || 0) > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                        {overviewData?.reports?.blockers ?? 0}
                      </span>
                      <span className="text-[10px] text-amber-500 font-semibold">
                        {overviewData?.tasks?.overdue ?? 0} Overdue
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs Header */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
                {[
                  { key: 'tasks', label: 'Assigned Tasks', icon: CheckSquare, count: overviewData?.tasks?.total },
                  { key: 'reports', label: 'Daily Work Reports', icon: FileText, count: overviewData?.reports?.total },
                  { key: 'projects', label: 'Projects & Workspaces', icon: FolderKanban, count: overviewData?.projects?.total },
                  { key: 'profile', label: 'Profile Details', icon: UserCircle },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-[#10b981] text-[#10b981]'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={15} />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                          isActive
                            ? 'bg-[#10b981]/20 text-[#10b981]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Display */}
              <div className="space-y-4">
                {/* ================= TAB 1: TASKS ================= */}
                {activeTab === 'tasks' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Filter & Search Bar for Tasks */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                      <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="Filter tasks by keyword..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 outline-none focus:border-[#10b981]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                        {[
                          { key: 'all', label: 'All Statuses' },
                          { key: 'In Progress', label: 'In Progress' },
                          { key: 'Completed', label: 'Completed' },
                          { key: 'To Do', label: 'To Do' },
                          { key: 'Pending', label: 'Pending Review' },
                        ].map((st) => (
                          <button
                            key={st.key}
                            onClick={() => setTaskStatusFilter(st.key)}
                            className={`px-3 py-1 text-xs rounded-xl font-medium transition-all cursor-pointer ${
                              taskStatusFilter === st.key
                                ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Task Cards Grid / List */}
                    {loadingOverview ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        <RefreshCw size={20} className="animate-spin mx-auto text-[#10b981] mb-2" />
                        Loading assigned tasks...
                      </div>
                    ) : memberTasks.length === 0 ? (
                      <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/30">
                        <ListTodo size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">No tasks found</h4>
                        <p className="text-xs text-slate-500 mt-1">This member currently has no tasks matching your filters.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {memberTasks.map((task) => (
                          <div
                            key={task._id}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#10b981]/50 transition-all flex flex-col justify-between gap-3 shadow-xs"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                  {task.title}
                                </h4>
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                  task.priority === 'Urgent' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/20' :
                                  task.priority === 'High' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                  {task.priority || 'Normal'}
                                </span>
                              </div>

                              {task.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                {task.dueDate && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <Clock size={12} className={new Date(task.dueDate) < new Date() && !['Completed', 'Approved'].includes(task.status) ? 'text-rose-500' : 'text-sky-500'} />
                                    Due: {formatDateTime(task.dueDate)}
                                  </span>
                                )}
                                {task.group?.name && (
                                  <span className="flex items-center gap-1 text-purple-400">
                                    <FolderKanban size={12} />
                                    {task.group.name}
                                  </span>
                                )}
                                {task.createdBy?.name && (
                                  <span>Assigned by {task.createdBy.name}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  task.status === 'Completed' || task.status === 'Approved'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : task.status === 'In Progress'
                                    ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {task.status}
                                </span>
                                {task.status === 'Approved' && (task.wasOverdue || (task.dueDate && task.approvedAt && new Date(task.dueDate) < new Date(task.approvedAt)) || (task.dueDate && !task.approvedAt && new Date(task.dueDate) < new Date(task.updatedAt || task.createdAt))) && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    Overdue
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => navigate(`/tasks/${task._id}`)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#10b981] hover:underline cursor-pointer"
                              >
                                <span>View Task</span>
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 2: DAILY REPORTS ================= */}
                {activeTab === 'reports' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Duration Filter Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <CalendarRange size={16} className="text-[#10b981]" />
                        <span>Duration Filter:</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { key: 'all', label: 'All Time' },
                          { key: 'today', label: 'Today' },
                          { key: 'yesterday', label: 'Yesterday' },
                          { key: 'this-week', label: 'This Week' },
                          { key: 'last-week', label: 'Last Week' },
                          { key: 'this-month', label: 'This Month' },
                          { key: 'last-month', label: 'Last Month' },
                        ].map((dur) => (
                          <button
                            key={dur.key}
                            onClick={() => setReportDuration(dur.key)}
                            className={`px-3 py-1 text-xs rounded-xl font-medium transition-all cursor-pointer ${
                              reportDuration === dur.key
                                ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {dur.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reports List */}
                    {loadingOverview ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        <RefreshCw size={20} className="animate-spin mx-auto text-[#10b981] mb-2" />
                        Loading daily reports...
                      </div>
                    ) : (!overviewData?.reports?.list || overviewData.reports.list.length === 0) ? (
                      <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/30">
                        <FileText size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">No reports submitted</h4>
                        <p className="text-xs text-slate-500 mt-1">This member has no daily reports recorded for the selected duration.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.reports.list.map((report) => (
                          <div
                            key={report._id}
                            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-3.5 shadow-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 font-semibold">
                                <Calendar size={14} className="text-[#10b981]" />
                                <span>
                                  {new Date(report.reportDate).toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span>•</span>
                                <Clock size={14} className="text-sky-500" />
                                <span>{report.totalHours || 8} Hours</span>
                              </div>

                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                report.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                report.status === 'Rejected' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {report.status}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Today's Accomplishments
                              </span>
                              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {report.todayWork}
                              </p>
                            </div>

                            {report.tomorrowPlan && (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                  Tomorrow's Plan
                                </span>
                                <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                  {report.tomorrowPlan}
                                </p>
                              </div>
                            )}

                            {report.blockers && (
                              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Blocker Encountered:</span> {report.blockers}
                                </div>
                              </div>
                            )}

                            {report.reviewedBy && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>Reviewed by <strong className="text-slate-700 dark:text-slate-300">{report.reviewedBy.name}</strong></span>
                                {report.feedback && <span className="italic">"{report.feedback}"</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 3: PROJECTS ================= */}
                {activeTab === 'projects' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {loadingOverview ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        <RefreshCw size={20} className="animate-spin mx-auto text-[#10b981] mb-2" />
                        Loading projects...
                      </div>
                    ) : (!overviewData?.projects?.list || overviewData.projects.list.length === 0) ? (
                      <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/30">
                        <FolderKanban size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Projects Enrolled</h4>
                        <p className="text-xs text-slate-500 mt-1">This member is not currently assigned to any projects or groups.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {overviewData.projects.list.map((group) => (
                          <div
                            key={group._id}
                            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between gap-4 shadow-xs hover:border-[#10b981]/50 transition-all"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-xl bg-purple-500/15 text-purple-500 border border-purple-500/20">
                                    <FolderKanban size={16} />
                                  </div>
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {group.name}
                                  </h4>
                                </div>

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  group.approvalStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                  group.approvalStatus === 'Rejected' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                  'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {group.approvalStatus || 'Active'}
                                </span>
                              </div>

                              {group.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                  {group.description}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                                <span className="flex items-center gap-1 font-medium">
                                  <Users size={12} className="text-sky-500" />
                                  {group.members?.length || 0} Members
                                </span>
                                {group.createdAt && (
                                  <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                              <button
                                onClick={() => navigate(`/groups/${group._id}`)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#10b981] hover:underline cursor-pointer"
                              >
                                <span>Open Workspace</span>
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 4: PROFILE DETAILS ================= */}
                {activeTab === 'profile' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
                    {/* Personal Information */}
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-3.5 shadow-xs">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <UserCircle size={18} className="text-[#10b981]" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Personal Information</h4>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Full Name</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.name || selectedMember.name}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Email Address</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.email || selectedMember.email}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Gender</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.gender || 'Not specified'}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Date of Birth</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {overviewData?.user?.dob ? new Date(overviewData.user.dob).toLocaleDateString() : 'Not provided'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Professional Details */}
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 space-y-3.5 shadow-xs">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <Briefcase size={18} className="text-[#10b981]" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Professional Details</h4>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Employee ID</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.employeeId || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Role / Designation</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.designationRole || overviewData?.user?.role || 'Member'}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Department</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.department || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                          <span className="text-slate-500">Work Location</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData?.user?.workLocation || 'Not specified'}</span>
                        </div>
                        {overviewData?.user?.manager && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                            <span className="text-slate-500">Reporting Manager</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{overviewData.user.manager.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTeam;
