import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Menu, X, Sparkles, Shield, User } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { unreadCount = 0 } = useSocket() || {};
  const { user } = useAuth() || {};
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
  };

  const handleCloseNotifications = useCallback(() => {
    setShowNotifications(false);
  }, []);

  // Close notifications dropdown on click outside or Escape key press
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        handleCloseNotifications();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showNotifications) {
        handleCloseNotifications();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications, handleCloseNotifications]);

  const isAdmin = user?.role === 'admin';
  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#1e2640]/80 bg-[#0d101c]/85 px-4 backdrop-blur-md transition-colors sm:px-6 lg:px-8">
      {/* Left Section: Mobile Menu Button & Brand */}
      <div className="flex items-center gap-3">
        {/* Toggle Button - Visible on screens smaller than lg */}
        <button
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isSidebarOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e2640] bg-[#1e2640]/40 text-slate-300 transition-all duration-200 hover:border-[#dc9750]/50 hover:bg-[#1e2640] hover:text-[#dc9750] focus:outline-none focus:ring-2 focus:ring-[#dc9750]/50 active:scale-95 lg:hidden"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100 sm:text-lg">
              TaskSphere <span className="text-[#dc9750]">Portal</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Right Section: User Info & Notification Center */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Profile & Role Tag */}
        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-[#1e2640] bg-[#1e2640]/40 p-1.5 pr-3 shadow-sm transition-all duration-200 hover:bg-[#1e2640]/70">
            {/* Avatar Pill */}
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dc9750]/20 text-xs font-bold text-[#dc9750]">
              {initials || <User size={14} />}
            </div>

            <div className="hidden flex-col sm:flex">
              <span className="max-w-[120px] truncate text-xs font-semibold text-slate-200">
                {displayName}
              </span>
              <div className="flex items-center gap-1">
                <Shield
                  size={10}
                  className={isAdmin ? 'text-[#dc9750]' : 'text-slate-400'}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 leading-none">
                  {user.role || (isAdmin ? 'Administrator' : 'Team Member')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notification Trigger & Container */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={toggleNotifications}
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            aria-haspopup="true"
            aria-expanded={showNotifications}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#dc9750]/50 active:scale-95 ${
              showNotifications
                ? 'border-[#dc9750] bg-[#1e2640] text-[#dc9750] shadow-md shadow-[#dc9750]/10'
                : 'border-[#1e2640] bg-[#1e2640]/40 text-slate-300 hover:border-[#dc9750]/40 hover:bg-[#1e2640] hover:text-[#dc9750]'
            }`}
          >
            <Bell size={19} />

            {/* Notification Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#dc9750] opacity-40"></span>
                <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-[#dc9750] px-1 text-[10px] font-black text-[#0d101c] ring-2 ring-[#0d101c]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown Container */}
          {showNotifications && (
            <div
              role="dialog"
              aria-label="Notifications panel"
              className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-[#1e2640] bg-[#0d101c]/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50"
            >
              <NotificationCenter onClose={handleCloseNotifications} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;