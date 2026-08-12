import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE, useAuth } from '../context/AuthContext';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1e2640] text-slate-100 shadow-xl border border-[#dc9750]/30 text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} className="text-[#dc9750]" />
          {toastMsg}
        </div>
      )}

      {/* Header Section */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5 text-slate-100">
              <span className="p-2.5 bg-[#1e2640] text-[#dc9750] rounded-xl border border-[#dc9750]/20">
                <Megaphone size={22} />
              </span>
              Announcements
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Organization-wide and department updates.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#dc9750] hover:bg-[#dc9750]/80 text-[#1e2640] text-sm font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus size={18} className="text-[#1e2640]" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>

        {/* Controls Bar: Search & Category Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements..."
              className="w-full pl-10 pr-9 py-2 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl focus:outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 text-slate-100 placeholder-slate-500 shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === 'All'
                ? 'bg-[#dc9750] text-[#1e2640] font-bold'
                : 'bg-[#1e2640] text-slate-300 border border-slate-700/60 hover:bg-slate-800'
                }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                  ? 'bg-[#dc9750] text-[#1e2640] font-bold'
                  : 'bg-[#1e2640] text-slate-300 border border-slate-700/60 hover:bg-slate-800'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-[#dc9750]" />
            <p className="text-xs text-slate-400">Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#1e2640] border border-[#dc9750]/20 rounded-2xl text-center shadow-xs">
            <div className="p-3 bg-[#dc9750]/10 rounded-full text-[#dc9750] mb-3">
              <Megaphone size={32} />
            </div>
            <h3 className="text-base font-semibold text-slate-200">
              {searchQuery || selectedCategory !== 'All' ? 'No matching announcements found' : 'No Announcements Yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {searchQuery || selectedCategory !== 'All'
                ? 'Try tweaking your search query or clear category filters to see more results.'
                : 'There are no active updates posted for your workspace right now.'}
            </p>
            {(searchQuery || selectedCategory !== 'All') && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-[#dc9750] hover:bg-[#dc9750]/10 rounded-lg transition-colors"
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
                className={`group bg-[#1e2640] border rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all relative ${a.pinned
                  ? 'border-[#dc9750] ring-1 ring-[#dc9750]/30'
                  : 'border-[#dc9750]/20'
                  }`}
              >
                {/* Header row of Card */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#dc9750] bg-[#dc9750]/10 px-2.5 py-0.5 rounded-md border border-[#dc9750]/30">
                          <Pin size={12} className="rotate-45 text-[#dc9750]" /> Pinned
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${categoryStyle[a.category] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                        {a.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/60 text-slate-300 border border-slate-700/60">
                        {a.department || 'Organization-wide'}
                      </span>
                    </div>

                    <h3 className="font-bold text-base sm:text-lg text-slate-100 leading-snug">
                      {a.title}
                    </h3>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 flex-shrink-0">
                      <button
                        onClick={() => togglePin(a)}
                        className="p-1.5 text-slate-400 hover:text-[#dc9750] rounded-md hover:bg-slate-800 transition-colors"
                        title={a.pinned ? 'Unpin' : 'Pin to top'}
                      >
                        {a.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button
                        onClick={() => archiveAnnouncement(a._id)}
                        className="p-1.5 text-slate-400 hover:text-[#dc9750] rounded-md hover:bg-slate-800 transition-colors"
                        title="Archive"
                      >
                        <Archive size={15} />
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(a._id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Announcement Body */}
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed mb-4">
                  {a.body}
                </p>

                {/* Attachments Section */}
                {a.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 p-2.5 bg-slate-900/40 rounded-xl border border-slate-800">
                    {a.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e2640] border border-slate-700 text-xs text-slate-300 hover:border-[#dc9750] hover:text-[#dc9750] transition-colors shadow-2xs"
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
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-700/50 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                    <Calendar size={13} />
                    <span>Posted by <strong className="text-slate-200 font-semibold">{a.postedBy?.name || 'Unknown'}</strong></span>
                    <span>&middot;</span>
                    <span>{new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {canViewReadStatus && (
                      <button
                        onClick={() => openReadStatus(a._id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-[#dc9750] hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Eye size={14} /> Read status
                      </button>
                    )}

                    {hasAcknowledged(a) ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/50">
                        <CheckCircle2 size={14} /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => acknowledge(a._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[#dc9750] hover:bg-[#dc9750]/10 border border-[#dc9750]/30 transition-colors"
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
      </div>


      {/* CREATE ANNOUNCEMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8 transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100">Post New Announcement</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 text-slate-100 placeholder:text-slate-500 transition-all"
                  placeholder="e.g., Office closed for Holiday"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Body <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 text-slate-100 placeholder:text-slate-500 transition-all"
                  placeholder="Write full announcement details..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 text-slate-100 transition-all"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#1e2640] text-slate-100">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Department <span className="text-slate-500 font-normal">(Leave blank for All)</span>
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl outline-none focus:border-[#dc9750] focus:ring-1 focus:ring-[#dc9750]/50 text-slate-100 placeholder:text-slate-500 transition-all"
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
                  className="accent-[#dc9750] rounded border-slate-700 bg-slate-900/60 focus:ring-[#dc9750] h-4 w-4"
                />
                <label htmlFor="pinned" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Pin this announcement to top
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Attachments
                </label>
                <input
                  type="file"
                  multiple
                  disabled
                  className="w-full text-xs text-slate-500 opacity-50 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  File uploads will be enabled after the backend upload service is added.
                </p>
                {formFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formFiles.map((f, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-700/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#dc9750] hover:bg-[#dc9750]/80 disabled:opacity-50 text-[#1e2640] rounded-xl shadow-xs transition-all active:scale-95"
                >
                  {submitting && <Loader2 size={14} className="animate-spin text-[#1e2640]" />}
                  {submitting ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* READ STATUS MODAL */}
{readStatusFor && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
    <div className="bg-[#1e2640] border border-[#dc9750]/20 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
        <h3 className="text-base font-bold text-slate-100">Read Status</h3>
        <button
          onClick={() => setReadStatusFor(null)}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {!readStatusData ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-[#dc9750]" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Seen</span>
              <span className="text-lg font-bold text-slate-200">
                {readStatusData.readCount} <span className="text-xs font-normal text-slate-400">/ {readStatusData.totalEligible}</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Acknowledged</span>
              <span className="text-lg font-bold text-slate-200">
                {readStatusData.acknowledgedCount} <span className="text-xs font-normal text-slate-400">/ {readStatusData.totalEligible}</span>
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seen By</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {readStatusData.readBy?.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No view records yet.</p>
              ) : (
                readStatusData.readBy.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/40 last:border-0">
                    <span className="font-medium text-slate-300">{r.user?.name}</span>
                    <span className="text-slate-400">{new Date(r.readAt).toLocaleDateString()}</span>
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