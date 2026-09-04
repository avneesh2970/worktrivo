import React, { useEffect, useState, useMemo } from "react";
import { useAuth, API_BASE } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { Loader2, Plus, Search, Users, CheckCircle, X, FolderPlus } from "lucide-react";

const Groups = () => {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/groups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setGroups(data);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          members: selectedMembers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setProjectName("");
      setProjectDescription("");
      setSelectedMembers([]);
      setShowModal(false);

      fetchGroups();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refreshProjects = () => {
      fetchGroups();
    };
    socket.on("projectUpdated", refreshProjects);
    return () => {
      socket.off("projectUpdated", refreshProjects);
    };
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Project <span className="text-[#10b981]">Workspaces</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm font-medium">
            Manage your project teams, monitor workflow progress, and build together.
          </p>
        </div>

        {user?.role === "admin" && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 px-5 py-2.5 text-sm font-bold shadow-md shadow-[#10b981]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            <span>Create Project</span>
          </button>
        )}
      </div>

      {/* Controls Bar: Search & Counter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#10b981] transition-all"
          />
        </div>

        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 self-end sm:self-center">
          Showing <span className="text-[#10b981] font-bold">{filteredGroups.length}</span> of {groups.length} projects
        </div>
      </div>

      {/* Grid Layout */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 animate-pulse flex flex-col justify-between">
              <div>
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2 mb-3"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-3/4 mb-2"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-2/3"></div>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center">
          <FolderPlus size={44} className="text-slate-400 dark:text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No projects found</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-sm font-medium">
            {searchQuery
              ? "No projects matched your search query. Try typing something else."
              : "Get started by creating your first project workspace."}
          </p>
          {!searchQuery && user?.role === "admin" && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 px-4 py-2 text-xs font-bold text-[#10b981] hover:bg-[#10b981]/25 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Create One Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => (
            <div
              key={group._id}
              onClick={() => navigate(`/groups/${group._id}`)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all duration-200 hover:border-[#10b981]/60 hover:shadow-md cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#10b981] transition-colors line-clamp-1">
                    {group.name}
                  </h2>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-6 leading-relaxed font-normal">
                  {group.description || "No project description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Users size={15} className="text-slate-400" />
                  <span>
                    <strong className="text-slate-900 dark:text-white font-bold">{group.members?.length || 0}</strong> Members
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <CheckCircle size={15} className="text-slate-400" />
                  <span>
                    <strong className="text-slate-900 dark:text-white font-bold">{group.tasks?.length || 0}</strong> Tasks
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div
            className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New Project</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">Set up a collaborative workspace for your team.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#10b981] transition-all"
                  placeholder="e.g. Website Redesign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#10b981] transition-all resize-none"
                  placeholder="Briefly describe the goals or scope..."
                  rows={4}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Assign Members
                </label>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
                  {users.map((member) => (
                    <label
                      key={member._id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/80 cursor-pointer"
                    >
                      <div>
                        <p className="text-sm text-slate-900 dark:text-white font-bold">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {member.email}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member._id)}
                        onChange={() => toggleMember(member._id)}
                        className="w-4 h-4 rounded text-[#10b981] focus:ring-[#10b981]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !projectName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-[#10b981]/20 hover:bg-[#059669] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Project</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;