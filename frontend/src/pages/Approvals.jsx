import React, { useState, useEffect } from 'react';
import { API_BASE, useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { 
    Search, CheckCircle, XCircle, ChevronLeft, ChevronRight, Folder, 
    LayoutList, AlignLeft, Flag, Users, Calendar, X, MessageSquare, 
    Send, FileText, History, CheckSquare, Loader2
} from 'lucide-react';

import FileList from '../components/FileList';

// --- FIXED HELPER: Replaces Windows backslashes ---
const getFileUrl = (path) => {
    if (!path) return '#';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const normalizedPath = path.replace(/\\/g, '/');
    const baseUrl = API_BASE.replace(/\/api$/, '');
    return normalizedPath.startsWith('/') ? `${baseUrl}${normalizedPath}` : `${baseUrl}/${normalizedPath}`;
};

const Approvals = () => {
    const { token, user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('tasks');
    
    // List States
    const [standaloneTasks, setStandaloneTasks] = useState([]); 
    const [projectTasks, setProjectTasks] = useState([]);       
    const [projects, setProjects] = useState([]);               
    const [dailyReports, setDailyReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination & Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Detailed Review Modal States
    const [viewingItem, setViewingItem] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [itemDetails, setItemDetails] = useState(null);
    const [itemComments, setItemComments] = useState([]);
    const [itemHistory, setItemHistory] = useState([]);
    
    // Action States
    const [feedback, setFeedback] = useState('');
    const [commentInput, setCommentInput] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
        if (socket) {
            socket.on('taskUpdated', fetchTasks);
            socket.on('projectUpdated', fetchProjects);
            socket.on('dailyReportUpdated', fetchDailyReports);
        }
        return () => {
            if (socket) {
                socket.off('taskUpdated', fetchTasks);
                socket.off('projectUpdated', fetchProjects);
                socket.off('dailyReportUpdated', fetchDailyReports);
            }
        };
    }, [socket, token]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchTasks(), fetchProjects(), fetchDailyReports()]);
        setLoading(false);
    };

    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API_BASE}/tasks?status=${encodeURIComponent('Completed (Pending Approval)')}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const allTasks = Array.isArray(data) ? data : [];
            
            setStandaloneTasks(allTasks.filter(t => !t.group).map(t => ({...t, _itemType: 'task'})));
            setProjectTasks(allTasks.filter(t => t.group).map(t => ({...t, _itemType: 'projectTask'})));
        } catch (error) {
            toast.error("Failed to load pending tasks");
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${API_BASE}/groups?approvalStatus=Pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setProjects((Array.isArray(data) ? data : []).map(p => ({...p, _itemType: 'project'})));
        } catch (error) {
            toast.error("Failed to load pending projects");
        }
    };

    const fetchDailyReports = async () => {
        try {
            const res = await fetch(`${API_BASE}/daily-reports?status=Pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setDailyReports((Array.isArray(data) ? data : []).map(r => ({...r, _itemType: 'dailyReport'})));
        } catch (error) {
            toast.error("Failed to load pending daily reports");
        }
    };

    // --- FETCH DEEP DETAILS FOR MODAL ---
    const handleViewItem = async (item) => {
        setViewingItem(item);
        setFeedback('');
        setCommentInput('');
        setLoadingDetails(true);

        if (item._itemType === 'task' || item._itemType === 'projectTask') {
            try {
                const [taskRes, commentsRes, historyRes] = await Promise.all([
                    fetch(`${API_BASE}/tasks/${item._id}`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/tasks/${item._id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/tasks/${item._id}/history`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                
                if (taskRes.ok) setItemDetails(await taskRes.json());
                if (commentsRes.ok) setItemComments(await commentsRes.json());
                if (historyRes.ok) setItemHistory(await historyRes.json());
            } catch (err) {
                toast.error("Failed to load task details.");
            }
        } else {
            setItemDetails(item);
            setItemComments([]);
            setItemHistory([]);
        }
        setLoadingDetails(false);
    };

    // --- APPROVE / REJECT LOGIC (Instant Optimistic UI) ---
    const handleProcessApproval = async (actionType) => {
        const isApprove = actionType === 'approve';
        
        if (!isApprove && !feedback.trim()) {
            toast.error("Please provide a decision note/feedback for rejection.");
            return;
        }

        const item = viewingItem;
        const feedbackValue = feedback.trim();
        const itemId = item._id;
        const itemType = item._itemType;

        // Instant UI dismissal & optimistic removal
        setViewingItem(null);
        setItemDetails(null);
        toast.success(`${itemType === 'dailyReport' ? 'Daily report' : itemType === 'project' ? 'Project' : 'Task'} successfully ${isApprove ? 'approved' : 'rejected'}`);

        if (itemType === 'task') {
            setStandaloneTasks(prev => prev.filter(t => t._id !== itemId));
        } else if (itemType === 'projectTask') {
            setProjectTasks(prev => prev.filter(t => t._id !== itemId));
        } else if (itemType === 'project') {
            setProjects(prev => prev.filter(p => p._id !== itemId));
        } else if (itemType === 'dailyReport') {
            setDailyReports(prev => prev.filter(r => r._id !== itemId));
        }
        
        try {
            if (itemType === 'task' || itemType === 'projectTask') {
                const res = await fetch(`${API_BASE}/tasks/${itemId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ 
                        status: isApprove ? 'Approved' : 'Rejected',
                        feedback: feedbackValue
                    })
                });
                if (!res.ok) throw new Error("Failed to process task");
            } 
            else if (itemType === 'project') {
                const endpoint = isApprove ? 'approve' : 'reject';
                const res = await fetch(`${API_BASE}/groups/${itemId}/${endpoint}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to process project");
            }
            else if (itemType === 'dailyReport') {
                const res = await fetch(`${API_BASE}/daily-reports/${itemId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        status: isApprove ? 'Approved' : 'Rejected',
                        feedback: feedbackValue
                    })
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Failed to process daily report");
                }
            }
        } catch (error) {
            toast.error(error.message);
            fetchData(); // revert on failure
        }
    };

    // --- POST COMMENT LOGIC ---
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentInput.trim() || !itemDetails) return;

        setCommentSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/tasks/${itemDetails._id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: commentInput.trim() })
            });

            if (res.ok) {
                setCommentInput('');
                const commentsRes = await fetch(`${API_BASE}/tasks/${itemDetails._id}/comments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (commentsRes.ok) setItemComments(await commentsRes.json());
            } else {
                toast.error('Failed to post comment.');
            }
        } catch (err) {
            toast.error('Error posting comment.');
        } finally {
            setCommentSubmitting(false);
        }
    };

    const getFilteredItems = () => {
        if (activeTab === 'tasks') {
            return standaloneTasks.filter(item => {
                const titleMatch = (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                const priorityMatch = priorityFilter === '' || item.priority === priorityFilter;
                return titleMatch && priorityMatch;
            });
        } else if (activeTab === 'projects') {
            const combined = [...projects, ...projectTasks];
            return combined.filter(item => {
                const titleMatch = (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                const priorityMatch = priorityFilter === '' || (item._itemType === 'projectTask' ? item.priority === priorityFilter : true);
                return titleMatch && priorityMatch;
            });
        } else if (activeTab === 'dailyReports') {
            return dailyReports.filter(item => {
                const authorMatch = (item.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                const workMatch = (item.todayWork || '').toLowerCase().includes(searchQuery.toLowerCase());
                const deptMatch = (item.department || '').toLowerCase().includes(searchQuery.toLowerCase());
                return authorMatch || workMatch || deptMatch;
            });
        }
        return [];
    };

    const filteredItems = getFilteredItems();
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getPriorityBadge = (priority) => {
        const styles = {
            High: 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10',
            Urgent: 'border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/15',
            Medium: 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10',
            Low: 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[priority] || 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {priority} Priority
            </span>
        );
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Approved': 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
            'Completed': 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
            'Pending': 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10',
            'Completed (Pending Approval)': 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10',
        };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-500/10'}`}>
                {status || "Pending"}
            </span>
        );
    };

    return (
        <div className="space-y-6 text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Approval <span className="text-[#10b981]">Center</span>
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Review and manage pending tasks, projects, and daily reports.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search submissions..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full sm:w-64 py-2.5 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] outline-none transition-all text-sm shadow-sm"
                        />
                    </div>
                    <select
                        value={priorityFilter}
                        onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                        className="py-2.5 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-[#10b981] text-sm shadow-sm"
                    >
                        <option value="">All Priorities</option>
                        <option value="High">High Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="Low">Low Priority</option>
                    </select>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
                <button
                    onClick={() => { setActiveTab('tasks'); setCurrentPage(1); }}
                    className={`pb-3 px-5 text-sm font-semibold transition-colors cursor-pointer ${
                        activeTab === 'tasks' ? 'text-[#10b981] border-b-2 border-[#10b981]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    Standalone Tasks ({standaloneTasks.length})
                </button>
                <button
                    onClick={() => { setActiveTab('projects'); setCurrentPage(1); }}
                    className={`pb-3 px-5 text-sm font-semibold transition-colors cursor-pointer ${
                        activeTab === 'projects' ? 'text-[#10b981] border-b-2 border-[#10b981]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    Project Approvals ({projects.length + projectTasks.length})
                </button>
                <button
                    onClick={() => { setActiveTab('dailyReports'); setCurrentPage(1); }}
                    className={`pb-3 px-5 text-sm font-semibold transition-colors cursor-pointer ${
                        activeTab === 'dailyReports' ? 'text-[#10b981] border-b-2 border-[#10b981]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    Daily Reports ({dailyReports.length})
                </button>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex justify-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Loader2 className="h-10 w-10 text-[#10b981] animate-spin" />
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30">
                    <CheckCircle className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">No pending items in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {paginatedItems.map(item => (
                        <div 
                            key={item._id} 
                            onClick={() => handleViewItem(item)}
                            className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-[#10b981]/50 hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex items-center gap-2 max-w-[70%]">
                                        {activeTab === 'projects' ? (
                                            item._itemType === 'project' ? 
                                            <Folder size={18} className="text-[#10b981] shrink-0" /> : 
                                            <LayoutList size={18} className="text-sky-500 shrink-0" />
                                        ) : activeTab === 'dailyReports' ? (
                                            <FileText size={18} className="text-[#10b981] shrink-0" />
                                        ) : null}
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-[#10b981] transition-colors">
                                            {item._itemType === 'dailyReport'
                                                ? `Daily Report: ${item.user?.name || 'Member'}`
                                                : (item.title || item.name)}
                                        </h3>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold whitespace-nowrap uppercase tracking-wider">
                                        {item._itemType === 'project' ? 'Project' : item._itemType === 'dailyReport' ? 'Daily Report' : 'Task'}
                                    </span>
                                </div>
                                
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-5 leading-relaxed font-normal">
                                    {item._itemType === 'dailyReport' ? item.todayWork : (item.description || "No description provided.")}
                                </p>
                                
                                <div className="grid grid-cols-2 gap-y-4 text-sm mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 mb-1">Submitted By</span>
                                        <span className="text-slate-900 dark:text-white font-semibold truncate">
                                            {item.user?.name || item.createdBy?.name || item.assignedTo?.[0]?.name || 'System'}
                                        </span>
                                    </div>
                                    
                                    {item._itemType === 'dailyReport' ? (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 mb-1">Department / Date</span>
                                            <span className="text-[#10b981] font-semibold truncate">
                                                {item.department || 'General'} • {new Date(item.reportDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ) : item._itemType !== 'project' && activeTab === 'projects' ? (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 mb-1">From Project</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate">Project Task</span>
                                        </div>
                                    ) : (activeTab === 'tasks' || item._itemType === 'projectTask') ? (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 mb-1">Priority</span>
                                            <span className={`font-bold ${item.priority === 'High' || item.priority === 'Urgent' ? 'text-rose-600 dark:text-rose-400' : item.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button className="w-full flex items-center justify-center gap-2 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981] hover:text-slate-950 py-2.5 rounded-xl transition-all font-bold text-sm cursor-pointer">
                                    <MessageSquare size={16} />
                                    Review & Action
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Page <span className="text-slate-900 dark:text-white font-bold">{currentPage}</span> of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* =========================================================
                FULL-FEATURED REVIEW REQUEST MODAL
            ========================================================= */}
            {viewingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    
                    {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
                            <Loader2 className="h-12 w-12 text-[#10b981] animate-spin mb-4" />
                            <p className="text-slate-700 dark:text-slate-300 font-medium">Loading submission details...</p>
                        </div>
                    ) : itemDetails && (
                        <div className="w-full max-w-[1200px] h-[95vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden relative">
                            
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center h-10 w-10 rounded-xl border border-[#10b981]/30 bg-[#10b981]/15 text-[#10b981]">
                                        <CheckSquare size={20} />
                                    </span>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Review Request</h2>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium tracking-wide mt-0.5">
                                            Submitted by <span className="text-slate-900 dark:text-white font-bold">{itemDetails.createdBy?.name || itemDetails.assignedTo?.[0]?.name || 'System'}</span>
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setViewingItem(null); setItemDetails(null); }} 
                                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Modal Body (2 Columns) */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                <div className="flex flex-col lg:flex-row gap-6">
                                    
                                    {/* --- LEFT COLUMN: DETAILS & DISCUSSION --- */}
                                    <div className="flex-1 flex flex-col gap-6">
                                        
                                        {/* Details Card */}
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
                                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                                                {viewingItem._itemType === 'dailyReport'
                                                    ? `Daily Report: ${itemDetails.user?.name || 'Team Member'}`
                                                    : (itemDetails.title || itemDetails.name)}
                                            </h1>
                                            
                                            <div className="flex items-center gap-3 mb-8">
                                                {getStatusBadge(itemDetails.status || itemDetails.approvalStatus)}
                                                {viewingItem._itemType !== 'project' && viewingItem._itemType !== 'dailyReport' && getPriorityBadge(itemDetails.priority)}
                                            </div>

                                            {viewingItem._itemType === 'dailyReport' ? (
                                                <div className="space-y-6 mb-8">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                            <AlignLeft className="h-3.5 w-3.5 text-[#10b981]" /> Today's Accomplishments
                                                        </p>
                                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                            {itemDetails.todayWork || "No details provided."}
                                                        </div>
                                                    </div>

                                                    {itemDetails.tomorrowPlan && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                                <FileText className="h-3.5 w-3.5 text-sky-500" /> Plans for Tomorrow
                                                            </p>
                                                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                                {itemDetails.tomorrowPlan}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {itemDetails.blockers && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-2">
                                                                <Flag className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> Blockers / Roadblocks
                                                            </p>
                                                            <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200 whitespace-pre-wrap leading-relaxed font-medium">
                                                                {itemDetails.blockers}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                        <AlignLeft className="h-3.5 w-3.5" /> Description
                                                    </p>
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                        {itemDetails.description || "No additional description provided."}
                                                    </div>
                                                </div>
                                            )}

                                            {/* FileList Integration for Attachments */}
                                            {viewingItem._itemType === 'task' || viewingItem._itemType === 'projectTask' ? (
                                                <div className="mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" /> Attachments
                                                    </p>
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 min-h-[80px]">
                                                        <FileList taskId={itemDetails._id} />
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Metadata Footer */}
                                            <div className="flex flex-col sm:flex-row gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                                        <Calendar className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-500">Due Date</p>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                            {itemDetails.dueDate ? new Date(itemDetails.dueDate).toLocaleString() : "Not Set"}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-500">Assigned Members</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            {itemDetails.assignedTo?.length > 0 ? (
                                                                itemDetails.assignedTo.map((u) => (
                                                                    <div key={u._id} className="flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#10b981] text-slate-950 text-[8px] font-bold">
                                                                            {u.name?.charAt(0)}
                                                                        </div>
                                                                        {u.name}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-slate-500">Unassigned</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {itemDetails.approvedBy && (
                                                     <div className="flex items-center gap-3">
                                                         <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                             <CheckSquare className="h-4 w-4" />
                                                         </div>
                                                         <div>
                                                             <p className="text-[10px] uppercase font-bold text-slate-500">Approved By</p>
                                                             <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                                 {itemDetails.approvedBy.name} ({itemDetails.approvedBy.role || 'Manager'})
                                                             </p>
                                                         </div>
                                                     </div>
                                                 )}
                                            </div>
                                        </div>

                                        {/* Discussion Card (Only for tasks) */}
                                        {viewingItem._itemType !== 'project' && (
                                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
                                                <div className="flex items-center gap-2 mb-6">
                                                    <MessageSquare className="h-5 w-5 text-[#10b981]" />
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Discussion ({itemComments.length})</h3>
                                                </div>

                                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                                                    {itemComments.length === 0 ? (
                                                        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 pb-4 flex flex-col items-center text-center">
                                                            <p className="text-sm font-medium text-slate-500">No comments yet. Start the conversation!</p>
                                                        </div>
                                                    ) : (
                                                        itemComments.map(c => (
                                                            <div key={c._id} className="flex gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-[#10b981] text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-1">
                                                                    {c.userId?.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
                                                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                                                        <span className="font-bold text-slate-900 dark:text-white">{c.userId?.name}</span>
                                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 rounded">
                                                                            {c.userId?.role === 'admin' ? 'Manager' : 'Member'}
                                                                        </span>
                                                                        <span className="text-slate-500 ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{c.message}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <form onSubmit={handleAddComment} className="flex items-center gap-2 relative">
                                                    <input 
                                                        type="text"
                                                        placeholder="Type your message here..."
                                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] focus:outline-none pr-24"
                                                        value={commentInput}
                                                        onChange={(e) => setCommentInput(e.target.value)}
                                                    />
                                                     <button type="submit" disabled={!commentInput.trim() || commentSubmitting} className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 rounded-lg bg-[#10b981] px-4 font-bold text-slate-950 hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm cursor-pointer">
                                                        {commentSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Post <Send className="h-3.5 w-3.5 ml-0.5" /></>}
                                                     </button>
                                                </form>
                                            </div>
                                        )}
                                    </div>

                                    {/* --- RIGHT COLUMN: DECISION & AUDIT TRAIL --- */}
                                    <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-6">
                                        
                                        {/* Review Request Decision Box */}
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                <MessageSquare className="h-3.5 w-3.5" /> Decision Note / Feedback
                                            </p>
                                            <textarea
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                placeholder="Add notes for your decision (Required for rejection)..."
                                                className="w-full h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#10b981] outline-none resize-none transition-all mb-4"
                                            />
                                            
                                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                                <button
                                                    onClick={() => handleProcessApproval('reject')}
                                                    disabled={actionLoading}
                                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
                                                >
                                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                    <span>Reject Submission</span>
                                                </button>
                                                <button
                                                    onClick={() => handleProcessApproval('approve')}
                                                    disabled={actionLoading}
                                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#10b981] px-4 py-3 text-sm font-bold text-slate-950 hover:bg-[#059669] disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-[#10b981]/20"
                                                >
                                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                    <span>Approve Submission</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Audit Trail / History (Only for tasks) */}
                                        {viewingItem._itemType !== 'project' && (
                                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm flex-1 flex flex-col max-h-[500px]">
                                                <div className="flex items-center gap-2 mb-6">
                                                    <History className="h-5 w-5 text-[#10b981]" />
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Audit Trail / History</h3>
                                                </div>

                                                <div className="relative pl-3 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                                                    {(itemHistory.length > 0 ? itemHistory : [{
                                                        userId: { name: itemDetails.createdBy?.name || 'System' },
                                                        createdAt: new Date().toISOString(),
                                                        action: 'Task Initialized',
                                                        newValue: `Task initialized with status: ${itemDetails.status}`
                                                    }]).map((log, idx) => (
                                                        <div key={idx} className="relative pl-6">
                                                            <div className="absolute left-[-2px] top-1.5 h-2 w-2 rounded-full bg-[#10b981] ring-4 ring-white dark:ring-slate-900"></div>
                                                            
                                                            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                <span className="text-slate-900 dark:text-white">{log.userId?.name || 'System'}</span>
                                                                <span>•</span>
                                                                <span>{new Date(log.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white mb-2">{log.action}</p>
                                                            
                                                            {log.oldValue && log.newValue && (
                                                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs">
                                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                                                                        <span className="w-10">From:</span>
                                                                        <span className="text-rose-600 dark:text-rose-400 font-semibold line-through">{log.oldValue}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                                        <span className="w-10">To:</span>
                                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{log.newValue}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {!log.oldValue && log.newValue && (
                                                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2.5 text-xs text-slate-600 dark:text-slate-400">
                                                                    Info: <span className="text-slate-900 dark:text-white font-medium">{log.newValue}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Approvals;