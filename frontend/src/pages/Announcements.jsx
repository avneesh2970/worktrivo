import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE, useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Megaphone, Pin, PinOff, Plus, X, Paperclip, AlertCircle,
  Trash2, Archive, CheckCircle2, Eye, Loader2, Search, Filter, Calendar
} from 'lucide-react';

const CATEGORIES = ['Policy Update', 'Holiday', 'General News', 'Urgent'];

const categoryStyle = {
  'Policy Update': 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
  'Holiday': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
  'General News': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  'Urgent': 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
};

const Announcements = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const isAdmin = user?.role === 'admin';
  const canViewReadStatus = ['admin', 'manager'].includes(user?.role);

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal & Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState('General News');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [formFiles, setFormFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readStatusFor, setReadStatusFor] = useState(null);
  const [readStatusData, setReadStatusData] = useState(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    if (socket) {
      socket.on('announcementUpdated', fetchAnnouncements);
    }
    return () => {
      if (socket) {
        socket.off('announcementUpdated', fetchAnnouncements);
      }
    };
  }, [socket]);

  const markRead = async (id) => {
    try {
      await fetch(`${API_BASE}/announcements/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const acknowledge = async (id) => {
    try {
      const res = await fetch(
        `${API_BASE}/announcements/${id}/acknowledge`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed");
      }

      setAnnouncements(prev =>
        prev.filter(a => a._id !== id)
      );

      setToastMsg("Announcement acknowledged.");
    } catch (err) {
      console.error(err);
    }
  };

  const togglePin = async (announcement) => {
    try {
      await fetch(`${API_BASE}/announcements/${announcement._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pinned: !announcement.pinned })
      });
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const archiveAnnouncement = async (id) => {
    if (!window.confirm('Archive this announcement? It will be hidden from the main list but read history is kept.')) return;
    try {
      await fetch(`${API_BASE}/announcements/${id}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to archive', err);
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Permanently delete this announcement? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const openReadStatus = async (id) => {
    setReadStatusFor(id);
    setReadStatusData(null);
    try {
      const res = await fetch(`${API_BASE}/announcements/${id}/read-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReadStatusData(data);
    } catch (err) {
      console.error('Failed to fetch read status', err);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormBody('');
    setFormCategory('General News');
    setFormDepartment('');
    setFormPinned(false);
    setFormFiles([]);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      return setFormError("Title is required.");
    }

    if (!formBody.trim()) {
      return setFormError("Body is required.");
    }

    setSubmitting(true);

    try {
      const data = new FormData();
      data.append("title", formTitle.trim());
      data.append("body", formBody.trim());
      data.append("category", formCategory);
      data.append("department", formDepartment.trim());
      data.append("pinned", formPinned);

      formFiles.forEach((file) => data.append("attachments", file));

      const res = await fetch(`${API_BASE}/announcements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result.message || result.error || "Failed to post announcement."
        );
      }

      setToastMsg("Announcement posted successfully!");
      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      setFormError(err.message || "Failed to post announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasRead = (announcement) =>
    announcement.readBy?.some((r) => (r.user?._id || r.user) === user?._id);
  const hasAcknowledged = (announcement) =>
    announcement.acknowledgedBy?.some((a) => (a.user?._id || a.user) === user?._id);

  // Filter logic
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        a.title?.toLowerCase().includes(query) ||
        a.body?.toLowerCase().includes(query) ||
        a.department?.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === 'All' || a.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [announcements, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 shadow-xl border border-slate-700 text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} className="text-[#10b981]" />
          {toastMsg}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5 text-slate-900 dark:text-white">
            <span className="p-2 bg-[#10b981]/15 text-[#10b981] rounded-xl border border-[#10b981]/30">
              <Megaphone size={22} />
            </span>
            <span>Broadcast <span className="text-[#10b981]">Announcements</span></span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Organization-wide updates, policy releases, and department news.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#10b981]/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={18} />
            <span>Post Announcement</span>
          </button>
        )}
      </div>

      {/* Controls Bar: Search & Category Pills */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements..."
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#10b981] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter size={14} className="text-slate-400 mr-1 hidden sm:block flex-shrink-0" />
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === 'All'
              ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === cat
                ? 'bg-[#10b981] text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Loader2 size={32} className="animate-spin text-[#10b981]" />
          <p className="text-xs text-slate-500 font-medium">Loading announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-sm">
          <div className="p-3 bg-[#10b981]/15 rounded-2xl text-[#10b981] mb-3">
            <Megaphone size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery || selectedCategory !== 'All' ? 'No matching announcements found' : 'No Announcements Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 font-medium">
            {searchQuery || selectedCategory !== 'All'
              ? 'Try tweaking your search query or clear category filters to see more results.'
              : 'There are no active updates posted for your workspace right now.'}
          </p>
          {(searchQuery || selectedCategory !== 'All') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-4 px-3 py-1.5 text-xs font-bold text-[#10b981] hover:bg-[#10b981]/10 rounded-xl transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((a) => (
            <div
              key={a._id}
              onMouseEnter={() => { if (!hasRead(a)) markRead(a._id); }}
              className={`group bg-white dark:bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative ${a.pinned
                ? 'border-[#10b981] ring-1 ring-[#10b981]/30'
                : 'border-slate-200 dark:border-slate-800'
                }`}
            >
              {/* Header row of Card */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded-full border border-[#10b981]/30">
                        <Pin size={12} className="rotate-45 text-[#10b981]" /> Pinned
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${categoryStyle[a.category] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                      {a.category}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {a.department || 'Organization-wide'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-snug">
                    {a.title}
                  </h3>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <button
                      onClick={() => togglePin(a)}
                      className="p-1.5 text-slate-500 hover:text-[#10b981] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title={a.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      {a.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    </button>
                    <button
                      onClick={() => archiveAnnouncement(a._id)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Archive"
                    >
                      <Archive size={15} />
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(a._id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Announcement Body */}
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-4 font-normal">
                {a.body}
              </p>

              {/* Attachments Section */}
              {a.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {a.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:border-[#10b981] hover:text-[#10b981] transition-colors shadow-2xs"
                    >
                      <Paperclip size={13} className="text-slate-400" />
                      <span className="max-w-[160px] truncate font-medium">
                        {att.fileName}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {/* Footer Meta Details & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <Calendar size={13} />
                  <span>Posted by <strong className="text-slate-900 dark:text-white font-semibold">{a.postedBy?.name || 'Unknown'}</strong></span>
                  <span>&middot;</span>
                  <span>{new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>

                <div className="flex items-center gap-3">
                  {canViewReadStatus && (
                    <button
                      onClick={() => openReadStatus(a._id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye size={14} /> Read status
                    </button>
                  )}

                  {hasAcknowledged(a) ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50">
                      <CheckCircle2 size={14} /> Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => acknowledge(a._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-slate-950 bg-[#10b981] hover:bg-[#059669] shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE ANNOUNCEMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Post New Announcement</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                  placeholder="e.g., Office closed for Holiday"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Body <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all resize-none"
                  placeholder="Write full announcement details..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] text-slate-900 dark:text-white transition-all"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Department <span className="text-slate-400 font-normal">(Leave blank for All)</span>
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#10b981] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                    placeholder="e.g., Engineering"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="rounded border-slate-300 text-[#10b981] focus:ring-[#10b981] h-4 w-4"
                />
                <label htmlFor="pinned" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Pin this announcement to top
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-slate-950 rounded-xl shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{submitting ? 'Posting...' : 'Post Announcement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* READ STATUS MODAL */}
      {readStatusFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Read Status</h3>
              <button
                onClick={() => setReadStatusFor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {!readStatusData ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-[#10b981]" />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] text-slate-500 block font-semibold uppercase tracking-wider">Seen</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                      {readStatusData.readCount} <span className="text-xs font-normal text-slate-500">/ {readStatusData.totalEligible}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block font-semibold uppercase tracking-wider">Acknowledged</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {readStatusData.acknowledgedCount} <span className="text-xs font-normal text-slate-500">/ {readStatusData.totalEligible}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seen By</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {readStatusData.readBy?.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2 font-medium">No view records yet.</p>
                    ) : (
                      readStatusData.readBy.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.user?.name}</span>
                          <span className="text-slate-500">{new Date(r.readAt).toLocaleDateString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;