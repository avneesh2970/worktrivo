import React, { useEffect, useState } from 'react';
import { API_BASE, useAuth } from '../context/AuthContext';
import {
  Settings, Building2, ShieldCheck, Bell, Plug, CalendarClock,
  Plus, Trash2, Edit2, X, CheckCircle2, AlertCircle, Loader2, Save
} from 'lucide-react';

const TABS = [
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
  { key: 'notifications', label: 'Notification Rules', icon: Bell },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'system', label: 'System Settings', icon: CalendarClock },
];

const ROLE_PERMISSIONS = [
  { role: 'Admin', permissions: 'Full system access — manage users, departments, roles, settings, all tasks, groups, and announcements.' },
  { role: 'Manager', permissions: 'Create/assign tasks, manage groups, post announcements, view all reports and audit logs.' },
  { role: 'Member', permissions: 'View/update own assigned tasks, participate in chat, receive notifications.' },
];

const AdminSettings = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('departments');
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  return (
    <div className="min-h-screen text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Toast Message */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1e2640] text-slate-100 shadow-xl text-sm border border-[#dc9750]/30">
          <CheckCircle2 size={16} className="text-[#dc9750]" />
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 text-slate-100">
          <Settings size={26} className="text-[#dc9750]" />
          Admin<span className="text-[#dc9750]">Settings</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage departments, roles, notification rules, integrations, and system-wide preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab Navigation */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-2 shadow-sm">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all active:scale-[0.98] ${isActive
                    ? "bg-[#dc9750] text-[#1e2640] shadow-sm"
                    : "text-slate-300 hover:bg-[#1e2640]/80 hover:text-[#dc9750]"
                    }`}
                >
                  <Icon size={16} className={isActive ? "text-[#1e2640]" : "text-slate-400"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'departments' && <DepartmentsTab token={token} showToast={setToastMsg} />}
          {activeTab === 'roles' && <RolesTab token={token} showToast={setToastMsg} />}
          {activeTab === 'notifications' && <NotificationRulesTab token={token} showToast={setToastMsg} />}
          {activeTab === 'integrations' && <IntegrationsTab token={token} showToast={setToastMsg} />}
          {activeTab === 'system' && <SystemSettingsTab token={token} showToast={setToastMsg} />}
        </div>
      </div>
    </div>
  );
};

/* ============================== Departments ============================== */

const DepartmentsTab = ({ token, showToast }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentId, setCurrentId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch departments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setCurrentId(null);
    setFormName('');
    setFormDescription('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (dept) => {
    setModalMode('edit');
    setCurrentId(dept._id);
    setFormName(dept.name);
    setFormDescription(dept.description || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) return setFormError('Department name is required.');

    setSubmitting(true);
    try {
      const url = modalMode === 'create' ? `${API_BASE}/departments` : `${API_BASE}/departments/${currentId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        fetchDepartments();
        showToast(modalMode === 'create' ? 'Department created.' : 'Department updated.');
      } else {
        setFormError(data.error || 'Failed to save department.');
      }
    } catch (err) {
      setFormError('Network error. Failed to save department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department? This will not affect users already assigned to it.')) return;
    try {
      await fetch(`${API_BASE}/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDepartments();
      showToast('Department deleted.');
    } catch (err) {
      console.error('Failed to delete department', err);
    }
  };

  return (
    <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-100">Departments / Teams</h3>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#dc9750] hover:bg-[#dc9750]/80 text-[#1e2640] text-xs font-bold rounded-lg transition-all active:scale-95 shadow-sm"
        >
          <Plus size={14} /> Add Department
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[#dc9750]" />
        </div>
      ) : departments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No departments yet.</p>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept._id}
              className="flex items-center justify-between p-3 rounded-lg border border-[#dc9750]/10 bg-[#1e2640]/50"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">{dept.name}</p>
                {dept.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{dept.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(dept)}
                  className="p-1.5 text-slate-400 hover:text-[#dc9750] rounded-md hover:bg-slate-800/60 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(dept._id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-800/60 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e2640] border border-[#dc9750]/30 rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
              <h3 className="text-base font-bold text-slate-100">
                {modalMode === 'create' ? 'Add Department' : 'Edit Department'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100 placeholder:text-slate-500"
                  placeholder="e.g., Engineering"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100 placeholder:text-slate-500 resize-none"
                  placeholder="Optional"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800/80 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#dc9750] hover:bg-[#dc9750]/80 disabled:opacity-50 text-[#1e2640] rounded-lg transition-all active:scale-95 shadow-sm"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {modalMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================== Roles & Permissions ========================== */

const RolesTab = ({ token, showToast }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRole = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u)));
        showToast('Role updated.');
      } else {
        showToast('Failed to update role.');
      }
    } catch (err) {
      console.error('Failed to update role', err);
      showToast('Network error updating role.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Permission Reference Card */}
      <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-100 mb-4">Role Permission Reference</h3>
        <div className="space-y-3">
          {ROLE_PERMISSIONS.map((r) => (
            <div key={r.role} className="p-3 rounded-lg border border-[#dc9750]/10 bg-[#1e2640]/50">
              <p className="text-xs font-bold text-[#dc9750] uppercase tracking-wider">{r.role}</p>
              <p className="text-sm text-slate-300 mt-1">{r.permissions}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Assign Roles Card */}
      <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-100 mb-4">Assign Roles</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#dc9750]" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="flex items-center justify-between p-3 rounded-lg border border-[#dc9750]/10 bg-[#1e2640]/50">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  disabled={updatingId === u._id}
                  onChange={(e) => changeRole(u._id, e.target.value)}
                  className="text-xs font-medium px-3 py-1.5 bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-200 disabled:opacity-50 cursor-pointer"
                >
                  <option value="admin" className="bg-[#1e2640] text-slate-100">Admin</option>
                  <option value="manager" className="bg-[#1e2640] text-slate-100">Manager</option>
                  <option value="member" className="bg-[#1e2640] text-slate-100">Member</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ========================== Shared settings fetch ========================== */

const useSystemSettings = (token) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { settings, setSettings, loading, refetch: fetchSettings };
};

/* ============================ Notification Rules ============================ */

const NotificationRulesTab = ({ token, showToast }) => {
  const { settings, loading } = useSystemSettings(token);
  const [reminderHours, setReminderHours] = useState(24);
  const [dailyOverdue, setDailyOverdue] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setReminderHours(settings.notificationRules?.reminderHoursBeforeDue ?? 24);
      setDailyOverdue(settings.notificationRules?.dailyOverdueReminder ?? true);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          notificationRules: {
            reminderHoursBeforeDue: Number(reminderHours),
            dailyOverdueReminder: dailyOverdue,
          },
        }),
      });
      if (res.ok) {
        showToast('Notification rules saved.');
      } else {
        showToast('Failed to save notification rules.');
      }
    } catch (err) {
      console.error('Failed to save notification rules', err);
      showToast('Network error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#dc9750]" />
      </div>
    );
  }

  return (
    <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm space-y-5">
      <h3 className="font-semibold text-slate-100">Notification Rules</h3>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Send "due soon" reminder this many hours before the deadline
        </label>
        <input
          type="number"
          min={1}
          value={reminderHours}
          onChange={(e) => setReminderHours(e.target.value)}
          className="w-32 px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="dailyOverdue"
          checked={dailyOverdue}
          onChange={(e) => setDailyOverdue(e.target.checked)}
          className="accent-[#dc9750] w-4 h-4 rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750]"
        />
        <label htmlFor="dailyOverdue" className="text-sm text-slate-300 cursor-pointer">
          Send a daily reminder for tasks that remain overdue
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#dc9750] hover:bg-[#dc9750]/80 disabled:opacity-50 text-[#1e2640] rounded-lg transition-all active:scale-95 shadow-sm"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Changes
      </button>
    </div>
  );
};

/* =============================== Integrations =============================== */

const IntegrationsTab = ({ token, showToast }) => {
  const { settings, loading } = useSystemSettings(token);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setSlackEnabled(settings.integrations?.slack?.enabled ?? false);
      setSlackWebhook(settings.integrations?.slack?.webhookUrl ?? '');
      setCalendarEnabled(settings.integrations?.googleCalendar?.enabled ?? false);
      setEmailEnabled(settings.integrations?.emailToTask?.enabled ?? false);
      setEmailAddress(settings.integrations?.emailToTask?.inboundAddress ?? '');
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          integrations: {
            slack: { enabled: slackEnabled, webhookUrl: slackWebhook },
            googleCalendar: { enabled: calendarEnabled },
            emailToTask: { enabled: emailEnabled, inboundAddress: emailAddress },
          },
        }),
      });
      if (res.ok) {
        showToast('Integration settings saved.');
      } else {
        showToast('Failed to save integration settings.');
      }
    } catch (err) {
      console.error('Failed to save integrations', err);
      showToast('Network error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#dc9750]" />
      </div>
    );
  }

  return (
    <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm space-y-6">
      {/* Information/Warning Callout */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#dc9750]/10 border border-[#dc9750]/30 text-[#dc9750] text-xs">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          These integrations save configuration only — live syncing (posting to Slack, pulling from
          Google Calendar, parsing inbound email) is not wired up yet and would need real credentials
          set up separately before it does anything.
        </span>
      </div>

      {/* Slack / Teams Section */}
      <div className="space-y-2 pb-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="slackEnabled"
            checked={slackEnabled}
            onChange={(e) => setSlackEnabled(e.target.checked)}
            className="accent-[#dc9750] w-4 h-4 rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750]"
          />
          <label htmlFor="slackEnabled" className="text-sm font-semibold text-slate-200 cursor-pointer">
            Slack / Teams Integration
          </label>
        </div>
        <input
          type="text"
          value={slackWebhook}
          onChange={(e) => setSlackWebhook(e.target.value)}
          placeholder="Webhook URL"
          className="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Google Calendar Section */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-700/50">
        <input
          type="checkbox"
          id="calendarEnabled"
          checked={calendarEnabled}
          onChange={(e) => setCalendarEnabled(e.target.checked)}
          className="accent-[#dc9750] w-4 h-4 rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750]"
        />
        <label htmlFor="calendarEnabled" className="text-sm font-semibold text-slate-200 cursor-pointer">
          Google Calendar / Outlook Sync
        </label>
      </div>

      {/* Email-to-Task Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="emailEnabled"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
            className="accent-[#dc9750] w-4 h-4 rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750]"
          />
          <label htmlFor="emailEnabled" className="text-sm font-semibold text-slate-200 cursor-pointer">
            Email-to-Task
          </label>
        </div>
        <input
          type="text"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          placeholder="Inbound address (e.g., tasks@yourcompany.com)"
          className="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#dc9750] hover:bg-[#dc9750]/80 disabled:opacity-50 text-[#1e2640] rounded-lg transition-all active:scale-95 shadow-sm"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Changes
      </button>
    </div>
  );
};

/* ============================ System Settings ============================ */

const SystemSettingsTab = ({ token, showToast }) => {
  const { settings, loading } = useSystemSettings(token);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [escalationEnabled, setEscalationEnabled] = useState(true);
  const [escalationDays, setEscalationDays] = useState(2);
  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setStartTime(settings.workingHours?.start ?? '09:00');
      setEndTime(settings.workingHours?.end ?? '18:00');
      setEscalationEnabled(settings.escalation?.enabled ?? true);
      setEscalationDays(settings.escalation?.daysOverdueForEscalation ?? 2);
      setHolidays(
        (settings.holidays || []).map((h) => ({
          date: h.date ? new Date(h.date).toISOString().slice(0, 10) : '',
          label: h.label,
        }))
      );
    }
  }, [settings]);

  const addHoliday = () => {
    if (!newHolidayDate || !newHolidayLabel.trim()) return;
    setHolidays((prev) => [...prev, { date: newHolidayDate, label: newHolidayLabel.trim() }]);
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  const removeHoliday = (index) => {
    setHolidays((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workingHours: { start: startTime, end: endTime },
          escalation: { enabled: escalationEnabled, daysOverdueForEscalation: Number(escalationDays) },
          holidays,
        }),
      });
      if (res.ok) {
        showToast('System settings saved.');
      } else {
        showToast('Failed to save system settings.');
      }
    } catch (err) {
      console.error('Failed to save system settings', err);
      showToast('Network error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#dc9750]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Working Hours Panel */}
      <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-100">Working Hours</h3>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Start</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">End</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Task Escalation Panel */}
      <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-100">Task Escalation Rules</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="escalationEnabled"
            checked={escalationEnabled}
            onChange={(e) => setEscalationEnabled(e.target.checked)}
            className="accent-[#dc9750] w-4 h-4 rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750]"
          />
          <label htmlFor="escalationEnabled" className="text-sm text-slate-300 cursor-pointer">
            Automatically escalate priority on overdue tasks
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Escalate after this many days overdue
          </label>
          <input
            type="number"
            min={1}
            value={escalationDays}
            onChange={(e) => setEscalationDays(e.target.value)}
            disabled={!escalationEnabled}
            className="w-32 px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 disabled:opacity-50 transition-colors text-slate-100"
          />
        </div>
      </div>

      {/* Holiday Calendar Panel */}
      <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-100">Holiday Calendar</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100"
          />
          <input
            type="text"
            value={newHolidayLabel}
            onChange={(e) => setNewHolidayLabel(e.target.value)}
            placeholder="e.g., Diwali"
            className="flex-1 px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={addHoliday}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#dc9750]/10 hover:bg-[#dc9750]/20 text-[#dc9750] border border-[#dc9750]/30 text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {holidays.length > 0 && (
          <div className="space-y-1.5">
            {holidays.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-[#dc9750]/10 bg-[#1e2640]/50 text-sm">
                <span className="text-slate-200 font-medium">{h.label} <span className="text-slate-500 mx-2">—</span> {h.date}</span>
                <button onClick={() => removeHoliday(i)} className="text-rose-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary Action */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#dc9750] hover:bg-[#dc9750]/80 disabled:opacity-50 text-[#1e2640] rounded-lg transition-all active:scale-95 shadow-sm"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Changes
      </button>
    </div>
  );
};

export default AdminSettings;