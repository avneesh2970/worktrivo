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
    
    // FIX: Convert Windows backslashes to forward slashes
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

    useEffect(() => {
        fetchData();
        if (socket) {
            socket.on('taskUpdated', fetchTasks);
            socket.on('projectUpdated', fetchProjects);
        }
        return () => {
            if (socket) {
                socket.off('taskUpdated', fetchTasks);
                socket.off('projectUpdated', fetchProjects);
            }
        };
    }, [socket, token]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchTasks(), fetchProjects()]);
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

    // --- APPROVE / REJECT LOGIC ---
    const handleProcessApproval = async (actionType) => {
        const isApprove = actionType === 'approve';
        
        if (!isApprove && !feedback.trim()) {
            toast.error("Please provide a decision note/feedback for rejection.");
            return;
        }
        
        try {
            if (viewingItem._itemType === 'task' || viewingItem._itemType === 'projectTask') {
                const res = await fetch(`${API_BASE}/tasks/${viewingItem._id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ 
                        status: isApprove ? 'Approved' : 'Rejected',
                        feedback: feedback.trim()
                    })
                });
                if (!res.ok) throw new Error("Failed to process task");
                toast.success(`Task successfully ${isApprove ? 'approved' : 'rejected'}`);
            } 
            else if (viewingItem._itemType === 'project') {
                const endpoint = isApprove ? 'approve' : 'reject';
                const res = await fetch(`${API_BASE}/groups/${viewingItem._id}/${endpoint}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to process project");
                toast.success(`Project successfully ${isApprove ? 'approved' : 'rejected'}`);
            }
            
            setViewingItem(null);
            setItemDetails(null);
            fetchData(); 
        } catch (error) {
            toast.error(error.message);
        }
    };

    // --- POST COMMENT LOGIC ---
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentInput.trim() || !itemDetails) return;

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
        }
    };

    const getFilteredItems = () => {
        if (activeTab === 'tasks') {
            return standaloneTasks.filter(item => {
                const titleMatch = (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                const priorityMatch = priorityFilter === '' || item.priority === priorityFilter;
                return titleMatch && priorityMatch;
            });
        } else {
            const combined = [...projects, ...projectTasks];
            return combined.filter(item => {
                const titleMatch = (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
                const priorityMatch = priorityFilter === '' || (item._itemType === 'projectTask' ? item.priority === priorityFilter : true);
                return titleMatch && priorityMatch;
            });
        }
    };

    const filteredItems = getFilteredItems();
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getPriorityBadge = (priority) => {
        const styles = {
            High: 'border-[#FF1744] text-[#FF1744]',
            Urgent: 'border-[#FF1744] text-[#FF1744]',
            Medium: 'border-[#FFC400] text-[#FFC400]',
            Low: 'border-[#00E676] text-[#00E676]',
        };
        return (
            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[priority] || 'border-slate-500 text-slate-500'}`}>
                {priority} Priority
            </span>
        );
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Approved': 'border-[#00E676] text-[#00E676]',
            'Completed': 'border-[#00E676] text-[#00E676]',
            'Pending': 'border-[#FFC400] text-[#FFC400]',
            'Completed (Pending Approval)': 'border-[#FFC400] text-[#FFC400]',
        };
        return (
            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'border-[#2979FF] text-[#2979FF]'}`}>
                {status || "Pending"}
            </span>
        );
    };

    return (
        <div className="p-6 h-full overflow-y-auto bg-[#0B101E] text-slate-100 selection:bg-indigo-500 selection:text-white relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Approval Center</h1>
                    <p className="text-sm text-slate-400 mt-1">Review and manage pending items.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full sm:w-64 py-2.5 pl-10 pr-4 rounded-xl border border-slate-700 bg-[#121826] text-white placeholder:text-slate-500 focus:border-[#dc9750] outline-none transition-all text-sm"
                        />
                    </div>
                    <select
                        value={priorityFilter}
                        onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                        className="py-2.5 pl-3 pr-8 rounded-xl border border-slate-700 bg-[#121826] text-white outline-none focus:border-[#dc9750] text-sm"
                    >
                        <option value="">All Priorities</option>
                        <option value="High">High Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="Low">Low Priority</option>
                    </select>
                </div>
            </div>

            <div className="flex border-b border-slate-800 mb-6">
                <button
                    onClick={() => { setActiveTab('tasks'); setCurrentPage(1); }}
                    className={`pb-3 px-6 text-sm font-semibold transition-colors ${
                        activeTab === 'tasks' ? 'text-[#dc9750] border-b-2 border-[#dc9750]' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Standalone Tasks ({standaloneTasks.length})
                </button>
                <button
                    onClick={() => { setActiveTab('projects'); setCurrentPage(1); }}
                    className={`pb-3 px-6 text-sm font-semibold transition-colors ${
                        activeTab === 'projects' ? 'text-[#dc9750] border-b-2 border-[#dc9750]' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Project Approvals ({projects.length + projectTasks.length})
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-10 w-10 text-[#dc9750] animate-spin" />
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-[#121826]/50">
                    <CheckCircle className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                    <h3 className="text-lg font-medium text-white">All Caught Up!</h3>
                    <p className="text-sm text-slate-400">No pending items in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {paginatedItems.map(item => (
                        <div 
                            key={item._id} 
                            onClick={() => handleViewItem(item)}
                            className="group cursor-pointer bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-[#dc9750]/50 hover:bg-[#121826]/80 hover:shadow-lg hover:shadow-[#dc9750]/5 transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 max-w-[70%]">
                                        {activeTab === 'projects' && (
                                            item._itemType === 'project' ? 
                                            <Folder size={16} className="text-[#dc9750] shrink-0" /> : 
                                            <LayoutList size={16} className="text-sky-400 shrink-0" />
                                        )}
                                        <h3 className="text-base font-bold text-white truncate group-hover:text-[#dc9750] transition-colors">
                                            {item.title || item.name}
                                        </h3>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold whitespace-nowrap uppercase tracking-wider">
                                        {item._itemType === 'project' ? 'Project' : 'Task'}
                                    </span>
                                </div>
                                
                                <p className="text-sm text-slate-400 line-clamp-2 mb-5 leading-relaxed font-medium">
                                    {item.description || "No description provided."}
                                </p>
                                
                                <div className="grid grid-cols-2 gap-y-4 text-sm mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Submitted By</span>
                                        <span className="text-white font-semibold truncate">{item.createdBy?.name || item.assignedTo?.[0]?.name || 'System'}</span>
                                    </div>
                                    
                                    {item._itemType !== 'project' && activeTab === 'projects' && (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">From Project</span>
                                            <span className="text-indigo-400 font-semibold truncate">Project Task</span>
                                        </div>
                                    )}

                                    {(activeTab === 'tasks' || item._itemType === 'projectTask') && (
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Priority</span>
                                            <span className={`font-bold ${item.priority === 'High' || item.priority === 'Urgent' ? 'text-rose-400' : item.priority === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {item.priority}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-800/60">
                                <button className="w-full flex items-center justify-center gap-2 bg-[#dc9750]/10 text-[#dc9750] border border-[#dc9750]/30 hover:bg-[#dc9750] hover:text-[#0B101E] py-2.5 rounded-xl transition-all font-bold text-sm">
                                    <MessageSquare size={16} />
                                    Review & Action
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 p-4 bg-[#121826] border border-slate-800 rounded-2xl">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="p-2 rounded-lg bg-[#0B101E] border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm text-slate-400 font-medium">
                        Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="p-2 rounded-lg bg-[#0B101E] border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* =========================================================
                FULL-FEATURED REVIEW REQUEST MODAL
            ========================================================= */}
            {viewingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B101E]/95 p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    
                    {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center">
                            <Loader2 className="h-12 w-12 text-[#dc9750] animate-spin mb-4" />
                            <p className="text-slate-300 font-medium animate-pulse">Loading submission details...</p>
                        </div>
                    ) : itemDetails && (
                        <div className="w-full max-w-[1200px] h-[95vh] rounded-3xl border border-slate-800 bg-[#0B101E] shadow-2xl flex flex-col overflow-hidden relative">
                            
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-800/60 bg-[#121826] px-6 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center h-10 w-10 rounded-xl border border-[#dc9750]/30 bg-[#dc9750]/10 text-[#dc9750]">
                                        <CheckSquare size={20} />
                                    </span>
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Review Request</h2>
                                        <p className="text-xs text-slate-400 font-medium tracking-wide mt-0.5">
                                            Submitted by <span className="text-white font-bold">{itemDetails.createdBy?.name || itemDetails.assignedTo?.[0]?.name || 'System'}</span>
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setViewingItem(null); setItemDetails(null); }} 
                                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Modal Body (2 Columns) */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                <div className="flex flex-col lg:flex-row gap-6">
                                    
                                    {/* --- LEFT COLUMN: DETAILS & DISCUSSION --- */}
                                    <div className="flex-1 flex flex-col gap-6">
                                        
                                        {/* Details Card */}
                                        <div className="rounded-2xl border border-slate-800/80 bg-[#121826] p-6 shadow-sm">
                                            <h1 className="text-2xl font-black text-white tracking-tight mb-4">
                                                {itemDetails.title || itemDetails.name}
                                            </h1>
                                            
                                            <div className="flex items-center gap-3 mb-8">
                                                {getStatusBadge(itemDetails.status || itemDetails.approvalStatus)}
                                                {viewingItem._itemType !== 'project' && getPriorityBadge(itemDetails.priority)}
                                            </div>

                                            <div className="mb-8">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                    <AlignLeft className="h-3.5 w-3.5" /> Description
                                                </p>
                                                <div className="rounded-xl border border-slate-800 bg-[#0B101E] p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                    {itemDetails.description || "No additional description provided."}
                                                </div>
                                            </div>

                                            {/* FileList Integration for Attachments */}
                                            {viewingItem._itemType !== 'project' ? (
                                                <div className="mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" /> Attachments
                                                    </p>
                                                    <div className="rounded-xl border border-slate-800 bg-[#0B101E] p-2 min-h-[80px]">
                                                        {/* FileList component handles fetching and downloading properly */}
                                                        <FileList taskId={itemDetails._id} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mb-8">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" /> Attachments
                                                    </p>
                                                    <div className="rounded-xl border border-slate-800 bg-[#0B101E] overflow-hidden">
                                                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/50 mb-3 border border-slate-700">
                                                                <FileText className="h-4 w-4 text-slate-500" />
                                                            </div>
                                                            <p className="text-sm font-bold text-slate-400">No media files attached to this project submission.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metadata Footer */}
                                            <div className="flex flex-col sm:flex-row gap-6 pt-6 border-t border-slate-800/60">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400">
                                                        <Calendar className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-500">Due Date</p>
                                                        <p className="text-sm font-bold text-white">
                                                            {itemDetails.dueDate ? new Date(itemDetails.dueDate).toLocaleString() : "Not Set"}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-400">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-slate-500">Assigned Members</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            {itemDetails.assignedTo?.length > 0 ? (
                                                                itemDetails.assignedTo.map((u) => (
                                                                    <div key={u._id} className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                                                                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#dc9750] text-[#121826] text-[8px] font-bold">
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
                                            </div>
                                        </div>

                                        {/* Discussion Card (Only for tasks) */}
                                        {viewingItem._itemType !== 'project' && (
                                            <div className="rounded-2xl border border-slate-800/80 bg-[#121826] p-6 shadow-sm">
                                                <div className="flex items-center gap-2 mb-6">
                                                    <MessageSquare className="h-5 w-5 text-[#dc9750]" />
                                                    <h3 className="text-lg font-bold text-white">Discussion ({itemComments.length})</h3>
                                                </div>

                                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-700">
                                                    {itemComments.length === 0 ? (
                                                        <div className="border-t border-slate-800 pt-8 pb-4 flex flex-col items-center text-center">
                                                            <p className="text-sm font-medium text-slate-500">No comments yet. Start the conversation!</p>
                                                        </div>
                                                    ) : (
                                                        itemComments.map(c => (
                                                            <div key={c._id} className="flex gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-[#dc9750] text-[#121826] font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-1">
                                                                    {c.userId?.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 bg-[#0B101E] border border-slate-800 rounded-xl p-3 space-y-1.5">
                                                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                                                        <span className="font-bold text-white">{c.userId?.name}</span>
                                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 rounded">
                                                                            {c.userId?.role === 'admin' ? 'Manager' : 'Member'}
                                                                        </span>
                                                                        <span className="text-slate-500 ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{c.message}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <form onSubmit={handleAddComment} className="flex items-center gap-2 relative">
                                                    <input 
                                                        type="text"
                                                        placeholder="Type your message here..."
                                                        className="w-full rounded-xl border border-slate-700 bg-[#0B101E] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#dc9750] focus:outline-none focus:ring-1 focus:ring-[#dc9750] pr-24"
                                                        value={commentInput}
                                                        onChange={(e) => setCommentInput(e.target.value)}
                                                    />
                                                    <button type="submit" disabled={!commentInput.trim()} className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 rounded-lg bg-[#dc9750] px-4 font-bold text-[#121826] hover:bg-[#c28242] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
                                                        Post <Send className="h-3.5 w-3.5 ml-0.5" />
                                                    </button>
                                                </form>
                                            </div>
                                        )}
                                    </div>

                                    {/* --- RIGHT COLUMN: DECISION & AUDIT TRAIL --- */}
                                    <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-6">
                                        
                                        {/* Review Request Decision Box */}
                                        <div className="rounded-2xl border border-slate-800/80 bg-[#121826] p-6 shadow-sm">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                <MessageSquare className="h-3.5 w-3.5" /> Decision Note / Feedback
                                            </p>
                                            <textarea
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                placeholder="Add notes for your decision (Required for rejection)..."
                                                className="w-full h-28 rounded-xl border border-slate-700 bg-[#0B101E] p-4 text-sm text-white placeholder-slate-500 focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750] outline-none resize-none transition-all mb-4"
                                            />
                                            
                                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                                <button
                                                    onClick={() => handleProcessApproval('reject')}
                                                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-transparent px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-all"
                                                >
                                                    <XCircle className="h-4 w-4" /> Reject Submission
                                                </button>
                                                <button
                                                    onClick={() => handleProcessApproval('approve')}
                                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#dc9750] px-4 py-3 text-sm font-bold text-[#121826] hover:bg-[#c28242] transition-all"
                                                >
                                                    <CheckCircle className="h-4 w-4" /> Approve Submission
                                                </button>
                                            </div>
                                        </div>

                                        {/* Audit Trail / History (Only for tasks) */}
                                        {viewingItem._itemType !== 'project' && (
                                            <div className="rounded-2xl border border-slate-800/80 bg-[#121826] p-6 shadow-sm flex-1 flex flex-col max-h-[500px]">
                                                <div className="flex items-center gap-2 mb-6">
                                                    <History className="h-5 w-5 text-[#dc9750]" />
                                                    <h3 className="text-lg font-bold text-white">Audit Trail / History</h3>
                                                </div>

                                                <div className="relative pl-3 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                                                    {(itemHistory.length > 0 ? itemHistory : [{
                                                        userId: { name: itemDetails.createdBy?.name || 'System' },
                                                        createdAt: new Date().toISOString(),
                                                        action: 'Task Initialized',
                                                        newValue: `Task initialized with status: ${itemDetails.status}`
                                                    }]).map((log, idx) => (
                                                        <div key={idx} className="relative pl-6">
                                                            <div className="absolute left-[-2px] top-1.5 h-2 w-2 rounded-full bg-[#dc9750] ring-4 ring-[#121826]"></div>
                                                            
                                                            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                <span className="text-white">{log.userId?.name || 'System'}</span>
                                                                <span>•</span>
                                                                <span>{new Date(log.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            
                                                            <p className="text-xs font-bold text-white mb-2">{log.action}</p>
                                                            
                                                            {log.oldValue && log.newValue && (
                                                                <div className="rounded-lg border border-slate-700/50 bg-[#0B101E] p-3 text-xs">
                                                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                                        <span className="w-10">From:</span>
                                                                        <span className="text-rose-500 font-semibold line-through">{log.oldValue}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-slate-400">
                                                                        <span className="w-10">To:</span>
                                                                        <span className="text-[#00E676] font-semibold">{log.newValue}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {!log.oldValue && log.newValue && (
                                                                <div className="rounded-lg border border-slate-700/50 bg-[#0B101E] p-2.5 text-xs text-slate-400">
                                                                    Info: <span className="text-white font-medium">{log.newValue}</span>
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