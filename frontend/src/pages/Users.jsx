import React, { useState, useEffect, useRef } from 'react';
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
  BadgeCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

// Helper component for user image with seamless fallback to initials
const UserAvatar = ({ targetUser }) => {
  const name = targetUser?.name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  // Extract raw photo field from user object
  const rawPhoto = targetUser?.profilePhoto || targetUser?.avatar || targetUser?.avatarUrl;

  // Cleaned up profile photo URL resolution
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
          className="w-10 h-10 rounded-full border border-indigo-500 object-cover shadow-md"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}

      {/* Fallback Initials Badge (Shown if no URL or if image fails to load) */}
      <div
        className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white font-semibold text-sm flex items-center justify-center shadow-md border border-indigo-400/30"
        style={{ display: profilePhotoUrl ? 'none' : 'flex' }}
      >
        {initial}
      </div>
    </div>
  );
};

const Users = () => {
  const { user, token } = useAuth();
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

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('member');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- CSV IMPORT LOGIC ---
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

  useEffect(() => {
    if (user && ['admin', 'manager'].includes(user.role)) {
      fetchUsers();
    }
  }, [user]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormEmployeeId('');
    setFormPhoto('');
    setFormPassword('');
    setFormRole('member');
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
      role: formRole
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

  // Calculate quick stats
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  if (user && user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md max-w-lg mx-auto shadow-2xl">
        <div className="p-4 bg-rose-500/10 rounded-full mb-4 text-rose-400 ring-1 ring-rose-500/20">
          <ShieldAlert size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">Access Denied</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          This management portal is reserved exclusively for system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-200 min-h-screen">
  {/* Header Row */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#dc9750]/20">
    <div>
      <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
        Team <span className="text-[#dc9750]">Management</span>
      </h1>
      <p className="text-sm text-slate-400 mt-1">
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
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#dc9750]/20 bg-[#1e2640]/70 hover:bg-[#283354] text-slate-200 font-medium text-sm transition-all duration-200 disabled:opacity-50 shadow-sm"
      >
        {importing ? <Loader2 size={18} className="animate-spin text-[#dc9750]" /> : <Upload size={18} className="text-[#dc9750]" />}
        <span>{importing ? 'Importing...' : 'Import CSV'}</span>
      </button>

      <button
        onClick={openCreateModal}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#dc9750] hover:bg-[#c08446] text-[#161c30] font-semibold text-sm transition-all duration-200 shadow-md shadow-[#dc9750]/15 active:scale-[0.98]"
      >
        <UserPlus size={18} />
        <span>Add Member</span>
      </button>
    </div>
  </div>

  {/* Quick Stats Overview */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="bg-[#1e2640]/60 border border-[#dc9750]/20 rounded-2xl p-5 flex items-center justify-between backdrop-blur-md shadow-sm">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Accounts</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</p>
      </div>
      <div className="p-3 bg-[#dc9750]/15 text-[#dc9750] rounded-xl border border-[#dc9750]/20">
        <UsersIcon size={20} />
      </div>
    </div>

    <div className="bg-[#1e2640]/60 border border-[#dc9750]/20 rounded-2xl p-5 flex items-center justify-between backdrop-blur-md shadow-sm">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Members</p>
        <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
      </div>
      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
        <CheckCircle2 size={20} />
      </div>
    </div>

    <div className="bg-[#1e2640]/60 border border-[#dc9750]/20 rounded-2xl p-5 flex items-center justify-between backdrop-blur-md shadow-sm">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Administrators</p>
        <p className="text-2xl font-bold text-amber-400 mt-1">{adminCount}</p>
      </div>
      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
        <ShieldAlert size={20} />
      </div>
    </div>
  </div>

  {/* Filters & Controls */}
  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
    <div className="relative w-full sm:w-80">
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search by name, email, or ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 bg-[#1e2640]/80 border border-[#dc9750]/20 rounded-xl text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all"
      />
    </div>

    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
      <span className="text-xs text-slate-400 font-medium">Role:</span>
      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
        className="bg-[#1e2640]/80 border border-[#dc9750]/20 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#dc9750] transition-colors cursor-pointer"
      >
        <option value="all" className="bg-[#1e2640] text-slate-100">All Roles</option>
        <option value="admin" className="bg-[#1e2640] text-slate-100">Admin</option>
        <option value="manager" className="bg-[#1e2640] text-slate-100">Manager</option>
        <option value="member" className="bg-[#1e2640] text-slate-100">Team Member</option>
      </select>
    </div>
  </div>

  {/* Main Content Table Area */}
  {loading ? (
    <div className="flex flex-col items-center justify-center py-24 gap-3 bg-[#1e2640]/30 border border-[#dc9750]/20 rounded-2xl">
      <Loader2 className="w-8 h-8 text-[#dc9750] animate-spin" />
      <p className="text-xs text-slate-400">Fetching team members...</p>
    </div>
  ) : filteredUsers.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-[#1e2640]/30 border border-[#dc9750]/20 rounded-2xl">
      <User className="w-12 h-12 text-slate-500 mb-3" />
      <h3 className="text-slate-200 font-semibold text-base">No Users Found</h3>
      <p className="text-slate-400 text-xs mt-1 max-w-sm">
        No accounts matched your search criteria. Try adjusting your query or filter options.
      </p>
    </div>
  ) : (
    <div className="bg-[#1e2640]/50 border border-[#dc9750]/20 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-[#283354] bg-[#1a2138] text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th scope="col" className="px-6 py-4">User</th>
              <th scope="col" className="px-6 py-4">Employee ID</th>
              <th scope="col" className="px-6 py-4">Role</th>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Joined</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#283354]/60">
            {filteredUsers.map((u) => (
              <tr
                key={u._id}
                className={`transition-colors hover:bg-[#283354]/40 ${!u.active ? 'opacity-60 bg-[#161c30]/50' : ''}`}
              >
                {/* User Profile Photo & Details */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar targetUser={u} />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <span>{u.name}</span>
                        {u._id === user._id && (
                          <span className="text-[10px] font-bold text-[#dc9750] bg-[#dc9750]/10 border border-[#dc9750]/30 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-normal mt-0.5">{u.email}</div>
                    </div>
                  </div>
                </td>

                {/* Employee ID */}
                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300 font-medium">
                  {u.employeeId ? (
                    <span className="font-mono bg-[#161c30] px-2.5 py-1 rounded-md text-slate-300 border border-[#283354]/30">
                      {u.employeeId}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">N/A</span>
                  )}
                </td>

                {/* Role Badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30 font-semibold">
                        <ShieldAlert size={14} />
                        <span>Admin</span>
                      </span>
                    ) : u.role === 'manager' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                        <Shield size={14} />
                        <span>Manager</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#283354]/60 text-slate-300 border border-[#283354]">
                        <User size={14} />
                        <span>Team Member</span>
                      </span>
                    )}
                  </div>
                </td>

                {/* Status Badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${u.active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                    {u.active ? 'Active' : 'Deactivated'}
                  </span>
                </td>

                {/* Joined Date */}
                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#283354] transition-colors"
                      title="Edit Account"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={u._id === user._id}
                      className={`p-2 rounded-lg transition-colors ${u._id === user._id
                          ? 'opacity-30 cursor-not-allowed text-slate-600'
                          : u.active
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#161c30]/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1e2640] border border-[#283354] rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-black/50 relative space-y-6">

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#283354]">
          <h3 className="text-lg font-semibold text-slate-100">
            {modalMode === 'create' ? 'Add New Team Member' : 'Edit Member Profile'}
          </h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#283354] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Message */}
        {formError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Full Name *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all placeholder:text-slate-600"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex. Sarah Connor"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Work Email *</label>
            <input
              type="email"
              className="w-full px-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all placeholder:text-slate-600"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          {/* Employee ID Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Employee ID</span>
              <span className="text-[10px] text-slate-500">Optional</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-9 pr-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all placeholder:text-slate-600"
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
                placeholder="Ex. EMP-001"
              />
              <BadgeCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Profile Photo URL Input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Profile Photo URL / Path</span>
              <span className="text-[10px] text-slate-500">Optional</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-9 pr-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all placeholder:text-slate-600"
                value={formPhoto}
                onChange={(e) => setFormPhoto(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
              <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              {modalMode === 'create' ? 'Password *' : 'Password (leave blank to keep unchanged)'}
            </label>
            <input
              type="password"
              className="w-full px-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all placeholder:text-slate-600"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder={modalMode === 'create' ? '••••••••' : 'Optional password reset'}
              required={modalMode === 'create'}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">System Role</label>
            <select
              className="w-full px-3.5 py-2 bg-[#161c30] border border-[#283354] rounded-xl text-slate-100 text-sm focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] transition-all"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
            >
              <option value="member" className="bg-[#1e2640] text-slate-100">Team Member</option>
              <option value="manager" className="bg-[#1e2640] text-slate-100">Manager</option>
              <option value="admin" className="bg-[#1e2640] text-slate-100">Admin</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#283354]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-[#283354] hover:bg-[#283354]/80 text-slate-300 font-medium text-sm transition-colors"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#dc9750] hover:bg-[#c08446] text-[#161c30] font-semibold text-sm transition-colors shadow-md shadow-[#dc9750]/20 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{modalMode === 'create' ? 'Create Account' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>
  );
};

export default Users;