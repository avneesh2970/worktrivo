import React, { useState, useEffect, useRef } from 'react';
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
  Check
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

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Direct Member Assignments</span>
                      <span className="text-[10px] text-slate-500">Optional</span>
                    </label>
                    <div className="max-h-28 overflow-y-auto p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                      {users
                        .filter((u) => u._id !== currentUserId && u.role !== 'admin')
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
                                isSelected ? 'bg-[#10b981]/15 text-slate-900 dark:text-white font-bold border border-[#10b981]/30' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="truncate">{teamUser.name} ({teamUser.department || 'No Dept'})</span>
                              {isSelected && <Check size={13} className="text-[#10b981] shrink-0" />}
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
    </div>
  );
};

export default Users;