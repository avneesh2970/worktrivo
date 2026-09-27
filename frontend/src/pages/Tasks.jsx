import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API_BASE } from '../context/AuthContext';
import {
  Plus, Search, Filter, RefreshCw, Edit2, Trash2, Calendar, AlertCircle,
  LayoutGrid, List, X, Paperclip, CheckCircle2, Loader2,
  KanbanSquare, CalendarDays, GanttChartSquare, Mic, UserPlus, CheckSquare, Square, Clock
} from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import CalendarView from '../components/CalendarView';
import GanttChart from '../components/GanttChart';
import VoiceTaskModal from '../components/VoiceTaskModal';
import { useSocket } from "../context/SocketContext";
import { useTaskTimer } from '../context/TaskTimerContext';

const Tasks = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeTimer, startTimer } = useTaskTimer();

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

  // Sync filters with URL
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
  const [supervisorsList, setSupervisorsList] = useState([]);
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
  const [formVerballyAssignedBy, setFormVerballyAssignedBy] = useState('');
  const [formIsSelfTask, setFormIsSelfTask] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Confirm Delete State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Lightweight built-in toast
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

      let taskList = Array.isArray(data) ? data : [];
      if (!statusFilter) {
        taskList = taskList.filter((t) => t.status !== 'Approved');
      }

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

  const fetchSupervisors = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/my-supervisors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSupervisorsList(data);
      }
    } catch (err) {
      console.error('Error fetching supervisors:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, priorityFilter, dateFilter, assigneeFilter, sortBy]);

  useEffect(() => {
    if (user && token) {
      fetchUsers();
      fetchSupervisors();
    }
  }, [user, token]);

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormPriority('Medium');
    setFormStatus('To Do');
    setFormStartDate('');
    setFormDueDate('');
    setFormEstimatedHours(0);
    setFormAssignedTo([]);
    setFormVerballyAssignedBy('');
    setFormIsSelfTask(false);
    setFormAttachment('');
    setFormAttachmentsList([]);
    setFormTags([]);
    setFormTagInput('');
    setFormChecklist([]);
    setFormChecklistInput('');
    setFormDependencies([]);
    setFormError('');
  };

  const openCreateModal = (isSelf = false) => {
    resetForm();
    setModalMode('create');
    const isMember = user?.role === 'member';
    if (isMember || isSelf === true) {
      setFormIsSelfTask(true);
      setFormAssignedTo([user._id]);
      const initialSupervisor = user?.manager
        ? (typeof user.manager === 'object' ? user.manager._id : user.manager)
        : (supervisorsList.length === 1 ? supervisorsList[0]._id : '');
      setFormVerballyAssignedBy(initialSupervisor || '');
    } else {
      setFormIsSelfTask(false);
      setFormAssignedTo([]);
      setFormVerballyAssignedBy('');
    }
    setIsModalOpen(true);
  };

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
    setFormAssignedTo(task.assignedTo.map(u => (u._id || u)));
    const isSelf = task.isSelfCreated || (task.assignedTo?.length === 1 && (task.assignedTo[0]._id || task.assignedTo[0]) === user?._id && task.verballyAssignedBy);
    setFormIsSelfTask(Boolean(isSelf));
    setFormVerballyAssignedBy(task.verballyAssignedBy?._id || task.verballyAssignedBy || '');
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

    const isMember = user?.role === 'member';
    const isSelf = isMember || formIsSelfTask;

    if (isSelf && !formVerballyAssignedBy) {
      return setFormError('Please select the Manager or Admin who verbally assigned this task to you.');
    }

    if (!isSelf && formAssignedTo.length === 0) {
      return setFormError('Please assign at least one team member');
    }

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      priority: formPriority,
      status: formStatus,
      startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
      dueDate: new Date(formDueDate).toISOString(),
      estimatedHours: Number(formEstimatedHours),
      assignedTo: isSelf ? [user._id] : formAssignedTo,
      isSelfCreated: isSelf,
      verballyAssignedBy: formVerballyAssignedBy || null,
      attachments: formAttachmentsList,
      tags: formTags,
      checklist: formChecklist,
      dependencies: formDependencies
    };

    setFormSubmitting(true);
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
        setToastMsg(
          modalMode === 'create'
            ? (isSelf ? 'Self-task created and supervisor notified!' : 'Task created successfully!')
            : 'Task updated successfully!'
        );
      } else {
        setFormError(data.error || 'Operation failed');
      }
    } catch (err) {
      setFormError('Network error. Failed to save task.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const confirmDelete = (taskId, e) => {
    e.stopPropagation();
    setDeleteTaskId(taskId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteTask = async () => {
    setDeleteLoading(true);
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
    } finally {
      setDeleteLoading(false);
    }
  };

  // Bulk assignment
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

  // Bulk create
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
      'To Do': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      'In Progress': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
      'In Review': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
      'Blocked': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
      'Completed (Pending Approval)': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
      'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
      'Rejected': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800',
      'Overdue': 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
    };

    const colorClass = statusMap[status] || 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      Low: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
      Medium: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
      High: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
      Urgent: 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${priorityMap[priority] || ''}`}>
        {priority} Priority
      </span>
    );
  };

  const canManage = ['admin', 'manager'].includes(user?.role);
  const validBulkCount = bulkCreateTasks.filter(t => t.title.trim() && t.dueDate).length;

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">

      {/* Inline toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 shadow-xl border border-slate-700 text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={16} className="text-[#10b981]" />
          {toastMsg}
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Workflow <span className="text-[#10b981]">Tasks</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
            Search, filter, and track tasks across team members.
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Mic size={16} className="text-[#10b981]" />
              <span>Voice Task</span>
            </button>
            <button
              onClick={() => { resetBulkCreate(); setIsBulkCreateOpen(true); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <UserPlus size={16} className="text-[#10b981]" />
              <span>Bulk Create</span>
            </button>
            <button
              onClick={() => openCreateModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Create a self-assigned task with verbal assignment"
            >
              <span>🗣️ Self Task</span>
            </button>
            <button
              onClick={() => openCreateModal(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#10b981]/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Task</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => openCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-slate-950 text-sm font-bold rounded-xl shadow-md shadow-[#10b981]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>Create Self Task</span>
          </button>
        )}
      </div>

      {/* Filter and View Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Row 1: Search + Assignee Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by task title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] transition-colors"
            />
          </div>

          {canManage && (
            <div className="relative flex-1 w-full">
              <UserPlus size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Filter by team member name or Employee ID..."
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] transition-colors"
              />
            </div>
          )}
        </div>

        {/* Row 2: View Switcher */}
        <div className="flex justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'grid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              title="List View"
            >
              <List size={15} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'kanban'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              title="Kanban Board"
            >
              <KanbanSquare size={15} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              title="Calendar View"
            >
              <CalendarDays size={15} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${viewMode === 'gantt'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              title="Gantt / Timeline View"
            >
              <GanttChartSquare size={15} />
              <span className="hidden sm:inline">Gantt</span>
            </button>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Statuses</option>
              <option value="To Do" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">To Do</option>
              <option value="In Progress" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">In Progress</option>
              <option value="In Review" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">In Review</option>
              <option value="Blocked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Blocked</option>
              <option value="Completed (Pending Approval)" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Pending Approval</option>
              <option value="Approved" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Approved</option>
              <option value="Rejected" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Rejected</option>
              <option value="Overdue" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Overdue</option>
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Priorities</option>
              <option value="Low" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Low</option>
              <option value="Medium" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Medium</option>
              <option value="High" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">High</option>
              <option value="Urgent" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Urgent</option>
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Dates</option>
              <option value="today" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Due Today</option>
              <option value="upcoming" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Upcoming</option>
              <option value="overdue" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Overdue Only</option>
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="dueDate:asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Due Date: Soonest</option>
              <option value="dueDate:desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Due Date: Farthest</option>
              <option value="priority:desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Priority: High to Low</option>
              <option value="createdAt:desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Created Date: Newest</option>
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
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors ml-auto cursor-pointer"
            title="Reset Filters"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Bulk Assign Action Bar */}
      {canManage && selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-[#10b981]/40 rounded-2xl px-4 py-3 shadow-md">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            <span className="text-[#10b981] font-bold">{selectedTaskIds.length}</span> task{selectedTaskIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkAssignOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <UserPlus size={14} /> Assign to Member
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Task Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-sm">
          <AlertCircle size={44} className="text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Tasks Found</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
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
                className={`group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#10b981] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isOverdue ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-[#10b981]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-2 min-w-0">
                    {canManage && (
                      <button
                        onClick={(e) => toggleTaskSelected(task._id, e)}
                        className="shrink-0 text-slate-400 hover:text-[#10b981] transition-colors"
                        title={selectedTaskIds.includes(task._id) ? 'Deselect task' : 'Select task'}
                      >
                        {selectedTaskIds.includes(task._id) ? (
                          <CheckSquare size={16} className="text-[#10b981]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    )}
                    <span className="text-[11px] font-bold text-[#10b981] truncate uppercase tracking-wider">
                      {task.assignedTo?.length > 0
                        ? task.assignedTo.map((u) => u.name).join(', ')
                        : 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-[#10b981] transition-colors line-clamp-1">
                      {task.title}
                    </h3>
                    {(canManage || (task.isSelfCreated && task.createdBy?._id === user?._id && task.status !== 'Approved')) && (
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => openEditModal(task, e)}
                          className="p-1.5 text-slate-500 hover:text-[#10b981] rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Edit Task"
                        >
                          <Edit2 size={13} />
                        </button>
                        {canManage && (
                          <button
                            onClick={(e) => confirmDelete(task._id, e)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getStatusBadge(task.status)}
                    {getPriorityBadge(task.priority)}
                    {task.verballyAssignedBy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                        <span>🗣️ Verbal: {task.verballyAssignedBy.name}</span>
                      </span>
                    )}
                  </div>

                  {task.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {task.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-5 leading-relaxed font-normal">
                    {task.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${isOverdue
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/50 font-semibold animate-pulse'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium'
                        }`}
                    >
                      <Calendar size={13} />
                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTimer(task);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTimer?.taskId === task._id
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-[#10b981] hover:bg-[#10b981]/15'
                      }`}
                      title={activeTimer?.taskId === task._id ? 'Timer is running' : 'Start work timer on this task'}
                    >
                      <Clock size={12} />
                      <span>{activeTimer?.taskId === task._id ? 'Tracking' : 'Timer'}</span>
                    </button>
                  </div>

                  <div className="flex items-center">
                    <div className="flex -space-x-2 overflow-hidden">
                      {task.assignedTo.slice(0, 3).map((u) => (
                        <div
                          key={u._id}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#10b981] text-slate-950 text-[11px] font-bold border-2 border-white dark:border-slate-900 shadow-xs"
                          title={`${u.name} (${u.email})`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {task.assignedTo.length > 3 && (
                      <span className="ml-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {tasks.map((task) => (
                  <tr
                    key={task._id}
                    onClick={() => navigate(`/tasks/${task._id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {canManage && (
                      <td className="py-3.5 px-4" onClick={(e) => toggleTaskSelected(task._id, e)}>
                        {selectedTaskIds.includes(task._id) ? (
                          <CheckSquare size={16} className="text-[#10b981]" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                      </td>
                    )}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-bold text-slate-900 dark:text-white group-hover:text-[#10b981] transition-colors truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.verballyAssignedBy && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                            🗣️ Verbal: {task.verballyAssignedBy.name}
                          </span>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.description}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs font-bold text-[#10b981]">
                      {task.assignedTo?.length > 0
                        ? task.assignedTo.map((u) => u.name).join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(task.status)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getPriorityBadge(task.priority)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {task.assignedTo.map((u) => (
                          <div
                            key={u._id}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#10b981] text-slate-950 text-[10px] font-bold border-2 border-white dark:border-slate-900"
                            title={u.name}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </td>
                    {(canManage || (task.isSelfCreated && task.createdBy?._id === user?._id && task.status !== 'Approved')) && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={(e) => openEditModal(task, e)}
                            className="p-1.5 text-slate-500 hover:text-[#10b981] rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Task"
                          >
                            <Edit2 size={14} />
                          </button>
                          {canManage && (
                            <button
                              onClick={(e) => confirmDelete(task._id, e)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl max-w-4xl lg:max-w-5xl w-full p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {modalMode === 'create'
                  ? (user?.role === 'member' ? 'Create Self Task (Verbal Assignment)' : 'Create New Task')
                  : (user?.role === 'member' ? 'Edit Self Task Details' : 'Edit Task Details')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Alert */}
            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0 font-medium">
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
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Task Title *
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981] transition-all"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g., Update Landing Page Header"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981] transition-all resize-none"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Provide scope, targets, and notes..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Priority
                        </label>
                        <select
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
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
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Status
                        </label>
                        <select
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
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
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Start Date
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Due Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                        value={formEstimatedHours}
                        onChange={(e) => setFormEstimatedHours(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4 flex flex-col justify-between">
                    {/* For Managers / Admins: Toggle between Team Assignment and Self-Task */}
                    {user?.role !== 'member' && (
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormIsSelfTask(false);
                            setFormAssignedTo([]);
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            !formIsSelfTask
                              ? 'bg-white dark:bg-slate-900 text-[#10b981] shadow-xs'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          👥 Assign to Team
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormIsSelfTask(true);
                            setFormAssignedTo([user._id]);
                            if (!formVerballyAssignedBy) {
                              const initialSupervisor = user?.manager
                                ? (typeof user.manager === 'object' ? user.manager._id : user.manager)
                                : (supervisorsList.length === 1 ? supervisorsList[0]._id : '');
                              setFormVerballyAssignedBy(initialSupervisor || '');
                            }
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            formIsSelfTask
                              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          🗣️ Self-Task (Verbal)
                        </button>
                      </div>
                    )}

                    {user?.role === 'member' || formIsSelfTask ? (
                      <div className="space-y-4">
                        {/* Self-Assignee Display */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Assigned To (Self Task)
                          </label>
                          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
                            <div className="w-9 h-9 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] flex items-center justify-center font-bold text-xs shrink-0">
                              {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name} (You)</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email} • {user?.department || 'General'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Mandatory Verbally Assigned By selector */}
                        <div>
                          <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center justify-between">
                            <span>Verbally Assigned By (Manager / Admin) *</span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Required</span>
                          </label>
                          <select
                            value={formVerballyAssignedBy}
                            onChange={(e) => setFormVerballyAssignedBy(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-amber-500/50 text-slate-900 dark:text-white rounded-xl outline-none focus:border-amber-500"
                          >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                              Select Manager or Admin who assigned this...
                            </option>
                            {(supervisorsList.length > 0
                              ? supervisorsList
                              : usersList.filter((u) => ['admin', 'manager'].includes(u.role))
                            ).map((mgr) => (
                              <option key={mgr._id} value={mgr._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                {mgr.name} ({mgr.role === 'admin' ? 'Administrator' : 'Manager'}{mgr.department ? ` - ${mgr.department}` : ''})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                            {supervisorsList.length > 0 && supervisorsList.some((s) => s.role === 'manager')
                              ? 'Assigned Manager(s) for your department/profile.'
                              : 'No direct manager assigned — system Administrators are displayed.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Assign Team Members *
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950">
                            {usersList.map((member) => {
                              const isSelected = formAssignedTo.includes(member._id);
                              return (
                                <div
                                  key={member._id}
                                  onClick={() => toggleAssignee(member._id)}
                                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                                    ? 'bg-[#10b981]/15 border-[#10b981]'
                                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900'
                                    }`}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected
                                      ? 'bg-[#10b981] text-slate-950'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                      }`}
                                  >
                                    {member.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {member.name} {member._id === user?._id ? '(You)' : ''}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>Verbally Assigned By (Optional)</span>
                            <span className="text-[10px] text-slate-500">Optional</span>
                          </label>
                          <select
                            value={formVerballyAssignedBy}
                            onChange={(e) => setFormVerballyAssignedBy(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                          >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                              None / Direct assignment
                            </option>
                            {usersList
                              .filter((u) => ['admin', 'manager'].includes(u.role))
                              .map((mgr) => (
                                <option key={mgr._id} value={mgr._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                  {mgr.name} ({mgr.role === 'admin' ? 'Administrator' : 'Manager'}{mgr.department ? ` - ${mgr.department}` : ''})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Attachments (URLs)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981]"
                          placeholder="https://..."
                          value={formAttachment}
                          onChange={(e) => setFormAttachment(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleAddAttachment}
                          className="px-4 py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {formAttachmentsList.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto">
                          {formAttachmentsList.map((url, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
                            >
                              <Paperclip size={12} />
                              <span className="max-w-[150px] truncate">{url}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(index)}
                                className="hover:text-rose-600 font-bold ml-1 transition-colors cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tags
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formTagInput}
                          placeholder="e.g., frontend"
                          onChange={(e) => setFormTagInput(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981]"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-4 py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {formTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formTags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold"
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(index)}
                                className="hover:text-rose-600 font-bold transition-colors cursor-pointer"
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
                <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subtasks / Checklist
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formChecklistInput}
                        onChange={(e) => setFormChecklistInput(e.target.value)}
                        placeholder="e.g., Write unit tests"
                        className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981]"
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="px-4 py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {formChecklist.length > 0 && (
                      <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
                        {formChecklist.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-xs bg-slate-50 dark:bg-slate-800/30"
                          >
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => toggleChecklistItem(index)}
                                className="rounded border-slate-300 text-[#10b981] focus:ring-[#10b981]"
                              />
                              <span className={item.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}>
                                {item.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index)}
                              className="text-rose-500 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Task Dependencies (must be completed first)
                    </label>
                    <select
                      multiple
                      value={formDependencies}
                      onChange={(e) => {
                        const values = [...e.target.selectedOptions].map((option) => option.value);
                        setFormDependencies(values);
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-[#10b981] max-h-32"
                    >
                      {allTasks
                        .filter((task) => task._id !== currentTaskId)
                        .map((task) => (
                          <option key={task._id} value={task._id}>
                            {task.title}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      Hold Ctrl (Cmd on Mac) to select multiple tasks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-slate-950 rounded-xl transition-colors shadow-md shadow-[#10b981]/20 cursor-pointer"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{modalMode === 'create' ? 'Creating...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{modalMode === 'create' ? 'Create Task' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-500 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Task</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium">
              Are you sure you want to permanently delete this task? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Task</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN MODAL */}
      {isBulkAssignOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-slate-800 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white text-center">
              Assign {selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center leading-relaxed font-medium">
              Choose a team member to assign to all selected tasks at once.
            </p>

            <select
              value={bulkAssignUserId}
              onChange={(e) => setBulkAssignUserId(e.target.value)}
              className="w-full mt-4 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
            >
              <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                Select a team member...
              </option>
              {usersList.map((u) => (
                <option key={u._id} value={u._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
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
                className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={!bulkAssignUserId || bulkAssignLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-slate-950 rounded-xl transition-colors shadow-md shadow-[#10b981]/20 cursor-pointer"
              >
                {bulkAssignLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Confirm Assignment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK CREATE MODAL */}
      {isBulkCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Multiple Tasks for One Employee
              </h3>
              <button
                type="button"
                onClick={() => { setIsBulkCreateOpen(false); resetBulkCreate(); }}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {bulkCreateError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0 font-medium">
                <AlertCircle size={16} />
                <span>{bulkCreateError}</span>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Employee *
                </label>
                <select
                  value={bulkCreateEmployeeId}
                  onChange={(e) => setBulkCreateEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-500">
                    Select a team member...
                  </option>
                  {usersList.map((u) => (
                    <option key={u._id} value={u._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {u.name}{u.employeeId ? ` (${u.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Tasks
                </label>
                <div className="space-y-3">
                  {bulkCreateTasks.map((row, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-950">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Task title"
                          value={row.title}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "title", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-[#10b981]"
                        />

                        <select
                          value={row.priority}
                          onChange={(e) =>
                            updateBulkTaskRow(index, "priority", e.target.value)
                          }
                          className="w-full min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
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
                          className="w-full min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
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
                          className="w-full min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-[#10b981]"
                        />

                        {bulkCreateTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBulkTaskRow(index)}
                            className="justify-self-end sm:justify-self-center p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                        className="w-full px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] resize-none"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addBulkTaskRow}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add Another Task
                </button>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setIsBulkCreateOpen(false); resetBulkCreate(); }}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkCreateSubmit}
                disabled={bulkCreateLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-slate-950 rounded-xl transition-colors shadow-md shadow-[#10b981]/20 cursor-pointer"
              >
                {bulkCreateLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>{`Create ${validBulkCount > 0 ? validBulkCount : ''} Task${validBulkCount === 1 ? '' : 's'}`}</span>
                )}
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