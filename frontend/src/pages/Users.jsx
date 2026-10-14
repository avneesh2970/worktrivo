import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import {
  Plus,
  Edit2,
  ShieldAlert,
  UserPlus,
  Shield,
  User,
  Power,
  AlertCircle,
  X,
  Loader2,
  Upload,
  Search,
  Users as UsersIcon,
  CheckCircle2,
  Image as ImageIcon,
  BadgeCheck,
  Building2,
  Check,
  ArrowLeft,
  Maximize2,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
  Briefcase,
  Mail,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

// Helper component for user image with seamless fallback to initials
const UserAvatar = ({ targetUser }) => {
  const name = targetUser?.name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  const rawPhoto = targetUser?.profilePhoto || targetUser?.avatar || targetUser?.avatarUrl;

  const profilePhotoUrl = rawPhoto
    ? (rawPhoto.startsWith('http')
      ? rawPhoto
      : `${API_BASE.replace(/\/api$/, '')}${rawPhoto.startsWith('/') ? '' : '/'}${rawPhoto}`)
    : null;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      {profilePhotoUrl ? (
        <img
          src={profilePhotoUrl}
          alt={name || "User"}
          className="w-10 h-10 rounded-full border border-[#10b981]/40 object-cover shadow-xs"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}

      {/* Fallback Initials Badge */}
      <div
        className="w-10 h-10 rounded-full bg-[#10b981]/15 text-[#10b981] font-bold text-sm flex items-center justify-center border border-[#10b981]/30 shadow-xs"
        style={{ display: profilePhotoUrl ? 'none' : 'flex' }}
      >
        {initial}
      </div>
    </div>
  );
};

const Users = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentUserId, setCurrentUserId] = useState(null);
  const [departments, setDepartments] = useState([]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('member');
  const [formDepartment, setFormDepartment] = useState('');
  const [formAssignedDepartment, setFormAssignedDepartment] = useState('');
  const [formAssignedMembers, setFormAssignedMembers] = useState([]);
  const [formManager, setFormManager] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Full-Page Member Selector States
  const [isFullPageSelectorOpen, setIsFullPageSelectorOpen] = useState(false);
  const [selectorSource, setSelectorSource] = useState('modal'); // 'modal' | 'table'
  const [selectorTargetManager, setSelectorTargetManager] = useState(null);
  const [selectorSelectedMemberIds, setSelectorSelectedMemberIds] = useState([]);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');
  const [selectorDepartmentFilter, setSelectorDepartmentFilter] = useState('all');
  const [selectorTab, setSelectorTab] = useState('all'); // 'all' | 'selected' | 'unselected'
  const [selectorIsSaving, setSelectorIsSaving] = useState(false);
  const [modalMemberSearch, setModalMemberSearch] = useState('');

  const openTableTeamSelector = (mgr) => {
    setSelectorSource('table');
    setSelectorTargetManager(mgr);
    const memberIds = Array.isArray(mgr.assignedMembers)
      ? mgr.assignedMembers.map((m) => (m._id ? m._id.toString() : m.toString()))
      : [];
    setSelectorSelectedMemberIds(memberIds);
    setSelectorSearchQuery('');
    setSelectorDepartmentFilter('all');
    setSelectorTab('all');
    setIsFullPageSelectorOpen(true);
  };

  const openModalTeamSelector = () => {
    setSelectorSource('modal');
    setSelectorTargetManager({
      _id: currentUserId,
      name: formName || 'New Manager',
      email: formEmail,
      profilePhoto: formPhoto,
      department: formDepartment,
      assignedDepartment: formAssignedDepartment,
    });
    setSelectorSelectedMemberIds([...formAssignedMembers]);
    setSelectorSearchQuery('');
    setSelectorDepartmentFilter('all');
    setSelectorTab('all');
    setIsFullPageSelectorOpen(true);
  };

  const handleSaveSelectorAssignments = async () => {
    if (selectorSource === 'modal') {
      setFormAssignedMembers([...selectorSelectedMemberIds]);
      setIsFullPageSelectorOpen(false);
      toast.success(`${selectorSelectedMemberIds.length} member(s) assigned.`);
    } else {
      if (!selectorTargetManager?._id) return;
      try {
        setSelectorIsSaving(true);
        const res = await fetch(`${API_BASE}/users/${selectorTargetManager._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            assignedMembers: selectorSelectedMemberIds
          })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`Team updated for ${selectorTargetManager.name}!`);
          setIsFullPageSelectorOpen(false);
          fetchUsers();
        } else {
          toast.error(data.error || 'Failed to update assigned members.');
        }
      } catch (err) {
        toast.error('Network error updating team.');
      } finally {
        setSelectorIsSaving(false);
      }
    }
  };

  // Candidate employees: all users excluding current manager and admins
  const candidateEmployees = useMemo(() => {
    const managerId = selectorTargetManager?._id?.toString();
    return users.filter((u) => u._id?.toString() !== managerId && u.role !== 'admin');
  }, [users, selectorTargetManager]);

  // Filtered employees based on search, department, and tab
  const filteredEmployees = useMemo(() => {
    return candidateEmployees.filter((u) => {
      const isSelected = selectorSelectedMemberIds.includes(u._id);
      if (selectorTab === 'selected' && !isSelected) return false;
      if (selectorTab === 'unselected' && isSelected) return false;

      if (selectorDepartmentFilter !== 'all') {
        if ((u.department || '') !== selectorDepartmentFilter) return false;
      }

      if (selectorSearchQuery.trim()) {
        const q = selectorSearchQuery.toLowerCase().trim();
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const empId = (u.employeeId || '').toLowerCase();
        const dept = (u.department || '').toLowerCase();
        const desig = (u.designationRole || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !empId.includes(q) && !dept.includes(q) && !desig.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [candidateEmployees, selectorSelectedMemberIds, selectorTab, selectorDepartmentFilter, selectorSearchQuery]);

  const handleToggleMember = (userId) => {
    setSelectorSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredEmployees.map((u) => u._id);
    setSelectorSelectedMemberIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAllFiltered = () => {
    const idsToRemove = new Set(filteredEmployees.map((u) => u._id));
    setSelectorSelectedMemberIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleClearAll = () => {
    setSelectorSelectedMemberIds([]);
  };

  // CSV Upload
  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const res = await fetch(`${API_BASE}/users/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Import successful!');
        fetchUsers();
      } else {
        toast.error(data.error || 'Import failed.');
      }
    } catch (err) {
      toast.error('Network error during import.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => {
    if (user && ['admin', 'manager'].includes(user.role)) {
      fetchUsers();
      fetchDepartments();
    }
  }, [user]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormEmployeeId('');
    setFormPhoto('');
    setFormPassword('');
    setFormRole('member');
    setFormDepartment('');
    setFormAssignedDepartment('');
    setFormAssignedMembers([]);
    setFormManager('');
    setFormError('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (targetUser) => {
    resetForm();
    setModalMode('edit');
    setCurrentUserId(targetUser._id);
    setFormName(targetUser.name || '');
    setFormEmail(targetUser.email || '');
    setFormEmployeeId(targetUser.employeeId || '');
    setFormPhoto(targetUser.profilePhoto || targetUser.avatar || targetUser.avatarUrl || '');
    setFormRole(targetUser.role || 'member');
    setFormDepartment(targetUser.department || '');
    setFormAssignedDepartment(targetUser.assignedDepartment || targetUser.assignedDepartments?.[0] || '');
    setFormAssignedMembers(
      targetUser.assignedMembers
        ? targetUser.assignedMembers.map((m) => (m._id ? m._id.toString() : m.toString()))
        : []
    );
    setFormManager(targetUser.manager?._id || targetUser.manager || '');
    setFormPassword('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name and Email are required.');
      return;
    }
    if (modalMode === 'create' && !formPassword) {
      toast.error('Password is required for new users.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      employeeId: formEmployeeId.trim(),
      profilePhoto: formPhoto.trim(),
      role: formRole,
      department: formDepartment.trim(),
      assignedDepartment: formAssignedDepartment.trim(),
      assignedDepartments: formAssignedDepartment.trim() ? [formAssignedDepartment.trim()] : [],
      assignedMembers: formAssignedMembers,
      manager: formRole === 'member' ? (formManager || null) : null
    };
    if (formPassword) payload.password = formPassword;

    try {
      const url = modalMode === 'create'
        ? `${API_BASE}/users`
        : `${API_BASE}/users/${currentUserId}`;

      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(modalMode === 'create' ? 'User created successfully!' : 'User updated successfully!');
        setIsModalOpen(false);
        fetchUsers();
      } else {
        toast.error(data.error || 'Operation failed.');
      }
    } catch (err) {
      toast.error('Network error. Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    if (targetUser._id === user._id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${targetUser._id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Status updated successfully.');
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to toggle account status.');
      }
    } catch (err) {
      toast.error('Network error during update.');
    }
  };

  // Filter users based on Search & Role Filter
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalCount = users.length;
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  if (user && user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg mx-auto shadow-sm">
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-full mb-4 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
          <ShieldAlert size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs font-medium">
          This management portal is reserved exclusively for system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Team <span className="text-[#10b981]">Management</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Manage user permissions, update profiles, and control platform access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCsvUpload}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {importing ? <Loader2 size={16} className="animate-spin text-[#10b981]" /> : <Upload size={16} className="text-[#10b981]" />}
            <span>{importing ? 'Importing...' : 'Import CSV'}</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-[#10b981]/20 active:scale-[0.98] cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">{totalCount}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
            <UsersIcon size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Members</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{activeCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Administrators</p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">{adminCount}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-500/20">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#10b981] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-semibold">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#10b981] transition-colors cursor-pointer"
          >
            <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Roles</option>
            <option value="admin" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Admin</option>
            <option value="manager" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Manager</option>
            <option value="member" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Team Member</option>
          </select>
        </div>
      </div>

      {/* Main Content Table Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching team members...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <User className="w-12 h-12 text-slate-400 mb-3" />
          <h3 className="text-slate-900 dark:text-white font-bold text-base">No Users Found</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-sm font-medium">
            No accounts matched your search criteria. Try adjusting your query or filter options.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th scope="col" className="px-6 py-4">User</th>
                  <th scope="col" className="px-6 py-4">Employee ID</th>
                  <th scope="col" className="px-6 py-4">Department / Team</th>
                  <th scope="col" className="px-6 py-4">Role</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">Joined</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr
                    key={u._id}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${!u.active ? 'opacity-60 bg-slate-100/50 dark:bg-slate-950/50' : ''}`}
                  >
                    {/* User Profile Photo & Details */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        onClick={() => navigate(`/profile?userId=${u._id}`)}
                        className="flex items-center gap-3.5 cursor-pointer group"
                        title={`View ${u.name}'s Profile`}
                      >
                        <UserAvatar targetUser={u} />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-[#10b981] transition-colors">
                            <span>{u.name}</span>
                            {u._id === user._id && (
                              <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {u.employeeId ? (
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {u.employeeId}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>

                    {/* Department / Managed Team */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {u.role === 'manager' ? (
                        <div>
                          {u.assignedDepartment ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#10b981]">
                              <Building2 size={13} />
                              <span>Manages: {u.assignedDepartment}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Department: {u.department || 'N/A'}</span>
                          )}
                          {u.assignedMembers?.length > 0 && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              +{u.assignedMembers.length} direct member(s)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {u.department || <span className="text-slate-400 italic">Unassigned Dept</span>}
                          </span>
                          {u.manager ? (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              👤 Manager: {u.manager.name}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              (Admin supervised)
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Role Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10b981]/15 text-slate-950 dark:text-[#10b981] border border-[#10b981]/30 font-bold">
                            <ShieldAlert size={14} className="text-[#10b981]" />
                            <span>Admin</span>
                          </span>
                        ) : u.role === 'manager' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-bold">
                            <Shield size={14} className="text-indigo-500" />
                            <span>Manager</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                            <User size={14} className="text-slate-500" />
                            <span>Team Member</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${u.active
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                        }`}>
                        {u.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.role === 'manager' && (
                          <button
                            onClick={() => openTableTeamSelector(u)}
                            className="p-2 rounded-lg text-[#10b981] hover:bg-[#10b981]/15 transition-colors cursor-pointer"
                            title="Assign / Manage Team Members (Full Page)"
                          >
                            <UsersIcon size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Account"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={u._id === user._id}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${u._id === user._id
                              ? 'opacity-30 cursor-not-allowed text-slate-400'
                              : u.active
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                                : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                            }`}
                          title={u.active ? 'Deactivate Account' : 'Activate Account'}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {modalMode === 'create' ? 'Add New Team Member' : 'Edit Member Profile'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name *</label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex. Sarah Connor"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Work Email *</label>
                <input
                  type="email"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>

              {/* Employee ID Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Employee ID</span>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    placeholder="Ex. EMP-001"
                  />
                  <BadgeCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Profile Photo URL Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Profile Photo URL / Path</span>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={formPhoto}
                    onChange={(e) => setFormPhoto(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                  <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {modalMode === 'create' ? 'Password *' : 'Password (leave blank to keep unchanged)'}
                </label>
                <input
                  type="password"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={modalMode === 'create' ? '••••••••' : 'Optional password reset'}
                  required={modalMode === 'create'}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">System Role</label>
                <select
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  <option value="member" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Team Member</option>
                  <option value="manager" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Manager</option>
                  <option value="admin" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Admin</option>
                </select>
              </div>

              {/* User Department */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">User Department</label>
                <select
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-500">Select Department (Optional)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Assigned Manager (Only for Members) */}
              {formRole === 'member' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Assigned Manager / Supervisor</span>
                    <span className="text-[10px] text-slate-500">Optional</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#10b981] transition-all"
                    value={formManager}
                    onChange={(e) => setFormManager(e.target.value)}
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                      Auto (Department Manager or Admin Fallback)
                    </option>
                    {users
                      .filter((u) => u._id !== currentUserId && ['manager', 'admin'].includes(u.role))
                      .map((mgr) => (
                        <option key={mgr._id} value={mgr._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {mgr.name} ({mgr.role === 'admin' ? 'Administrator' : 'Manager'}{mgr.department ? ` - ${mgr.department}` : ''})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Assign a direct manager to supervise this employee. If empty, the department manager or system admins are used.
                  </p>
                </div>
              )}

              {/* Manager Assignment Scope (Only for Managers) */}
              {formRole === 'manager' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-[#10b981]/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#10b981]">
                    <Shield size={14} />
                    <span>Manager Department & Team Assignment</span>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Assigned Department to Manage
                    </label>
                    <select
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#10b981] transition-all"
                      value={formAssignedDepartment}
                      onChange={(e) => setFormAssignedDepartment(e.target.value)}
                    >
                      <option value="" className="bg-white dark:bg-slate-900 text-slate-500">No Department Assigned</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{d.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                      ✨ If a department is assigned, all employees in that department are automatically assigned to this manager.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Direct Member Assignments
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#10b981]/15 text-[#10b981]">
                        {formAssignedMembers.length} Selected
                      </span>
                    </div>

                    {/* Full Page Picker Trigger Button */}
                    <button
                      type="button"
                      onClick={openModalTeamSelector}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
                    >
                      <Maximize2 size={14} />
                      <span>Open Full-Page Employee Selector</span>
                    </button>

                    {/* Quick in-modal search */}
                    <div className="relative">
                      <input
                        type="text"
                        value={modalMemberSearch}
                        onChange={(e) => setModalMemberSearch(e.target.value)}
                        placeholder="Quick search employee name..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981]"
                      />
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      {modalMemberSearch && (
                        <button
                          type="button"
                          onClick={() => setModalMemberSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Quick Selected chips */}
                    {formAssignedMembers.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        {formAssignedMembers.map((memberId) => {
                          const mUser = users.find((u) => u._id === memberId);
                          if (!mUser) return null;
                          return (
                            <span
                              key={memberId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#10b981]/15 text-[#10b981] text-[11px] font-bold"
                            >
                              <span className="truncate max-w-[120px]">{mUser.name}</span>
                              <button
                                type="button"
                                onClick={() => setFormAssignedMembers((prev) => prev.filter((id) => id !== memberId))}
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Scrollable list with check/uncheck */}
                    <div className="max-h-32 overflow-y-auto p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                      {users
                        .filter((u) => u._id !== currentUserId && u.role !== 'admin')
                        .filter((u) => {
                          if (!modalMemberSearch.trim()) return true;
                          const q = modalMemberSearch.toLowerCase();
                          return (
                            (u.name || '').toLowerCase().includes(q) ||
                            (u.email || '').toLowerCase().includes(q) ||
                            (u.department || '').toLowerCase().includes(q)
                          );
                        })
                        .map((teamUser) => {
                          const isSelected = formAssignedMembers.includes(teamUser._id);
                          return (
                            <div
                              key={teamUser._id}
                              onClick={() => {
                                setFormAssignedMembers((prev) =>
                                  isSelected ? prev.filter((id) => id !== teamUser._id) : [...prev, teamUser._id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#10b981]/15 text-slate-900 dark:text-white font-bold border border-[#10b981]/30'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {teamUser.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{teamUser.name} ({teamUser.department || 'No Dept'})</span>
                              </div>
                              {isSelected ? (
                                <Check size={14} className="text-[#10b981] shrink-0" />
                              ) : (
                                <span className="text-[10px] text-slate-400 opacity-60">+ Add</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs sm:text-sm transition-colors shadow-md shadow-[#10b981]/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{modalMode === 'create' ? 'Create Account' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULL-PAGE EMPLOYEE SELECTOR (FOR MANAGER TEAM ASSIGNMENT)                  */}
      {/* ========================================================================= */}
      {isFullPageSelectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-[#070b14] flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Top Header */}
          <header className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-20">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsFullPageSelectorOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Back / Close"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                    Assign Team Members
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                    <Shield size={13} />
                    <span>Manager: {selectorTargetManager?.name || 'Manager'}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {selectorTargetManager?.department ? `Department: ${selectorTargetManager.department}` : 'No Department'}
                  {selectorTargetManager?.assignedDepartment && ` • Manages: ${selectorTargetManager.assignedDepartment}`}
                  {' • '}
                  <strong className="text-slate-700 dark:text-slate-200">{selectorSelectedMemberIds.length}</strong> of {candidateEmployees.length} employees assigned
                </p>
              </div>
            </div>

            {/* Header Right Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                <UserCheck size={14} className="text-[#10b981]" />
                <span>{selectorSelectedMemberIds.length} Selected</span>
              </span>
              <button
                type="button"
                onClick={() => setIsFullPageSelectorOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSelectorAssignments}
                disabled={selectorIsSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-[#10b981]/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {selectorIsSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Save & Apply ({selectorSelectedMemberIds.length})</span>
              </button>
            </div>
          </header>

          {/* Controls Bar: Search, Filters & Bulk Actions */}
          <div className="px-6 py-3.5 bg-white dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-md shrink-0 space-y-3 z-10">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Live Search Input */}
              <div className="relative flex-1 max-w-2xl">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={selectorSearchQuery}
                  onChange={(e) => setSelectorSearchQuery(e.target.value)}
                  placeholder="Search by employee name, email, employee ID, department, or designation..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981] transition-all shadow-inner"
                />
                {selectorSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSelectorSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Department Dropdown & Bulk Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Department Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select
                    value={selectorDepartmentFilter}
                    onChange={(e) => setSelectorDepartmentFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Departments ({departments.length})</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Select / Deselect */}
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  disabled={filteredEmployees.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                  title="Add all currently shown employees to team"
                >
                  Select All Filtered ({filteredEmployees.length})
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  disabled={filteredEmployees.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                  title="Remove all currently shown employees from team"
                >
                  Deselect Filtered
                </button>

                {selectorSelectedMemberIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                    title="Remove all members"
                  >
                    Clear All ({selectorSelectedMemberIds.length})
                  </button>
                )}
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectorTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectorTab === 'all'
                    ? 'bg-[#10b981] text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Employees ({candidateEmployees.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectorTab('selected')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectorTab === 'selected'
                    ? 'bg-[#10b981] text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Assigned Only ({selectorSelectedMemberIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectorTab('unselected')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectorTab === 'unselected'
                    ? 'bg-[#10b981] text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Unassigned ({Math.max(0, candidateEmployees.length - selectorSelectedMemberIds.length)})
              </button>
            </div>
          </div>

          {/* Selected Tray (Chips of currently selected users) */}
          {selectorSelectedMemberIds.length > 0 && (
            <div className="px-6 py-2 bg-slate-100/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                  Assigned ({selectorSelectedMemberIds.length}):
                </span>
                {selectorSelectedMemberIds.map((id) => {
                  const emp = users.find((u) => u._id === id);
                  if (!emp) return null;
                  return (
                    <div
                      key={id}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-[#10b981]/30 shadow-xs text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0 animate-in fade-in"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="max-w-[130px] truncate">{emp.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleMember(id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                        title={`Remove ${emp.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Employee Grid Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredEmployees.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                  <UsersIcon size={30} />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                  No employees found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  {selectorSearchQuery
                    ? `No employees match "${selectorSearchQuery}". Try clearing search or switching filters.`
                    : selectorTab === 'selected'
                    ? 'No members currently assigned to this manager.'
                    : 'No employees available under this filter.'}
                </p>
                {(selectorSearchQuery || selectorDepartmentFilter !== 'all' || selectorTab !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectorSearchQuery('');
                      setSelectorDepartmentFilter('all');
                      setSelectorTab('all');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredEmployees.map((emp) => {
                  const isSelected = selectorSelectedMemberIds.includes(emp._id);
                  const isManagedDept =
                    selectorTargetManager?.assignedDepartment &&
                    emp.department === selectorTargetManager.assignedDepartment;

                  return (
                    <div
                      key={emp._id}
                      onClick={() => handleToggleMember(emp._id)}
                      className={`
                        group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none
                        ${
                          isSelected
                            ? 'bg-[#10b981]/10 dark:bg-[#10b981]/15 border-[#10b981] shadow-md shadow-[#10b981]/10 ring-1 ring-[#10b981]'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                        }
                      `}
                    >
                      <div>
                        {/* Top: Avatar, Name & Checkbox */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <UserAvatar targetUser={emp} />
                              {emp.active && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-[#10b981] transition-colors">
                                {emp.name}
                              </h4>
                              {emp.employeeId ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  <BadgeCheck size={11} className="text-[#10b981]" />
                                  <span>{emp.employeeId}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Member</span>
                              )}
                            </div>
                          </div>

                          {/* Checkbox Icon */}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                              isSelected
                                ? 'bg-[#10b981] text-slate-950 font-black shadow-xs'
                                : 'border border-slate-300 dark:border-slate-700 group-hover:border-[#10b981] text-transparent'
                            }`}
                          >
                            <Check size={14} className={isSelected ? 'stroke-[3]' : ''} />
                          </div>
                        </div>

                        {/* Middle Info: Email & Role */}
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                            <Mail size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                          {emp.designationRole && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                              <Briefcase size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate">{emp.designationRole}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Badges */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-auto">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">
                          <Building2 size={11} />
                          <span>{emp.department || 'No Dept'}</span>
                        </span>

                        {isManagedDept && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-[#10b981] text-[10px] font-black border border-emerald-500/30 shrink-0">
                            <Sparkles size={10} />
                            <span>In Managed Dept</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Bottom Footer */}
          <footer className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-lg z-20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Assigning to <strong className="text-slate-800 dark:text-slate-200">{selectorTargetManager?.name}</strong>:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#10b981]/15 text-[#10b981]">
                {selectorSelectedMemberIds.length} Selected
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsFullPageSelectorOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSelectorAssignments}
                disabled={selectorIsSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-[#10b981]/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {selectorIsSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Save & Apply ({selectorSelectedMemberIds.length})</span>
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};

export default Users;