import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import {
  Plus, Search, Filter, RefreshCw, Edit2, Trash2, Calendar, AlertCircle,
  LayoutGrid, List, X, Paperclip, CheckCircle2,
  KanbanSquare, CalendarDays, GanttChartSquare, Mic, UserPlus, CheckSquare, Square
} from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import CalendarView from '../components/CalendarView';
import GanttChart from '../components/GanttChart';
import VoiceTaskModal from '../components/VoiceTaskModal';
import { useSocket } from "../context/SocketContext";

const Tasks = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tasks & View State
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list' | 'kanban' | 'calendar' | 'gantt'

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(''); // name or Employee ID
  const [sortBy, setSortBy] = useState('dueDate:asc');

  // Sync filters with the URL every time it changes (not just on first
  // mount) — lets Sidebar/Dashboard links update the list without a refresh.
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setDateFilter(searchParams.get('dueDate') || '');
  }, [searchParams]);

  // Bulk assignment state
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState('');
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);

  // Bulk create state
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [bulkCreateEmployeeId, setBulkCreateEmployeeId] = useState('');
  const [bulkCreateTasks, setBulkCreateTasks] = useState([
    {
      title: "",
      description: "",
      priority: "Medium",
      status: "To Do",
      dueDate: ""
    }
  ]);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateError, setBulkCreateError] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentTaskId, setCurrentTaskId] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formStatus, setFormStatus] = useState('To Do');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formEstimatedHours, setFormEstimatedHours] = useState(0);
  const [formAssignedTo, setFormAssignedTo] = useState([]);
  const [formAttachment, setFormAttachment] = useState('');
  const [formAttachmentsList, setFormAttachmentsList] = useState([]);
  const [formTags, setFormTags] = useState([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [formChecklist, setFormChecklist] = useState([]);
  const [formChecklistInput, setFormChecklistInput] = useState('');
  const [formDependencies, setFormDependencies] = useState([]);
  const [formError, setFormError] = useState('');

  // Confirm Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  // Lightweight built-in toast (no external dependency required)
  const [toastMsg, setToastMsg] = useState(null);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (dateFilter) params.append('dueDate', dateFilter);
      if (assigneeFilter) params.append('assignee', assigneeFilter);
      if (sortBy) params.append('sortBy', sortBy);

      const res = await fetch(`${API_BASE}/tasks?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      const taskList = Array.isArray(data) ? data : [];
      setTasks(taskList);
      setAllTasks(taskList);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsersList(Array.isArray(data) ? data.filter(u => u.active) : []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, priorityFilter, dateFilter, assigneeFilter, sortBy]);

  useEffect(() => {
    // FIX: previous condition was `user && user.role === 'admin' || 'manager'`
    // which always evaluated truthy due to operator precedence.
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      fetchUsers();
    }
  }, [user]);

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormPriority('Medium');
    setFormStatus('To Do');
    setFormStartDate('');
    setFormDueDate('');
    setFormEstimatedHours(0);
    setFormAssignedTo([]);
    setFormAttachment('');
    setFormAttachmentsList([]);
    setFormTags([]);
    setFormTagInput('');
    setFormChecklist([]);
    setFormChecklistInput('');
    setFormDependencies([]);
    setFormError('');
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setIsModalOpen(true);
  };

  // Called by VoiceTaskModal once the transcript has been parsed on the backend.
  // Pre-fills the normal create-task form so the person can review/edit
  // before actually submitting — matches the "confirm before it's pushed" flow.
  const handleVoiceParsed = (parsed) => {
    resetForm();
    setModalMode('create');
    setFormTitle(parsed.title || '');
    setFormPriority(parsed.priority || 'Medium');
    if (parsed.dueDate) {
      setFormDueDate(new Date(parsed.dueDate).toISOString().slice(0, 16));
    }
    if (parsed.assignedTo?.length) {
      setFormAssignedTo(parsed.assignedTo);
    }
    setIsVoiceModalOpen(false);
    setIsModalOpen(true);
    if (parsed.warnings?.length) {
      setToastMsg(parsed.warnings[0]);
    }
  };

  const openEditModal = (task, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setCurrentTaskId(task._id);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormPriority(task.priority);
    setFormStatus(task.status);

    if (task.startDate) {
      setFormStartDate(new Date(task.startDate).toISOString().slice(0, 16));
    } else {
      setFormStartDate('');
    }

    setFormEstimatedHours(task.estimatedHours || 0);
    setFormTags(task.tags || []);
    setFormChecklist(task.checklist || []);
    setFormDependencies(task.dependencies || []);

    const formattedDate = new Date(task.dueDate).toISOString().slice(0, 16);
    setFormDueDate(formattedDate);
    setFormAssignedTo(task.assignedTo.map(u => u._id));
    setFormAttachmentsList(task.attachments || []);
    setFormAttachment('');
    setFormError('');
    setIsModalOpen(true);
  };

  const addChecklistItem = () => {
    if (!formChecklistInput.trim()) return;
    setFormChecklist(prev => [...prev, { title: formChecklistInput.trim(), completed: false }]);
    setFormChecklistInput('');
  };

  const toggleChecklistItem = (index) => {
    setFormChecklist(prev =>
      prev.map((item, i) => (i === index ? { ...item, completed: !item.completed } : item))
    );
  };

  const removeChecklistItem = (index) => {
    setFormChecklist(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (!formTagInput.trim()) return;
    setFormTags(prev => [...prev, formTagInput.trim()]);
    setFormTagInput('');
  };

  const handleRemoveTag = (index) => {
    setFormTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAttachment = () => {
    if (formAttachment && formAttachment.trim()) {
      setFormAttachmentsList(prev => [...prev, formAttachment.trim()]);
      setFormAttachment('');
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormAttachmentsList(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAssignee = (userId) => {
    setFormAssignedTo(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) return setFormError('Title is required');
    if (!formDueDate) return setFormError('Due date is required');
    if (formAssignedTo.length === 0) return setFormError('Please assign at least one team member');

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      priority: formPriority,
      status: formStatus,
      startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
      dueDate: new Date(formDueDate).toISOString(),
      estimatedHours: Number(formEstimatedHours),
      assignedTo: formAssignedTo,
      attachments: formAttachmentsList,
      tags: formTags,
      checklist: formChecklist,
      dependencies: formDependencies
    };

    try {
      const url = modalMode === 'create' ? `${API_BASE}/tasks` : `${API_BASE}/tasks/${currentTaskId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        await fetchTasks();
        setToastMsg(modalMode === 'create' ? 'Task created successfully!' : 'Task updated successfully!');
      } else {
        setFormError(data.error || 'Operation failed');
      }
    } catch (err) {
      setFormError('Network error. Failed to save task.');
    }
  };

  const confirmDelete = (taskId, e) => {
    e.stopPropagation();
    setDeleteTaskId(taskId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${deleteTaskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIsDeleteConfirmOpen(false);
        fetchTasks();
      } else {
        alert('Failed to delete task.');
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  // ---------- Bulk assignment ----------
  const toggleTaskSelected = (taskId, e) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const clearSelection = () => setSelectedTaskIds([]);

  const handleBulkAssign = async () => {
    if (!bulkAssignUserId || selectedTaskIds.length === 0) return;
    setBulkAssignLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/bulk-assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskIds: selectedTaskIds, userId: bulkAssignUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg(`Assigned ${data.updated} task${data.updated !== 1 ? 's' : ''} successfully.`);
        setIsBulkAssignOpen(false);
        setBulkAssignUserId('');
        clearSelection();
        fetchTasks();
      } else {
        alert(data.error || 'Bulk assignment failed.');
      }
    } catch (err) {
      console.error('Bulk assign error', err);
      alert('Bulk assignment failed.');
    } finally {
      setBulkAssignLoading(false);
    }
  };

  // ---------- Bulk create ----------
  const addBulkTaskRow = () => {
    setBulkCreateTasks(prev => [
      ...prev,
      {
        title: "",
        description: "",
        priority: "Medium",
        status: "To Do",
        dueDate: ""
      }
    ]);
  };

  const removeBulkTaskRow = (index) => {
    setBulkCreateTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBulkTaskRow = (index, field, value) => {
    setBulkCreateTasks((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const resetBulkCreate = () => {
    setBulkCreateEmployeeId('');
    setBulkCreateTasks([
      {
        title: "",
        description: "",
        priority: "Medium",
        status: "To Do",
        dueDate: ""
      }
    ]);
    setBulkCreateError('');
  };

  const handleBulkCreateSubmit = async () => {
    setBulkCreateError('');
    if (!bulkCreateEmployeeId) return setBulkCreateError('Please select an employee.');

    const validTasks = bulkCreateTasks.filter((t) => t.title.trim() && t.dueDate);
    if (validTasks.length === 0) return setBulkCreateError('Add at least one task with a title and due date.');

    setBulkCreateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assignedTo: bulkCreateEmployeeId,
          tasks: validTasks.map((t) => ({
            title: t.title.trim(),
            description: t.description,
            priority: t.priority,
            status: t.status,
            dueDate: new Date(t.dueDate).toISOString(),
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg(`Created ${data.created} task${data.created > 1 ? 's' : ''} successfully!`);
        setIsBulkCreateOpen(false);
        resetBulkCreate();
        fetchTasks();
      } else {
        setBulkCreateError(data.error || 'Bulk creation failed.');
      }
    } catch (err) {
      setBulkCreateError('Network error. Failed to create tasks.');
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'To Do': 'bg-blue-500/20 text-blue-300 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      'In Progress': 'bg-[#dc9750] text-yellow-300 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
      'In Review': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
      'Blocked': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
      'Completed (Pending Approval)': 'bg-green-500/20 text-green-300 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
      'Approved': 'bg-red-500/20 text-red-300 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
      'Rejected': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800',
      'Overdue': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
    };

    const colorClass = statusMap[status] || 'bg-slate-100 text-slate-700 border-slate-300';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      Low: 'bg-green-500/20 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      Medium: 'bg-cyan-500/20 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      High: 'bg-orange-500/20 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
      Urgent: 'bg-red-500/20 text-red-700 dark:bg-red-950/60 dark:text-red-400'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${priorityMap[priority] || ''}`}>
        {priority} Priority
      </span>
    );
  };

  const canManage = ['admin', 'manager'].includes(user?.role);
  const validBulkCount = bulkCreateTasks.filter(t => t.title.trim() && t.dueDate).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1120] via-[#111827] to-[#1E1B4B] text-white p-4 sm:p-6 lg:p-8">

      {/* Inline toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1e2640] backdrop-blur-xl text-slate-100 shadow-xl border border-[#dc9750]/30 text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={16} className="text-[#dc9750]" />
          {toastMsg}
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100">
            Workflow <span className="text-[#dc9750]">Tasks</span>
          </h2>
          <p className="text-sm text-slate-400">
            Search, filter, and track tasks across team members.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e2640] border border-slate-700/60 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#dc9750]/50"
            >
              <Mic size={18} className="text-[#dc9750]" />
              <span>Voice Task</span>
            </button>
            <button
              onClick={() => { resetBulkCreate(); setIsBulkCreateOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e2640] border border-slate-700/60 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#dc9750]/50"
            >
              <UserPlus size={18} className="text-[#dc9750]" />
              <span>Bulk Create</span>
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#dc9750] hover:bg-[#dc9750]/80 text-[#1e2640] text-sm font-bold rounded-xl shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#dc9750]/50 active:scale-95"
            >
              <Plus size={18} />
              <span>Create Task</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and View Bar */}
      <div className="bg-[#1e2640] border border-slate-700/60 rounded-xl p-4 shadow-sm mb-6 space-y-4">
        {/* Row 1: Search + Assignee Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 w-full mb-3 sm:mb-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by task title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-slate-100 placeholder:text-slate-500 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors"
            />
          </div>

          {canManage && (
            <div className="relative flex-1 w-full">
              <UserPlus size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by team member name or Employee ID..."
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-slate-100 placeholder:text-slate-500 text-sm bg-slate-900/60 border border-slate-700/60 rounded-lg outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Row 2: View Switcher */}
        <div className="flex justify-end">
          <div className="flex items-center bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 overflow-x-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'grid'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'list'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              title="List View"
            >
              <List size={16} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'kanban'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              title="Kanban Board"
            >
              <KanbanSquare size={16} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'calendar'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              title="Calendar View"
            >
              <CalendarDays size={16} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'gantt'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              title="Gantt / Timeline View"
            >
              <GanttChartSquare size={16} />
              <span className="hidden sm:inline">Gantt</span>
            </button>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/60">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-[#1e2640] text-slate-100">All Statuses</option>
              <option value="To Do" className="bg-[#1e2640] text-slate-100">To Do</option>
              <option value="In Progress" className="bg-[#1e2640] text-slate-100">In Progress</option>
              <option value="In Review" className="bg-[#1e2640] text-slate-100">In Review</option>
              <option value="Blocked" className="bg-[#1e2640] text-slate-100">Blocked</option>
              <option value="Completed (Pending Approval)" className="bg-[#1e2640] text-slate-100">Pending Approval</option>
              <option value="Approved" className="bg-[#1e2640] text-slate-100">Approved</option>
              <option value="Rejected" className="bg-[#1e2640] text-slate-100">Rejected</option>
              <option value="Overdue" className="bg-[#1e2640] text-slate-100">Overdue</option>
            </select>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-[#1e2640] text-slate-100">All Priorities</option>
              <option value="Low" className="bg-[#1e2640] text-slate-100">Low</option>
              <option value="Medium" className="bg-[#1e2640] text-slate-100">Medium</option>
              <option value="High" className="bg-[#1e2640] text-slate-100">High</option>
              <option value="Urgent" className="bg-[#1e2640] text-slate-100">Urgent</option>
            </select>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-[#1e2640] text-slate-100">All Dates</option>
              <option value="today" className="bg-[#1e2640] text-slate-100">Due Today</option>
              <option value="upcoming" className="bg-[#1e2640] text-slate-100">Upcoming</option>
              <option value="overdue" className="bg-[#1e2640] text-slate-100">Overdue Only</option>
            </select>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
            >
              <option value="dueDate:asc" className="bg-[#1e2640] text-slate-100">Due Date: Soonest</option>
              <option value="dueDate:desc" className="bg-[#1e2640] text-slate-100">Due Date: Farthest</option>
              <option value="priority:desc" className="bg-[#1e2640] text-slate-100">Priority: High to Low</option>
              <option value="createdAt:desc" className="bg-[#1e2640] text-slate-100">Created Date: Newest</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setPriorityFilter('');
              setDateFilter('');
              setAssigneeFilter('');
              setSortBy('dueDate:asc');
            }}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-auto"
            title="Reset Filters"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>


      {/* Bulk Assign Action Bar */}
      {canManage && selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-[#1e2640] border border-[#dc9750]/30 rounded-xl px-4 py-2.5 mb-4 shadow-lg">
          <span className="text-sm font-medium text-slate-200">
            <span className="text-[#dc9750] font-bold">{selectedTaskIds.length}</span> task{selectedTaskIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkAssignOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#dc9750] hover:bg-[#dc9750]/80 text-[#1e2640] text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
            >
              <UserPlus size={14} /> Assign to Member
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Task Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-[#dc9750] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[#1e2640] border border-slate-700/60 rounded-xl text-center shadow-sm">
          <AlertCircle size={48} className="text-slate-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-100">No Tasks Found</h3>
          <p className="text-sm text-slate-400 mt-1">
            Try adjusting your search criteria or clear filters.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={tasks}
          user={user}
          token={token}
          navigate={navigate}
          showToast={setToastMsg}
          refreshTasks={fetchTasks}
        />
      ) : viewMode === 'calendar' ? (
        <CalendarView tasks={tasks} navigate={navigate} />
      ) : viewMode === 'gantt' ? (
        <GanttChart tasks={tasks} navigate={navigate} />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map((task) => {
            const daysLeft = Math.round((new Date(task.dueDate) - new Date()) / (24 * 60 * 60 * 1000));
            const isOverdue = task.status === 'Overdue' || (daysLeft < 0 && task.status !== 'Approved');

            return (
              <div
                key={task._id}
                onClick={() => navigate(`/tasks/${task._id}`)}
                className={`group relative bg-[#1e2640] border border-slate-700/60 hover:border-[#dc9750] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${isOverdue ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-[#dc9750]'
                  }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-2 min-w-0">
                    {canManage && (
                      <button
                        onClick={(e) => toggleTaskSelected(task._id, e)}
                        className="shrink-0 text-slate-400 hover:text-[#dc9750] transition-colors"
                        title={selectedTaskIds.includes(task._id) ? 'Deselect task' : 'Select task'}
                      >
                        {selectedTaskIds.includes(task._id) ? (
                          <CheckSquare size={16} className="text-[#dc9750]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    )}
                    <span className="text-[11px] font-semibold text-[#dc9750] truncate uppercase tracking-wide">
                      {task.assignedTo?.length > 0
                        ? task.assignedTo.map((u) => u.name).join(', ')
                        : 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-base text-slate-100 group-hover:text-[#dc9750] transition-colors line-clamp-1">
                      {task.title}
                    </h3>
                    {canManage && (
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-xs p-0.5 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => openEditModal(task, e)}
                          className="p-1.5 text-slate-400 hover:text-[#dc9750] rounded-md hover:bg-slate-800 transition-colors shadow-xs"
                          title="Edit Task"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => confirmDelete(task._id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
                          title="Delete Task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                  </div>

                  {task.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {task.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-md bg-slate-900/60 text-slate-300 border border-slate-700/40 text-[11px] font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 line-clamp-2 mb-5 leading-relaxed">
                    {task.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-slate-700/60 flex items-center justify-between mt-auto">
                  <div
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md ${isOverdue
                      ? 'bg-rose-950/50 text-rose-400 border border-rose-800/50 font-semibold animate-pulse'
                      : 'bg-slate-900/60 text-slate-300 border border-slate-700/50 font-medium'
                      }`}
                  >
                    <Calendar size={13} />
                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center">
                    <div className="flex -space-x-2 overflow-hidden">
                      {task.assignedTo.slice(0, 3).map((u) => (
                        <div
                          key={u._id}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#dc9750] text-[#1e2640] text-[11px] font-bold border-2 border-[#1e2640] shadow-md"
                          title={`${u.name} (${u.email})`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {task.assignedTo.length > 3 && (
                      <span className="ml-1.5 text-[10px] font-semibold text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700/60">
                        +{task.assignedTo.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-[#1e2640] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {canManage && <th className="py-3.5 px-4 w-8"></th>}
                  <th className="py-3.5 px-4">Task</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Assignees</th>
                  {canManage && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-xs sm:text-sm">
                {tasks.map((task) => (
                  <tr
                    key={task._id}
                    onClick={() => navigate(`/tasks/${task._id}`)}
                    className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                  >
                    {canManage && (
                      <td className="py-3.5 px-4" onClick={(e) => toggleTaskSelected(task._id, e)}>
                        {selectedTaskIds.includes(task._id) ? (
                          <CheckSquare size={16} className="text-[#dc9750]" />
                        ) : (
                          <Square size={16} className="text-slate-500" />
                        )}
                      </td>
                    )}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-semibold text-slate-100 group-hover:text-[#dc9750] transition-colors truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-[#dc9750]">
                      {task.assignedTo?.length > 0
                        ? task.assignedTo.map((u) => u.name).join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(task.status)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getPriorityBadge(task.priority)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {task.assignedTo.map((u) => (
                          <div
                            key={u._id}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#dc9750] text-[#1e2640] text-[10px] font-bold border-2 border-[#1e2640]"
                            title={u.name}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={(e) => openEditModal(task, e)}
                            className="p-1.5 text-slate-400 hover:text-[#dc9750] rounded-md hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => confirmDelete(task._id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL (Dark Theme Only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl lg:max-w-5xl w-full p-6 shadow-xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-100">
                {modalMode === 'create' ? 'Create New Task' : 'Edit Task Details'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Alert */}
            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-400 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Content */}
            <form onSubmit={handleFormSubmit} className="mt-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Task Title *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 transition-all"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g., Update Landing Page Header"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 transition-all resize-none"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Provide scope, targets, and notes..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Priority
                        </label>
                        <select
                          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                          value={formPriority}
                          onChange={(e) => setFormPriority(e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Status
                        </label>
                        <select
                          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="In Review">In Review</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Start Date
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 color-scheme-dark"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Due Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 color-scheme-dark"
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                        value={formEstimatedHours}
                        onChange={(e) => setFormEstimatedHours(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Assign Team Members *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-slate-700 rounded-lg bg-slate-800/20">
                        {usersList.map((member) => {
                          const isSelected = formAssignedTo.includes(member._id);
                          return (
                            <div
                              key={member._id}
                              onClick={() => toggleAssignee(member._id)}
                              className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${isSelected
                                ? 'bg-[#dc9750]/20 border-[#dc9750]'
                                : 'border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected
                                  ? 'bg-[#dc9750] text-white'
                                  : 'bg-slate-700 text-slate-300'
                                  }`}
                              >
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-slate-200 truncate">
                                  {member.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Attachments (URLs)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="flex-1 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                          placeholder="https://..."
                          value={formAttachment}
                          onChange={(e) => setFormAttachment(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleAddAttachment}
                          className="px-3 py-2 text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {formAttachmentsList.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto">
                          {formAttachmentsList.map((url, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300"
                            >
                              <Paperclip size={12} />
                              <span className="max-w-[150px] truncate">{url}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(index)}
                                className="hover:text-rose-400 font-bold ml-1 transition-colors"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Tags
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formTagInput}
                          placeholder="e.g., frontend"
                          onChange={(e) => setFormTagInput(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-3 py-2 text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {formTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formTags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/50 border border-indigo-800 text-indigo-300 text-xs"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(index)}
                                className="hover:text-rose-400 font-bold transition-colors"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtasks & Dependencies */}
                <div className="space-y-6 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Subtasks / Checklist
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formChecklistInput}
                        onChange={(e) => setFormChecklistInput(e.target.value)}
                        placeholder="e.g., Write unit tests"
                        className="flex-1 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="px-3 py-2 text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {formChecklist.length > 0 && (
                      <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                        {formChecklist.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-lg border border-slate-700 p-2 text-xs bg-slate-800/30"
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => toggleChecklistItem(index)}
                                className="rounded border-slate-600 bg-slate-800 text-[#dc9750] focus:ring-[#dc9750]"
                              />
                              <span className={item.completed ? 'line-through text-slate-500' : 'text-slate-300'}>
                                {item.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index)}
                              className="text-rose-400 hover:text-rose-300 font-bold transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Task Dependencies (must be completed first)
                    </label>
                    <select
                      multiple
                      value={formDependencies}
                      onChange={(e) => {
                        const values = [...e.target.selectedOptions].map((option) => option.value);
                        setFormDependencies(values);
                      }}
                      className="w-full rounded-lg border border-slate-700 p-2 text-sm bg-slate-800/50 text-slate-100 outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 max-h-32"
                    >
                      {allTasks
                        .filter((task) => task._id !== currentTaskId)
                        .map((task) => (
                          <option key={task._id} value={task._id}>
                            {task.title}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Hold Ctrl (Cmd on Mac) to select multiple tasks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 mt-6 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#dc9750] hover:bg-[#b97737] text-white rounded-lg transition-colors shadow-sm"
                >
                  {modalMode === 'create' ? 'Create Task' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}











      {/* DELETE CONFIRMATION DIALOG (Dark Theme Only) */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 text-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-950/50 text-rose-500 border border-rose-800/50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-100">Delete Task</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to permanently delete this task? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-sm"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN MODAL (Dark Theme Only) */}
      {isBulkAssignOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-indigo-950/50 text-indigo-400 border border-indigo-800/50 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-100 text-center">
              Assign {selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
              Choose a team member to assign to all selected tasks at once.
            </p>

            <select
              value={bulkAssignUserId}
              onChange={(e) => setBulkAssignUserId(e.target.value)}
              className="w-full mt-4 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
            >
              <option value="" className="bg-slate-900 text-slate-400">
                Select a team member...
              </option>
              {usersList.map((u) => (
                <option key={u._id} value={u._id} className="bg-slate-900 text-slate-100">
                  {u.name}{u.employeeId ? ` (${u.employeeId})` : ''}
                </option>
              ))}
            </select>

            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsBulkAssignOpen(false);
                  setBulkAssignUserId('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={!bulkAssignUserId || bulkAssignLoading}
                className="px-4 py-2 text-xs font-semibold bg-[#dc9750] hover:bg-[#b97737] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm"
              >
                {bulkAssignLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK CREATE MODAL (Dark Theme Only) */}
      {isBulkCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-100">
                Create Multiple Tasks for One Employee
              </h3>
              <button
                type="button"
                onClick={() => { setIsBulkCreateOpen(false); resetBulkCreate(); }}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {bulkCreateError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-400 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle size={16} />
                <span>{bulkCreateError}</span>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Employee *
                </label>
                <select
                  value={bulkCreateEmployeeId}
                  onChange={(e) => setBulkCreateEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    Select a team member...
                  </option>
                  {usersList.map((u) => (
                    <option key={u._id} value={u._id} className="bg-slate-900 text-slate-100">
                      {u.name}{u.employeeId ? ` (${u.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Tasks
                </label>
                <div className="space-y-3">
                  {bulkCreateTasks.map((row, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 border border-slate-700/80 rounded-lg bg-slate-800/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Task title"
                          value={row.title}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "title", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-slate-800/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                        />

                        <select
                          value={row.priority}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "priority", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-slate-800/80 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>

                        {/* STATUS DROPDOWN */}
                        <select
                          value={row.status}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "status", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-slate-800/80 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20"
                        >
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="In Review">In Review</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Completed (Pending Approval)">
                            Completed (Pending Approval)
                          </option>
                          <option value="Approved">Approved</option>
                        </select>

                        <input
                          type="datetime-local"
                          value={row.dueDate}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "dueDate", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-slate-800/80 border border-slate-700 text-slate-100 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 color-scheme-dark"
                        />

                        {bulkCreateTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBulkTaskRow(index)}
                            className="justify-self-end sm:justify-self-center p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors"
                            aria-label="Remove task row"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <textarea
                        value={row.description}
                        onChange={(e) => updateBulkTaskRow(index, 'description', e.target.value)}
                        placeholder="Task description..."
                        rows={2}
                        className="w-full px-3 py-2 text-slate-100 placeholder:text-slate-500 text-sm bg-slate-800/50 border border-slate-700 rounded-lg outline-none focus:border-[#dc9750]/60 focus:ring-2 focus:ring-[#dc9750]/20 resize-none"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addBulkTaskRow}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-950/40 border border-indigo-800/50 rounded-lg transition-colors"
                >
                  <Plus size={14} /> Add Another Task
                </button>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setIsBulkCreateOpen(false); resetBulkCreate(); }}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkCreateSubmit}
                disabled={bulkCreateLoading}
                className="px-4 py-2 text-xs font-semibold bg-[#dc9750] hover:bg-[#b97737] disabled:opacity-50 text-white rounded-lg transition-colors shadow-sm"
              >
                {bulkCreateLoading
                  ? 'Creating...'
                  : `Create ${validBulkCount > 0 ? validBulkCount : ''} Task${validBulkCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}



      <VoiceTaskModal
        open={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        token={token}
        onParsed={handleVoiceParsed}
      />
    </div>
  );
};

export default Tasks;