import React, { useEffect, useState } from "react";
import { Check, Trash2, BellOff, X, Sparkles } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const NotificationCenter = ({ onClose }) => {
  const {
    notifications,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    clearAllNotifications
  } = useSocket();

  const [notificationMuted, setNotificationMuted] = useState(false);
    useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("task_tracker_token");

        const res = await axios.get(
          `${API_BASE}/users/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("Backend Response :", res.data);
        setNotificationMuted(res.data.notificationMuted);
        console.log("Setting State :", res.data.notificationMuted);
      } catch (err) {
        console.error(err);
      }
    };

    fetchProfile();
  }, []);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const toggleNotificationMute = async () => {
    console.log("🔘 Button Clicked");

    try {
      const token = localStorage.getItem("task_tracker_token");

      const res = await axios.patch(
        `${API_BASE}/users/notification-mute`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("PATCH Response:", res.data);

      setNotificationMuted(res.data.notificationMuted);

      console.log("New State:", res.data.notificationMuted);

    } catch (err) {
      console.error("PATCH Error:", err.response?.data || err);
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'assignment':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'approval':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'rejection':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'overdue':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'completed':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="lg:absolute lg:right-0 lg:top-12 lg:w-96 w-full fixed inset-x-0 top-16 lg:h-auto h-[calc(100vh-4rem)] max-h-[520px] flex flex-col rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-2xl z-50 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-100 tracking-tight">Notifications</h4>
          {notifications.some(n => !n.read) && (
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleNotificationMute}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md transition-all
              ${
                notificationMuted
                  ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                  : "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              }`}
            >
            <BellOff size={13} />
            <span>
              {notificationMuted ? "OFF" : "ON"}
            </span>
          </button>

          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-md hover:bg-indigo-500/10 active:scale-95"
            >
              <Check size={13} />
              <span>Mark read</span>
            </button>
          )}

          {/* Close button for mobile views */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 scrollbar-thin scrollbar-thumb-slate-800">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-600 border border-slate-800 mb-3">
              <BellOff size={22} />
            </div>
            <p className="text-xs font-medium text-slate-400">All caught up!</p>
            <p className="text-[11px] text-slate-500 mt-0.5">No notifications right now.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => !notif.read && markAsRead(notif._id)}
                className={`group relative flex flex-col gap-1.5 p-3.5 transition-all cursor-pointer hover:bg-slate-900/60 ${
                  !notif.read ? 'bg-indigo-950/20' : 'bg-transparent'
                }`}
              >
                {/* Unread Accent Bar */}
                {!notif.read && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-sm shadow-indigo-500/50" />
                )}

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border ${getBadgeStyle(
                      notif.type
                    )}`}
                  >
                    {notif.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {formatTime(notif.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pr-6 font-normal">
                  {notif.message}
                </p>

                {/* Single Notification Action / Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif._id);
                  }}
                  title="Delete notification"
                  className="absolute bottom-2.5 right-2.5 p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all duration-150"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/80 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            {notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}
          </span>
          <button
            onClick={clearAllNotifications}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors px-2.5 py-1 rounded-lg hover:bg-rose-500/10 active:scale-95"
          >
            <Trash2 size={13} />
            <span>Clear all</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;