import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import {
  LayoutDashboard,
  CheckSquare,
  ChevronRight,
  UserCircle,
  UsersRound,
  LogOut,
  Search,
  Clock,
  FolderKanban,
  Layers,
  MessageSquare,
  Megaphone,
  Settings,
  ClipboardCheck,
  X,
} from "lucide-react";
import { API_BASE, useAuth } from "../context/AuthContext";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    dashboard: 0,
    tasks: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    productivity: 0,
  });
  
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const handleCronTrigger = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/test-cron`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert("Cron reminder and overdue system processed successfully!");
      } else {
        alert("Failed to trigger scheduler.");
      }
    } catch (err) {
      alert("Error triggering scheduler: " + err.message);
    }
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024 && toggleSidebar) {
      toggleSidebar();
    }
  };

  const fetchSidebarStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/sidebar-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        dashboard: data.total || 0,
        tasks: data.total || 0,
        completed: data.completed || 0,
        pending: data.pending || 0,
        overdue: data.overdue || 0,
        productivity: data.productivity || 0,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingApprovalsCount = async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await fetch(
        `${API_BASE}/tasks?status=${encodeURIComponent(
          "Completed (Pending Approval)"
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setPendingApprovals(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSidebarStats();
    }
  }, [token]);

  useEffect(() => {
    if (token && user?.role === "admin") {
      fetchPendingApprovalsCount();
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (!socket) return;
    
    socket.on("taskUpdated", fetchSidebarStats);
    socket.on("taskUpdated", fetchPendingApprovalsCount);
    socket.on("projectUpdated", fetchPendingApprovalsCount);

    return () => {
      socket.off("taskUpdated", fetchSidebarStats);
      socket.off("taskUpdated", fetchPendingApprovalsCount);
      socket.off("projectUpdated", fetchPendingApprovalsCount);
    };
  }, [socket, user?.role]);

  const profilePhotoUrl = user?.profilePhoto
    ? user.profilePhoto.startsWith("http")
      ? user.profilePhoto
      : `${API_BASE.replace(/\/api$/, "")}${user.profilePhoto}`
    : null;

  return (
    <aside
      className="
        flex h-full w-full flex-col
        border-r border-slate-800/80
        bg-slate-950/95
        backdrop-blur-xl
        text-slate-200
        p-4
        pb-10
        overflow-y-auto overscroll-contain
        shadow-2xl
        [&::-webkit-scrollbar]:hidden
        [-ms-overflow-style:none]
        [scrollbar-width:none]
      "
    >
      {/* ================= TOP ================= */}
      <div className="flex-1 space-y-5">
        {/* ================= WORKSPACE HEADER ================= */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dc9750]/10 text-[#dc9750] border border-[#dc9750]/20">
                <Layers size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-wide text-slate-100 truncate">TaskSphere</h2>
                <p className="text-[11px] text-slate-400 truncate">Team Workspace</p>
              </div>
            </div>

            {/* Mobile Close Drawer Button */}
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 lg:hidden focus:outline-none"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-1.5 border border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-medium text-slate-400">Online</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">v1.0</span>
          </div>
        </div>

        {/* ================= SEARCH ================= */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Quick search..."
            className="py-2.5 pl-10 pr-14 w-full rounded-xl border border-slate-800/80 bg-slate-900/40 text-xs text-slate-200 placeholder:text-slate-500 focus:border-[#dc9750]/50 focus:bg-slate-900/80 transition-all outline-none"
          />
          <span className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 border border-slate-700/50">
            ⌘K
          </span>
        </div>

        {/* ================= NAVIGATION ================= */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          <nav className="flex flex-col gap-1">
            {[
              { to: "/", icon: LayoutDashboard, label: "Dashboard", badge: stats.dashboard, badgeBg: "bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30" },
              { to: "/chat", icon: MessageSquare, label: "Discussion" },
              { to: "/announcements", icon: Megaphone, label: "Announcements" },
              { to: "/profile", icon: UserCircle, label: "My Profile" },
              { to: "/groups", icon: FolderKanban, label: "Projects" },
              { to: "/tasks", icon: CheckSquare, label: "Tasks", badge: stats.tasks, badgeBg: "bg-rose-500/20 text-rose-300 border border-rose-500/30" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? `bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30 shadow-sm`
                        : `text-slate-400 hover:bg-slate-900/60 hover:text-slate-200`
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0 opacity-80" />
                  <div className="flex w-full items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${item.badgeBg}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </NavLink>
              );
            })}

            {/* Admin Section */}
            {user?.role === "admin" && (
              <>
                <div className="my-2.5 border-t border-slate-800/80 mx-2" />
                <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Admin
                </p>

                <NavLink
                  to="/approvals"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? `bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30 shadow-sm`
                        : `text-slate-400 hover:bg-slate-900/60 hover:text-slate-200`
                    }`
                  }
                >
                  <ClipboardCheck size={18} className="shrink-0 opacity-80" />
                  <div className="flex w-full items-center justify-between">
                    <span>Approvals</span>
                    {pendingApprovals > 0 && (
                      <span className="rounded-md bg-[#dc9750]/15 border border-[#dc9750]/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#dc9750]">
                        {pendingApprovals}
                      </span>
                    )}
                  </div>
                </NavLink>

                <NavLink
                  to="/users"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? `bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30 shadow-sm`
                        : `text-slate-400 hover:bg-slate-900/60 hover:text-slate-200`
                    }`
                  }
                >
                  <UsersRound size={18} className="shrink-0 opacity-80" />
                  Manage Team
                </NavLink>

                <NavLink
                  to="/settings"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? `bg-[#dc9750]/15 text-[#dc9750] border border-[#dc9750]/30 shadow-sm`
                        : `text-slate-400 hover:bg-slate-900/60 hover:text-slate-200`
                    }`
                  }
                >
                  <Settings size={18} className="shrink-0 opacity-80" />
                  Admin Settings
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* ================= BOTTOM ================= */}
      <div className="mt-auto space-y-3 border-t border-slate-800/80 pt-3">
        {/* Admin Trigger Button */}
        {user?.role === "admin" && (
          <button
            onClick={handleCronTrigger}
            className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all active:scale-[0.98]"
          >
            <Clock size={14} className="text-slate-400" />
            Run Due Check
          </button>
        )}

        {/* TODAY'S SUMMARY */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
          <h3 className="mb-2 text-xs font-medium text-slate-300">
            Today's Summary
          </h3>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                handleNavClick();
                navigate("/tasks?status=Approved");
              }}
              className="flex min-h-[36px] w-full items-center justify-between rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-slate-800/40 active:bg-slate-800/60"
            >
              <span className="text-slate-400 text-xs">Completed</span>
              <span className="text-emerald-400 font-mono text-xs font-semibold">{stats.completed}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleNavClick();
                navigate("/tasks?status=pending");
              }}
              className="flex min-h-[36px] w-full items-center justify-between rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-slate-800/40 active:bg-slate-800/60"
            >
              <span className="text-slate-400 text-xs">Pending</span>
              <span className="text-amber-400 font-mono text-xs font-semibold">{stats.pending}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleNavClick();
                navigate("/tasks?status=Overdue");
              }}
              className="flex min-h-[36px] w-full items-center justify-between rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-slate-800/40 active:bg-slate-800/60"
            >
              <span className="text-slate-400 text-xs">Overdue</span>
              <span className="text-rose-400 font-mono text-xs font-semibold">{stats.overdue}</span>
            </button>
          </div>
        </div>

        {/* PRODUCTIVITY METRIC */}
        <button
          type="button"
          onClick={() => {
            handleNavClick();
            navigate("/tasks?status=Approved");
          }}
          className="w-full rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-left transition-colors hover:bg-slate-800/40 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">Productivity</span>
            <span className="text-xs font-mono font-semibold text-[#dc9750]">
              {stats.productivity}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800/60">
            <div
              className="h-full rounded-full bg-[#dc9750] transition-all duration-500"
              style={{ width: `${stats.productivity}%` }}
            ></div>
          </div>
        </button>

        {/* USER PROFILE */}
        <button
          onClick={() => {
            handleNavClick();
            navigate("/profile");
          }}
          className="group flex min-h-[48px] w-full items-center justify-between gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800/50 active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt={user?.name || "User"}
                className="h-9 w-9 rounded-lg border border-slate-700 object-cover shrink-0"
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}

            <div
              className={`h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dc9750]/10 border border-[#dc9750]/20 text-xs font-semibold text-[#dc9750] ${
                profilePhotoUrl ? "hidden" : "flex"
              }`}
            >
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>

            <div className="min-w-0 flex-1 text-left leading-tight">
              <h3 className="truncate text-xs font-semibold text-slate-200">
                {user?.name}
              </h3>
              <p className="truncate text-[11px] text-[#dc9750] mt-0.5">
                {user?.designationRole ||
                  (user?.role === "admin" ? "Administrator" : "Team Member")}
              </p>
            </div>
          </div>
          <ChevronRight
            size={16}
            className="text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 shrink-0"
          />
        </button>

        {/* LOGOUT */}
        <button
          onClick={logout}
          className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors active:scale-[0.98]"
        >
          <LogOut size={16} className="opacity-80" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;