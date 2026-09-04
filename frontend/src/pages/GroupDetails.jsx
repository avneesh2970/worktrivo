import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE, useAuth } from "../context/AuthContext";
import KanbanBoard from "../components/KanbanBoard";
import { toast } from "react-hot-toast";
import {
  Users,
  Plus,
  Calendar,
  List,
  Kanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Edit3,
  Briefcase,
  UserPlus,
  Loader2,
  Sparkles,
  Send,
  AlignLeft,
  Flag,
  CheckSquare,
  ArrowLeft,
  FileText,
  MessageSquare,
  History
} from "lucide-react";
import FileUpload from "../components/FileUpload";
import FileList from "../components/FileList";

const GroupDetails = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [view, setView] = useState("list");

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);

  // File Refresh state
  const [refreshFiles, setRefreshFiles] = useState(false);

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
  });

  const [commentInput, setCommentInput] = useState("");

  const refreshTaskFiles = () => {
    setRefreshFiles(prev => !prev);
  };

  useEffect(() => {
    fetchGroup();
    fetchTasks();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setGroup(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups/${id}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = async () => {
    if (!selectedUser) {
      alert("Please select a user.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/groups/${id}/member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: selectedUser }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to add member.");

      setGroup(data);
      setSelectedUser("");
      setShowMemberModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const createTask = async () => {
    if (!taskForm.title || !taskForm.assignedTo || !taskForm.dueDate) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate,
          assignedTo: [taskForm.assignedTo],
          group: id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create task");

      await fetchTasks();
      setTaskForm({
        title: "",
        description: "",
        assignedTo: "",
        priority: "Medium",
        dueDate: "",
      });
      setShowTaskModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const updateTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${editingTask._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          dueDate: editForm.dueDate,
          assignedTo: [editForm.assignedTo],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchTasks();
      if (viewingTask && viewingTask._id === editingTask._id) {
        setViewingTask(data);
      }
      setShowEditModal(false);
      setEditingTask(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitTask = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Completed (Pending Approval)" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit task");

      if (typeof toast !== 'undefined' && toast.success) {
        toast.success("Task submitted for Admin approval!");
      } else {
        alert("Task submitted for Admin approval!");
      }

      await fetchTasks();
      if (viewingTask && viewingTask._id === taskId) {
        setViewingTask(data);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      assignedTo: task.assignedTo?.[0]?._id || task.assignedTo?.[0] || "",
      priority: task.priority || "Medium",
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : "",
    });
    setShowEditModal(true);
  };

  if (!group)
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-slate-500">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#10b981]" />
        <p className="text-sm font-medium">Loading project workspace...</p>
      </div>
    );

  const completedTasks = tasks.filter((task) => task.status === "Completed" || task.status === "Approved").length;
  const pendingTasks = tasks.filter((task) => task.status === "Pending" || task.status === "Completed (Pending Approval)").length;
  const inProgressTasks = tasks.filter((task) => task.status === "In Progress").length;
  const overdueTasks = tasks.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== "Completed" &&
      task.status !== "Approved"
  ).length;

  const progress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const getBadgeStyle = (type, value) => {
    if (type === 'status') {
      if (value === 'Approved' || value === 'Completed') return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
      if (value === 'Pending' || value === 'Completed (Pending Approval)') return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
      return "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30";
    }
    if (type === 'priority') {
      if (value === 'High' || value === 'Urgent') return "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30";
      if (value === 'Medium') return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
      return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
    }
    return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  };

  return (
    <div className="space-y-8 text-slate-800 dark:text-slate-100">
      {/* Top Header */}
      <div>
        <button
          onClick={() => navigate('/groups')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer shadow-xs mb-4"
        >
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </button>
      </div>

      {/* Group Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3.5 py-1 text-xs font-bold text-[#10b981]">
              <Briefcase className="h-3.5 w-3.5 text-[#10b981]" />
              <span>Workspace Project</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {group.name}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-normal">
              {group.description || "No description provided for this project."}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Team Members
              </p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {group.members?.length || 0}
              </h2>
            </div>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
              Overall Progress
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-wide">{progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Tasks", count: tasks.length, icon: List, color: "indigo" },
          { label: "Completed", count: completedTasks, icon: CheckCircle2, color: "emerald" },
          { label: "In Progress", count: inProgressTasks, icon: Clock, color: "amber" },
          { label: "Overdue", count: overdueTasks, icon: AlertTriangle, color: "rose" },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          const colorStyles = {
            indigo: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20",
            emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
            amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
            rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20",
          }[stat.color];

          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                <div className={`p-2 rounded-xl border ${colorStyles}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{stat.count}</p>
            </div>
          );
        })}
      </div>

      {/* Team Members Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Team Members</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {group.members?.length || 0} assigned member{group.members?.length === 1 ? "" : "s"} on this project
            </p>
          </div>
          <button
            onClick={() => setShowMemberModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-[#10b981] hover:bg-[#059669] shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Add Member
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {group.members?.length ? (
            group.members.map((member) => (
              <div
                key={member._id}
                className="group flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 transition-all"
              >
                {member.profilePhoto ? (
                  <img
                    src={member.profilePhoto}
                    alt={member.name}
                    className="h-11 w-11 rounded-xl object-cover ring-2 ring-[#10b981]/30 shadow-xs"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#10b981]/15 text-sm font-bold text-[#10b981] border border-[#10b981]/30">
                    {member.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {member.name}
                  </p>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{member.role || "Member"}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <p className="text-sm text-slate-500 font-medium">No members assigned to this group yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 p-1.5 border border-slate-200 dark:border-slate-800 w-fit">
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${view === "list"
                ? "text-slate-950 bg-[#10b981] shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              <List className="h-3.5 w-3.5" /> List View
            </button>

            <button
              onClick={() => setView("kanban")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${view === "kanban"
                ? "text-slate-950 bg-[#10b981] shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
            >
              <Kanban className="h-3.5 w-3.5" /> Kanban Board
            </button>
          </div>

          <button
            onClick={() => setShowTaskModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-[#10b981] hover:bg-[#059669] shadow-md shadow-[#10b981]/20 transition-all cursor-pointer w-fit"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>

        {view === "list" ? (
          tasks.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950/30">
              <p className="text-sm font-medium text-slate-500">No tasks created yet for this project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => setViewingTask(task)}
                  className="group relative cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 transition-all hover:border-[#10b981]/60 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-[#10b981] transition-colors">
                          {task.title}
                        </h3>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider border ${getBadgeStyle('status', task.status)}`}>
                          {task.status || "Pending"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl font-normal line-clamp-1">
                        {task.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 pt-3.5 border-t border-slate-200 dark:border-slate-800">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getBadgeStyle('priority', task.priority)}`}>
                      {task.priority} Priority
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                    </span>

                    {task.assignedTo?.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        {task.assignedTo.map((user) => user.name || "User").join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <KanbanBoard tasks={tasks} />
        )}
      </div>

      {/* VIEW MODAL */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-[1200px] h-[95vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden relative">

            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-4 shrink-0">
              <button
                onClick={() => setViewingTask(null)}
                className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Tasks
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    openEditModal(viewingTask);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" /> Edit
                </button>

                {viewingTask.status !== 'Completed (Pending Approval)' && viewingTask.status !== 'Approved' && (
                  <button
                    onClick={() => handleSubmitTask(viewingTask._id)}
                    className="flex items-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 px-4 py-1.5 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="h-4 w-4" /> Submit for Approval
                  </button>
                )}

                {viewingTask.status === 'Completed (Pending Approval)' && (
                  <span className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" /> Pending Approval
                  </span>
                )}
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              <div className="flex flex-col lg:flex-row gap-6">

                {/* LEFT COLUMN: Main Info */}
                <div className="flex-1 flex flex-col gap-6">

                  {/* Card 1: Details & Attachments */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                      {viewingTask.title}
                    </h1>

                    <div className="flex items-center gap-3 mb-8">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${getBadgeStyle('status', viewingTask.status)}`}>
                        {viewingTask.status || "Pending"}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${getBadgeStyle('priority', viewingTask.priority)}`}>
                        {viewingTask.priority} Priority
                      </span>
                    </div>

                    <div className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Description</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-normal">
                        {viewingTask.description || "No description provided."}
                      </p>
                    </div>

                    {/* Integrated Upload UI Component */}
                    <div className="mb-8 space-y-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Attachments
                      </h4>

                      <FileUpload
                        taskId={viewingTask._id}
                        onUpload={refreshTaskFiles}
                      />

                      <FileList
                        taskId={viewingTask._id}
                        refresh={refreshFiles}
                        onDelete={refreshTaskFiles}
                      />
                    </div>

                    {/* Footer Metadata */}
                    <div className="flex flex-col sm:flex-row gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Due Date</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {viewingTask.dueDate ? new Date(viewingTask.dueDate).toLocaleString() : "Not Set"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Created By</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {viewingTask.createdBy?.name || "System"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Assigned Team Members</p>
                      <div className="flex flex-wrap gap-2">
                        {viewingTask.assignedTo?.length > 0 ? (
                          viewingTask.assignedTo.map((u) => (
                            <div key={u._id} className="flex items-center gap-2 rounded-xl border border-[#10b981]/30 bg-[#10b981]/15 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10b981] text-slate-950 text-[10px] font-bold">
                                {u.name?.charAt(0)}
                              </div>
                              {u.name}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 font-medium">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Discussion Box */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <MessageSquare className="h-5 w-5 text-[#10b981]" />
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Discussion ({(viewingTask.comments || []).length})</h3>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8 pb-12 flex flex-col items-center text-center">
                      <p className="text-sm font-medium text-slate-500">No comments yet. Start the conversation!</p>
                    </div>

                    <div className="flex items-center gap-2 mt-4 relative">
                      <input
                        type="text"
                        placeholder="Type your message here..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] focus:outline-none"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                      />

                      <button className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 font-bold text-slate-950 hover:bg-[#059669] transition-colors text-sm shadow-xs cursor-pointer">
                        Post <Send className="h-3.5 w-3.5 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Audit Trail */}
                <div className="w-full lg:w-[400px] shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <History className="h-5 w-5 text-[#10b981]" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Audit Trail / History</h3>
                  </div>

                  <div className="relative pl-3 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                    {(viewingTask.history?.length > 0 ? viewingTask.history : [{
                      user: viewingTask.createdBy?.name || 'System',
                      date: new Date().toLocaleString(),
                      action: 'Status Changed',
                      from: 'Pending',
                      to: viewingTask.status || 'Approved'
                    }]).map((log, idx) => (
                      <div key={idx} className="relative pl-6">
                        <div className="absolute left-[-2px] top-1.5 h-2 w-2 rounded-full bg-[#10b981] ring-4 ring-white dark:ring-slate-900"></div>

                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                          <span className="text-slate-900 dark:text-white">{log.user}</span>
                          <span>•</span>
                          <span>{log.date}</span>
                        </div>

                        <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">{log.action}</p>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <span className="w-10">From:</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold line-through">{log.from}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-10">To:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{log.to}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add Team Member</h2>
              <button
                onClick={() => {
                  setShowMemberModal(false);
                  setSelectedUser("");
                }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Select User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
              >
                <option value="">Choose team member...</option>
                {users
                  .filter(
                    (user) =>
                      !group.members?.some((member) => member._id === user._id)
                  )
                  .map((user) => (
                    <option key={user._id} value={user._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {user.name} ({user.role || "Member"})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowMemberModal(false);
                  setSelectedUser("");
                }}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={addMember}
                className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-950 bg-[#10b981] hover:bg-[#059669] shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Create New Task</h2>
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Design System Updates"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Add context or details..."
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assign Member
                  </label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, assignedTo: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-500">Select Assignee</option>
                    {group.members?.map((member) => (
                      <option key={member._id} value={member._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, priority: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={createTask}
                className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Edit Task</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows="3"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all resize-none"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) =>
                      setEditForm({ ...editForm, assignedTo: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                  >
                    {group.members?.map((member) => (
                      <option key={member._id} value={member._id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm({ ...editForm, priority: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white focus:border-[#10b981] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={updateTask}
                className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;