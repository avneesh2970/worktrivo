import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, API_BASE } from '../context/AuthContext';
import {
  Network,
  Users,
  Search,
  Filter,
  Shield,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Mail,
  Building2,
  User,
  Loader2,
  UserCheck
} from 'lucide-react';

const OrgChart = () => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [expandedNodes, setExpandedNodes] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setUsers(list);
          // Expand all by default
          const exp = {};
          list.forEach((u) => {
            exp[u._id] = true;
          });
          setExpandedNodes(exp);
        }
      } catch (err) {
        console.error('Error fetching org users:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchUsers();
  }, [token]);

  const toggleNode = (id) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const departments = useMemo(() => {
    const depts = new Set();
    users.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts);
  }, [users]);

  // Group hierarchy
  const hierarchy = useMemo(() => {
    let filtered = users;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.designationRole?.toLowerCase().includes(q)
      );
    }
    if (selectedDept !== 'all') {
      filtered = filtered.filter((u) => u.department === selectedDept);
    }

    const admins = filtered.filter((u) => u.role === 'admin');
    const managers = filtered.filter((u) => u.role === 'manager');
    const members = filtered.filter((u) => u.role !== 'admin' && u.role !== 'manager');

    // Group members by manager
    const managerTeams = {};
    managers.forEach((m) => {
      managerTeams[m._id] = [];
    });

    const unassignedMembers = [];

    members.forEach((mem) => {
      const mgrId = mem.manager?._id || mem.manager;
      if (mgrId && managerTeams[mgrId]) {
        managerTeams[mgrId].push(mem);
      } else {
        // check if any manager has this member in assignedMembers
        const parentManager = managers.find(
          (m) => m.assignedMembers && m.assignedMembers.some((id) => (id._id || id) === mem._id)
        );
        if (parentManager) {
          managerTeams[parentManager._id].push(mem);
        } else {
          unassignedMembers.push(mem);
        }
      }
    });

    return { admins, managers, managerTeams, unassignedMembers };
  }, [users, searchQuery, selectedDept]);

  const renderUserCard = (userObj, roleLabel, badgeColor, subtext) => {
    return (
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 hover:border-[#10b981]/50 rounded-2xl p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between min-w-[240px] max-w-[280px]">
        <div>
          <div className="flex items-start gap-3 mb-2.5">
            <div className="h-10 w-10 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] font-bold text-xs shrink-0 shadow-xs">
              {userObj.profilePhoto ? (
                <img
                  src={userObj.profilePhoto}
                  alt={userObj.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                userObj.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {userObj.name}
              </h4>
              <p className="text-[11px] text-slate-500 truncate font-medium">
                {userObj.designationRole || userObj.role}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${badgeColor}`}>
              {roleLabel}
            </span>
            {userObj.department && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {userObj.department}
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="truncate max-w-[170px]" title={userObj.email}>
            {userObj.email}
          </span>
          {subtext && <span className="text-[#10b981] font-bold shrink-0">{subtext}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-bold">
              <Network size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Company Organization Chart
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive organizational structure displaying executive leadership, team managers, and staff members.
          </p>
        </div>

        {/* Total head count */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 text-xs">
          <Users size={16} className="text-[#10b981]" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">Headcount:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">{users.length} Employees</span>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee by name, title, department, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="py-2 px-3 bg-slate-50 dark:bg-[#0B101E] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#10b981] cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 size={32} className="animate-spin text-[#10b981] mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading organization hierarchy...</p>
        </div>
      ) : (
        <div className="space-y-10 overflow-x-auto pb-6">
          {/* =========================================================
              TIER 1: EXECUTIVE LEADERSHIP / ADMINS
          ========================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <Shield size={16} className="text-[#10b981]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Executive Leadership & Administration ({hierarchy.admins.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-4">
              {hierarchy.admins.map((adm) => (
                <div key={adm._id}>
                  {renderUserCard(
                    adm,
                    'Administrator',
                    'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30',
                    'Executive'
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* =========================================================
              TIER 2: MANAGEMENT & DEPARTMENT LEADS
          ========================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <Briefcase size={16} className="text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Department Leads & Managers ({hierarchy.managers.length})
              </h3>
            </div>

            <div className="space-y-6">
              {hierarchy.managers.map((mgr) => {
                const team = hierarchy.managerTeams[mgr._id] || [];
                const isExpanded = expandedNodes[mgr._id];

                return (
                  <div
                    key={mgr._id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#0B101E]/60 space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        {renderUserCard(
                          mgr,
                          'Manager',
                          'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
                          `${team.length} direct report${team.length !== 1 ? 's' : ''}`
                        )}
                      </div>

                      <button
                        onClick={() => toggleNode(mgr._id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121826] text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer w-fit"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{isExpanded ? 'Collapse Team' : `Expand Team (${team.length})`}</span>
                      </button>
                    </div>

                    {/* Team Members Grid */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 pl-2 sm:pl-6 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Assigned Team Members ({team.length})
                        </span>
                        {team.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No direct reports currently assigned.</p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {team.map((mem) => (
                              <div key={mem._id}>
                                {renderUserCard(
                                  mem,
                                  'Team Member',
                                  'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* =========================================================
              TIER 3: UNASSIGNED MEMBERS (Directly under General Org)
          ========================================================= */}
          {hierarchy.unassignedMembers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <Users size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  General Staff ({hierarchy.unassignedMembers.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-4">
                {hierarchy.unassignedMembers.map((mem) => (
                  <div key={mem._id}>
                    {renderUserCard(
                      mem,
                      'Team Member',
                      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrgChart;
