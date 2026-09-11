import React, { useEffect, useRef, useState, useMemo } from "react";
import { useChatApi } from "../services/chatApi";
import {
  Send,
  MessageSquareText,
  Edit2,
  Trash2,
  UserPlus,
  X,
  Search,
  Pin,
  Users,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  UserMinus,
  Check,
  Plus,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  Lock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Hash,
  User,
  Radio,
  Share2,
} from "lucide-react";

import { useAuth, API_BASE } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const ChatApp = () => {
  const {
    getChatRooms,
    getMessages,
    createRoom,
    getOrCreateDirectRoom,
    approveRoom,
    rejectRoom,
    addMember,
    removeMember,
    unpinMessage,
    sendMessageWithMentions,
    searchMentionUsers,
  } = useChatApi();

  const { user, token } = useAuth();
  const {
    socket,
    pinMessage,
    messages,
    setMessages,
    joinRoom,
    leaveRoom,
    startTyping,
    stopTyping,
    editMessage,
    onlineUsers = [],
    typingUsers = [],
  } = useSocket();

  // Rooms & Navigation
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'communities' | 'direct' | 'pending'
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Chat Interaction States
  const [text, setText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [showMentionBox, setShowMentionBox] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);
  const [showPinnedBar, setShowPinnedBar] = useState(true);

  // Layout & Drawers
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);

  // Modals
  const [isDirectChatModalOpen, setIsDirectChatModalOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // User Picker Lists & Inputs
  const [allUsers, setAllUsers] = useState([]);
  const [userPickerSearch, setUserPickerSearch] = useState("");
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDesc, setNewCommunityDesc] = useState("");
  const [selectedCommunityMembers, setSelectedCommunityMembers] = useState([]);
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [approvalActionLoading, setApprovalActionLoading] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  // Refs
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const toastTimeout = useRef(null);
  const mentionRequestId = useRef(0);
  const chatInputRef = useRef(null);

  const showToast = (msg, type = "info") => {
    setToastMessage({ msg, type });
    clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Rooms on mount
  useEffect(() => {
    loadRooms();
    fetchAllUsers();
  }, []);

  // Socket event listeners for real-time room updates
  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (newRoom) => {
      setRooms((prev) => {
        const exists = prev.some((r) => r._id === newRoom._id);
        if (exists) {
          return prev.map((r) => (r._id === newRoom._id ? newRoom : r));
        }
        return [newRoom, ...prev];
      });
    };

    const handleRoomApproved = (approvedRoom) => {
      setRooms((prev) =>
        prev.map((r) => (r._id === approvedRoom._id ? approvedRoom : r))
      );
      setSelectedRoom((current) =>
        current && current._id === approvedRoom._id ? approvedRoom : current
      );
      showToast(`Community "${approvedRoom.name}" has been approved!`, "success");
    };

    const handleRoomRejected = (rejectedRoom) => {
      setRooms((prev) =>
        prev.map((r) => (r._id === rejectedRoom._id ? rejectedRoom : r))
      );
      setSelectedRoom((current) =>
        current && current._id === rejectedRoom._id ? rejectedRoom : current
      );
      showToast(`Community "${rejectedRoom.name}" was rejected.`, "error");
    };

    socket.on("chat_room_created", handleRoomCreated);
    socket.on("room_approved", handleRoomApproved);
    socket.on("room_rejected", handleRoomRejected);

    return () => {
      socket.off("chat_room_created", handleRoomCreated);
      socket.off("room_approved", handleRoomApproved);
      socket.off("room_rejected", handleRoomRejected);
    };
  }, [socket]);

  // Keep bottom in view when messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages & join room when selectedRoom changes
  useEffect(() => {
    if (!selectedRoom) return;

    loadMessages(selectedRoom._id);
    joinRoom(selectedRoom._id);

    // On mobile, collapse sidebar when room is chosen
    setShowSidebarMobile(false);

    return () => {
      leaveRoom(selectedRoom._id);
    };
  }, [selectedRoom?._id]);

  // Update last message in room list when a message is received
  useEffect(() => {
    if (!messages.length || !selectedRoom) return;
    const lastMsg = messages[messages.length - 1];
    setRooms((prev) =>
      prev.map((r) => {
        if (r._id === selectedRoom._id) {
          return { ...r, lastMessage: lastMsg, updatedAt: lastMsg.createdAt || new Date().toISOString() };
        }
        return r;
      })
    );
  }, [messages]);

  // Clean up timers
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeout.current);
      clearTimeout(toastTimeout.current);
    };
  }, []);

  const loadRooms = async (autoSelectId = null) => {
    try {
      setLoadingRooms(true);
      const res = await getChatRooms();
      const loadedRooms = res.data || [];
      setRooms(loadedRooms);

      if (autoSelectId) {
        const found = loadedRooms.find((r) => r._id === autoSelectId);
        if (found) {
          setSelectedRoom(found);
          return;
        }
      }

      if (!selectedRoom && loadedRooms.length > 0) {
        setSelectedRoom(loadedRooms[0]);
      } else if (selectedRoom) {
        const currentStillValid = loadedRooms.find((r) => r._id === selectedRoom._id);
        if (currentStillValid) {
          setSelectedRoom(currentStillValid);
        } else if (loadedRooms.length > 0) {
          setSelectedRoom(loadedRooms[0]);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to load chat rooms", "error");
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data.filter((u) => u.active) : []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const loadMessages = async (roomId) => {
    try {
      setLoadingMessages(true);
      const res = await getMessages(roomId);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Helper to determine display details for room items & header
  const getRoomDisplay = (room) => {
    if (!room) return { name: "Unknown", subtitle: "", avatar: null, isDirect: false, isOnline: false };

    if (room.type === "direct") {
      const otherMembers = (room.members || []).filter(
        (m) => m._id && m._id.toString() !== user?._id?.toString()
      );
      const other = otherMembers[0] || (room.members || [])[0];

      // If current user is admin and viewing a direct chat between other employees
      if (user?.role === "admin" && otherMembers.length > 1) {
        const p1 = room.members[0];
        const p2 = room.members[1];
        return {
          name: `${p1?.name || "User"} & ${p2?.name || "User"}`,
          subtitle: "Direct Chat (Admin View)",
          avatar: p1?.profilePhoto || null,
          isDirect: true,
          isOnline: onlineUsers.includes(p1?._id) || onlineUsers.includes(p2?._id),
          otherUser: other,
        };
      }

      return {
        name: other?.name || "Direct Message",
        subtitle: other?.designationRole || other?.role || "Direct Chat",
        avatar: other?.profilePhoto || null,
        isDirect: true,
        isOnline: other ? onlineUsers.includes(other._id) : false,
        otherUser: other,
      };
    }

    return {
      name: room.name,
      subtitle: `${room.members?.length || 0} members`,
      avatar: null,
      isDirect: false,
      isOnline: false,
      otherUser: null,
    };
  };

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Tab filter
      if (activeTab === "communities" && room.type === "direct") return false;
      if (activeTab === "direct" && room.type !== "direct") return false;
      if (activeTab === "pending" && room.approvalStatus !== "Pending") return false;

      // Search query
      if (roomSearchQuery.trim()) {
        const q = roomSearchQuery.toLowerCase();
        const display = getRoomDisplay(room);
        const nameMatches = display.name.toLowerCase().includes(q);
        const descMatches = room.description?.toLowerCase().includes(q);
        const memberMatches = (room.members || []).some((m) =>
          m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
        );
        return nameMatches || descMatches || memberMatches;
      }
      return true;
    });
  }, [rooms, activeTab, roomSearchQuery, user, onlineUsers]);

  const pendingApprovalRoomsCount = useMemo(() => {
    return rooms.filter((r) => r.approvalStatus === "Pending").length;
  }, [rooms]);

  // Start 1-on-1 Direct Chat
  const handleStartDirectChat = async (targetUser) => {
    try {
      const res = await getOrCreateDirectRoom(targetUser._id);
      const directRoom = res.data;
      setIsDirectChatModalOpen(false);
      setUserPickerSearch("");

      // Add to rooms if not present
      setRooms((prev) => {
        const exists = prev.some((r) => r._id === directRoom._id);
        if (exists) return prev;
        return [directRoom, ...prev];
      });

      setSelectedRoom(directRoom);
      showToast(`Started direct chat with ${targetUser.name}`, "success");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to start direct chat", "error");
    }
  };

  // Create Group / Community
  const handleCreateCommunitySubmit = async (e) => {
    e.preventDefault();
    if (!newCommunityName.trim()) return;

    try {
      setIsCreatingCommunity(true);
      const res = await createRoom({
        name: newCommunityName.trim(),
        description: newCommunityDesc.trim(),
        members: selectedCommunityMembers,
        type: "group",
      });

      const created = res.data;
      showToast(res.message || "Community created!", "success");

      setNewCommunityName("");
      setNewCommunityDesc("");
      setSelectedCommunityMembers([]);
      setIsCreateCommunityOpen(false);

      await loadRooms(created._id);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to create community", "error");
    } finally {
      setIsCreatingCommunity(false);
    }
  };

  // Admin Approve Community
  const handleApproveCommunity = async (roomId) => {
    try {
      setApprovalActionLoading(true);
      const res = await approveRoom(roomId);
      showToast("Community approved successfully!", "success");
      const updated = res.data;
      setRooms((prev) => prev.map((r) => (r._id === roomId ? updated : r)));
      if (selectedRoom?._id === roomId) {
        setSelectedRoom(updated);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to approve community", "error");
    } finally {
      setApprovalActionLoading(false);
    }
  };

  // Admin Reject Community
  const handleRejectCommunity = async (roomId) => {
    try {
      setApprovalActionLoading(true);
      const res = await rejectRoom(roomId);
      showToast("Community rejected", "info");
      const updated = res.data;
      setRooms((prev) => prev.map((r) => (r._id === roomId ? updated : r)));
      if (selectedRoom?._id === roomId) {
        setSelectedRoom(updated);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to reject community", "error");
    } finally {
      setApprovalActionLoading(false);
    }
  };

  // Message Sending
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !selectedRoom) return;

    if (selectedRoom.approvalStatus === "Pending") {
      showToast("Cannot send messages. This community is awaiting Admin approval.", "error");
      return;
    }

    try {
      const messagePayload = {
        chatRoom: selectedRoom._id,
        text: text.trim(),
        attachments: [],
        mentions: mentionedUsers.map((u) => u._id),
        replyTo: null,
      };

      setText("");
      setMentionedUsers([]);
      setMentionSuggestions([]);
      setShowMentionBox(false);

      clearTimeout(typingTimeout.current);
      stopTyping(selectedRoom._id);

      await sendMessageWithMentions(messagePayload);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to send message", "error");
    }
  };

  // Message Typing and Mention suggestions
  const handleTyping = async (e) => {
    const value = e.target.value;
    setText(value);

    if (!selectedRoom) return;

    if (value.trim()) {
      startTyping(selectedRoom._id);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        stopTyping(selectedRoom._id);
      }, 1200);
    } else {
      clearTimeout(typingTimeout.current);
      stopTyping(selectedRoom._id);
    }

    // Mention search on trailing @query
    const match = value.match(/@([a-zA-Z0-9_]*)$/);
    if (match) {
      const query = match[1];
      const requestId = ++mentionRequestId.current;

      try {
        const res = await searchMentionUsers(selectedRoom._id, query);
        if (requestId !== mentionRequestId.current) return;
        const results = res?.data || [];
        setMentionSuggestions(results);
        setShowMentionBox(results.length > 0);
      } catch (err) {
        if (requestId === mentionRequestId.current) {
          setMentionSuggestions([]);
          setShowMentionBox(false);
        }
      }
    } else {
      setMentionSuggestions([]);
      setShowMentionBox(false);
    }
  };

  const selectMention = (mentionUser) => {
    setText((prev) => prev.replace(/@[a-zA-Z0-9_]*$/, `@${mentionUser.name} `));
    setMentionedUsers((prev) => {
      if (prev.some((u) => u._id === mentionUser._id)) return prev;
      return [...prev, mentionUser];
    });
    setMentionSuggestions([]);
    setShowMentionBox(false);
    chatInputRef.current?.focus();
  };

  // Message Actions
  const canEditMessage = (msg) => {
    if (!msg || !msg.createdAt) return false;
    const EDIT_WINDOW_MS = 5 * 60 * 1000;
    return Date.now() - new Date(msg.createdAt).getTime() <= EDIT_WINDOW_MS;
  };

  const handleEdit = (msg) => {
    if (!canEditMessage(msg)) {
      showToast("Messages can only be edited within 5 minutes of sending.", "error");
      return;
    }
    setEditingId(msg._id);
    setEditingText(msg.text);
  };

  const saveEdit = () => {
    if (!editingText.trim() || !editingId) return;
    const msgBeingEdited = messages.find((m) => m._id === editingId);
    if (msgBeingEdited && !canEditMessage(msgBeingEdited)) {
      showToast("Editing time expired (5-minute limit exceeded).", "error");
      setEditingId(null);
      setEditingText("");
      return;
    }
    editMessage(editingId, editingText.trim());
    setEditingId(null);
    setEditingText("");
    showToast("Message updated", "info");
  };

  const handleUnpin = async (msgId) => {
    try {
      await unpinMessage(msgId);
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, pinned: false } : m))
      );
      showToast("Message unpinned", "info");
    } catch (err) {
      console.error(err);
      showToast("Failed to unpin message", "error");
    }
  };

  // Member Management
  const handleAddMember = async (email) => {
    if (!selectedRoom) return;
    try {
      await addMember(selectedRoom._id, email);
      showToast("Member added successfully!", "success");
      setIsAddMemberOpen(false);
      loadRooms(selectedRoom._id);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to add member", "error");
    }
  };

  const handleRemoveMember = async () => {
    if (!userToDelete || !selectedRoom) return;
    try {
      await removeMember(selectedRoom._id, userToDelete._id);
      showToast(`${userToDelete.name} removed from channel`, "success");
      loadRooms(selectedRoom._id);
    } catch (err) {
      console.error(err);
      showToast("Failed to remove member", "error");
    } finally {
      setUserToDelete(null);
    }
  };

  // Helpers
  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatMessageDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderMessageContent = (msg) => {
    let parts = [msg.text];
    msg.mentions?.forEach((mention) => {
      parts = parts.flatMap((part) => {
        if (typeof part !== "string") return [part];
        const mentionText = `@${mention.name}`;
        return part.split(mentionText).flatMap((segment, index, arr) => {
          if (index === arr.length - 1) return [segment];
          return [
            segment,
            <span
              key={`${mention._id}-${index}`}
              className="font-bold text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded"
            >
              {mentionText}
            </span>,
          ];
        });
      });
    });
    return parts;
  };

  const pinnedMessages = messages.filter((m) => m.pinned && !m.deleted);
  const displayMessages = messages.filter((m) => !m.deleted);
  const otherTypingUsers = typingUsers.filter((name) => name !== user?.name);

  const activeRoomDisplay = selectedRoom ? getRoomDisplay(selectedRoom) : null;
  const isSelectedRoomPending = selectedRoom?.approvalStatus === "Pending";
  const canManageMembers =
    user?.role === "admin" ||
    (selectedRoom?.type === "group" && selectedRoom?.admins?.some((a) => (a._id || a) === user?._id));

  return (
    <div className="relative flex h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200"
              : toastMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200"
              : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          }`}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEFT PANEL: Conversations Sidebar (All / Communities / Direct Messages)   */}
      {/* ========================================================================= */}
      <aside
        className={`
          ${showSidebarMobile ? "flex" : "hidden"} lg:flex
          flex-col w-full lg:w-80 xl:w-96
          bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800/80
          h-full shrink-0 z-30
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-black shadow-inner">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Workplace <span className="text-[#10b981]">Chat</span>
                </h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {user?.role === "admin" ? "Admin Oversight Enabled" : "Connect with colleagues"}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Start 1-on-1 Direct Chat (Open to ALL users) */}
              <button
                onClick={() => setIsDirectChatModalOpen(true)}
                title="Start Direct Chat with anyone"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <UserPlus size={14} className="text-[#10b981]" />
                <span className="hidden sm:inline">Direct</span>
              </button>

              {/* Create Community: ONLY for Admin and Manager (Hidden for Member) */}
              {(user?.role === "admin" || user?.role === "manager") && (
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  title="Create Group Community"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 text-xs font-bold shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span className="hidden sm:inline">Community</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Conversations */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={roomSearchQuery}
              onChange={(e) => setRoomSearchQuery(e.target.value)}
              placeholder="Search conversations, members..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981] transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("communities")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "communities"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Communities
            </button>
            <button
              onClick={() => setActiveTab("direct")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "direct"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Direct
            </button>

            {/* Admin Pending Approvals Tab */}
            {user?.role === "admin" && (
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all relative cursor-pointer ${
                  activeTab === "pending"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                Pending
                {pendingApprovalRoomsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                    {pendingApprovalRoomsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingRooms ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquareText size={36} className="text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No chats found</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                {roomSearchQuery
                  ? "No conversations match your search."
                  : activeTab === "pending"
                  ? "No communities currently pending approval."
                  : "Start a 1-on-1 chat or create a community to begin!"}
              </p>
              <button
                onClick={() => setIsDirectChatModalOpen(true)}
                className="mt-4 px-3.5 py-2 rounded-xl bg-[#10b981]/15 text-[#10b981] text-xs font-bold hover:bg-[#10b981]/25 transition-all cursor-pointer"
              >
                + Start Direct Chat
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const display = getRoomDisplay(room);
              const isSelected = selectedRoom?._id === room._id;
              const isPending = room.approvalStatus === "Pending";
              const lastMsgText = room.lastMessage?.text || (room.lastMessage?.attachments?.length ? "Shared attachment" : "No messages yet");
              const lastMsgTime = room.lastMessage?.createdAt ? formatTime(room.lastMessage.createdAt) : "";

              return (
                <div
                  key={room._id}
                  onClick={() => setSelectedRoom(room)}
                  className={`
                    group relative flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none
                    ${
                      isSelected
                        ? "bg-[#10b981]/15 dark:bg-[#10b981]/20 border border-[#10b981]/30 shadow-sm"
                        : "hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent"
                    }
                  `}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {room.type === "direct" ? (
                      display.avatar ? (
                        <img
                          src={display.avatar}
                          alt={display.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center text-sm border border-emerald-500/30">
                          {display.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#10b981] font-black shadow-inner">
                        {room.type === "global" ? <Sparkles size={20} /> : <Users size={20} />}
                      </div>
                    )}

                    {/* Online status indicator for direct chats */}
                    {room.type === "direct" && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          display.isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                        }`}
                      />
                    )}
                  </div>

                  {/* Room Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isSelected
                            ? "text-slate-950 dark:text-white"
                            : "text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white"
                        }`}
                      >
                        {display.name}
                      </span>
                      {lastMsgTime && (
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">{lastMsgTime}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[190px]">
                        {lastMsgText}
                      </p>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isPending && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1">
                            <Clock size={10} />
                            Pending
                          </span>
                        )}

                        {room.type === "direct" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                            1-on-1
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN ACTIVE CHAT CONVERSATION AREA                                        */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full bg-white dark:bg-[#070b14] relative min-w-0">
        {!selectedRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center mb-4 shadow-inner">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Select a conversation</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
              Choose an existing chat from the left sidebar, start a 1-on-1 direct message, or create a group community.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setIsDirectChatModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold text-xs shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
              >
                + Start Direct Chat
              </button>
              {(user?.role === "admin" || user?.role === "manager") && (
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
                >
                  + Create Community
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back to sidebar button on mobile */}
                <button
                  onClick={() => setShowSidebarMobile(true)}
                  className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>

                {/* Avatar */}
                <div className="relative shrink-0">
                  {selectedRoom.type === "direct" ? (
                    activeRoomDisplay.avatar ? (
                      <img
                        src={activeRoomDisplay.avatar}
                        alt={activeRoomDisplay.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                        {activeRoomDisplay.name.charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-[#10b981] font-bold flex items-center justify-center shadow-inner">
                      {selectedRoom.type === "global" ? <Sparkles size={20} /> : <Users size={20} />}
                    </div>
                  )}

                  {selectedRoom.type === "direct" && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                        activeRoomDisplay.isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                      }`}
                    />
                  )}
                </div>

                {/* Title & Status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                      {activeRoomDisplay.name}
                    </h2>
                    {isSelectedRoomPending && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 text-[10px] font-extrabold shrink-0">
                        Pending Admin Approval
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {activeRoomDisplay.subtitle}
                    {selectedRoom.description && ` • ${selectedRoom.description}`}
                  </p>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {/* Admin Approval Quick Action in Header */}
                {user?.role === "admin" && isSelectedRoomPending && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleApproveCommunity(selectedRoom._id)}
                      disabled={approvalActionLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      <span className="hidden sm:inline">Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectCommunity(selectedRoom._id)}
                      disabled={approvalActionLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                    >
                      <XCircle size={14} />
                      <span className="hidden sm:inline">Reject</span>
                    </button>
                  </div>
                )}

                {/* Toggle Members Drawer */}
                <button
                  onClick={() => setShowMembersDrawer(!showMembersDrawer)}
                  title="Channel Members"
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    showMembersDrawer
                      ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Users size={18} />
                </button>
              </div>
            </header>

            {/* Banner for Pending Communities */}
            {isSelectedRoomPending && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 px-4 py-3 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Community Awaiting Admin Approval
                    </h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      {user?.role === "admin"
                        ? `Created by Manager (${selectedRoom.createdBy?.name || "Manager"}). Review and approve below to activate messaging for all members.`
                        : "You created this community. Members can view and chat in it once an Admin approves."}
                    </p>
                  </div>
                </div>

                {user?.role === "admin" && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleApproveCommunity(selectedRoom._id)}
                      disabled={approvalActionLoading}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      Approve Community
                    </button>
                    <button
                      onClick={() => handleRejectCommunity(selectedRoom._id)}
                      disabled={approvalActionLoading}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pinned Messages Bar */}
            {pinnedMessages.length > 0 && showPinnedBar && (
              <div className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-2 shrink-0 flex items-center justify-between gap-3 backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                  <Pin size={14} className="text-[#10b981] shrink-0 fill-[#10b981]" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 shrink-0">
                    Pinned:
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {pinnedMessages[activePinnedIndex]?.text}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {pinnedMessages.length > 1 && (
                    <span className="text-[10px] text-slate-400 font-bold mr-1">
                      {activePinnedIndex + 1}/{pinnedMessages.length}
                    </span>
                  )}
                  {activePinnedIndex > 0 && (
                    <button
                      onClick={() => setActivePinnedIndex((prev) => prev - 1)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <ChevronUp size={14} />
                    </button>
                  )}
                  {activePinnedIndex < pinnedMessages.length - 1 && (
                    <button
                      onClick={() => setActivePinnedIndex((prev) => prev + 1)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <ChevronDown size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleUnpin(pinnedMessages[activePinnedIndex]._id)}
                    title="Unpin message"
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-[#10b981] border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Loading messages...</p>
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mb-3">
                    <MessageSquareText size={28} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No messages here yet
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {isSelectedRoomPending
                      ? "Chatting will be enabled once approved by Admin."
                      : "Send a friendly greeting to break the ice!"}
                  </p>
                </div>
              ) : (
                displayMessages.map((msg, idx) => {
                  const isMine = msg.sender?._id === user?._id;
                  const prevMsg = displayMessages[idx - 1];
                  const showDateSeparator =
                    !prevMsg ||
                    new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                  return (
                    <React.Fragment key={msg._id || idx}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                            {formatMessageDate(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      <div
                        id={`msg-${msg._id}`}
                        className={`group relative flex items-start gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Sender Avatar */}
                        <div className="shrink-0 mt-0.5">
                          {msg.sender?.profilePhoto ? (
                            <img
                              src={msg.sender.profilePhoto}
                              alt={msg.sender?.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                              {(msg.sender?.name || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div className={`max-w-[80%] sm:max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
                          <div className={`flex items-center gap-2 mb-1 text-[11px] ${isMine ? "justify-end" : "justify-start"}`}>
                            <span className="font-bold text-slate-900 dark:text-slate-200">
                              {isMine ? "You" : msg.sender?.name}
                            </span>
                            {msg.sender?.role && msg.sender.role !== "member" && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                  msg.sender.role === "admin"
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                    : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                                }`}
                              >
                                {msg.sender.role}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
                          </div>

                          <div
                            className={`
                              relative p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm
                              ${
                                isMine
                                  ? "bg-[#10b981] text-slate-950 rounded-tr-none font-medium"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200/80 dark:border-slate-700/60"
                              }
                            `}
                          >
                            {/* Editing mode */}
                            {editingId === msg._id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs outline-none"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-2 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-black/10 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveEdit}
                                    className="px-2.5 py-1 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>{renderMessageContent(msg)}</div>
                            )}

                            {msg.edited && (
                              <span className="block text-[9px] opacity-70 text-right mt-1">
                                (edited)
                              </span>
                            )}
                          </div>

                          {/* Action Hover Toolbar */}
                          <div
                            className={`
                              opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1
                              ${isMine ? "justify-end" : "justify-start"}
                            `}
                          >
                            <button
                              onClick={() => pinMessage(msg._id)}
                              title={msg.pinned ? "Pinned" : "Pin message"}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              <Pin size={12} className={msg.pinned ? "fill-[#10b981] text-[#10b981]" : ""} />
                            </button>

                            {isMine && canEditMessage(msg) && (
                              <button
                                onClick={() => handleEdit(msg)}
                                title="Edit message (available for 5 mins)"
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Typing Indicator */}
            {otherTypingUsers.length > 0 && (
              <div className="px-6 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {otherTypingUsers.join(", ")} {otherTypingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Mention Suggestions Popup */}
            {showMentionBox && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-20 left-6 z-20 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Mention Colleague
                </div>
                {mentionSuggestions.map((mUser) => (
                  <button
                    key={mUser._id}
                    onClick={() => selectMention(mUser)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                      {mUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {mUser.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{mUser.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Message Input Form */}
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
              {isSelectedRoomPending ? (
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-xs font-semibold">
                  <Lock size={16} className="text-amber-500 shrink-0" />
                  <span>
                    Messaging is disabled until this community is approved by an Admin.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <div className="flex-1 relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus-within:border-[#10b981] rounded-2xl px-4 py-1.5 transition-colors shadow-inner">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={text}
                      onChange={handleTyping}
                      placeholder={`Message ${activeRoomDisplay.name}... (Type @ to mention)`}
                      className="w-full bg-transparent py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="p-3 rounded-2xl bg-[#10b981] hover:bg-[#059669] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold transition-all shadow-md shadow-[#10b981]/20 cursor-pointer shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </main>

      {/* ========================================================================= */}
      {/* RIGHT DRAWER: Channel Members & Info                                      */}
      {/* ========================================================================= */}
      {showMembersDrawer && selectedRoom && (
        <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-20">
          <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#10b981]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Members ({selectedRoom.members?.length || 0})
              </span>
            </div>
            <button
              onClick={() => setShowMembersDrawer(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {/* Add member button if allowed */}
          {canManageMembers && selectedRoom.type !== "direct" && (
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <UserPlus size={14} className="text-[#10b981]" />
                <span>Add Member to Channel</span>
              </button>
            </div>
          )}

          {/* Members list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {selectedRoom.members?.map((m) => {
              const isOnline = onlineUsers.includes(m._id);
              return (
                <div
                  key={m._id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {m.profilePhoto ? (
                        <img
                          src={m.profilePhoto}
                          alt={m.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                          {(m.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {m.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {m.designationRole || m.role || (isOnline ? "Online" : "Offline")}
                      </div>
                    </div>
                  </div>

                  {/* Remove member for admins */}
                  {canManageMembers && selectedRoom.type !== "direct" && m._id !== user?._id && (
                    <button
                      onClick={() => setUserToDelete(m)}
                      title="Remove member"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Start Direct 1-on-1 Chat with ANY user                             */}
      {/* ========================================================================= */}
      {isDirectChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  New Direct Chat
                </h3>
                <p className="text-xs text-slate-500">Pick any colleague to start a private 1-on-1 conversation.</p>
              </div>
              <button
                onClick={() => setIsDirectChatModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userPickerSearch}
                  onChange={(e) => setUserPickerSearch(e.target.value)}
                  placeholder="Search by name, role, email..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981]"
                />
              </div>
            </div>

            {/* Users list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
              {allUsers
                .filter(
                  (u) =>
                    u._id !== user?._id &&
                    (u.name?.toLowerCase().includes(userPickerSearch.toLowerCase()) ||
                      u.email?.toLowerCase().includes(userPickerSearch.toLowerCase()) ||
                      u.designationRole?.toLowerCase().includes(userPickerSearch.toLowerCase()))
                )
                .map((u) => {
                  const isOnline = onlineUsers.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      onClick={() => handleStartDirectChat(u)}
                      className="w-full p-3 rounded-2xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {u.profilePhoto ? (
                            <img
                              src={u.profilePhoto}
                              alt={u.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                              isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#10b981] transition-colors truncate">
                              {u.name}
                            </span>
                            {u.role && u.role !== "member" && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {u.role}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {u.designationRole || u.email}
                          </p>
                        </div>
                      </div>

                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold group-hover:bg-[#10b981] group-hover:text-slate-950 transition-all">
                        Chat
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create Community (Admin or Manager only)                           */}
      {/* ========================================================================= */}
      {isCreateCommunityOpen && (user?.role === "admin" || user?.role === "manager") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Create Group Community
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Launch a collaborative channel for a team, topic, or department.
                </p>
              </div>
              <button
                onClick={() => setIsCreateCommunityOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Role Notice Banner */}
            {user?.role === "manager" ? (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2.5 shrink-0">
                <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Manager Notice:</strong> Your community will be submitted to the <strong>Admin for approval</strong> before members can access and chat in it.
                </span>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2.5 shrink-0">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Admin Mode:</strong> This community will be <strong>active immediately</strong>.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateCommunitySubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Community Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  placeholder="e.g. Design Systems, Frontend Guild, Q3 Marketing..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                  placeholder="Briefly state the purpose of this community..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#10b981] resize-none"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Add Initial Members
                </label>
                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-2 space-y-1 bg-slate-50/50 dark:bg-slate-950/40">
                  {allUsers
                    .filter((u) => u._id !== user?._id)
                    .map((u) => {
                      const isChecked = selectedCommunityMembers.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedCommunityMembers((prev) =>
                                isChecked ? prev.filter((id) => id !== u._id) : [...prev, u._id]
                              );
                            }}
                            className="w-4 h-4 rounded text-[#10b981] focus:ring-[#10b981]"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateCommunityOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCommunity || !newCommunityName.trim()}
                  className="px-5 py-2 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-[#10b981]/20 transition-all cursor-pointer"
                >
                  {isCreatingCommunity
                    ? "Creating..."
                    : user?.role === "manager"
                    ? "Submit for Approval"
                    : "Create Community"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Add Member to Channel                                              */}
      {/* ========================================================================= */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Add People to {selectedRoom?.name}
              </h3>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800/50">
              {allUsers
                .filter((u) => !selectedRoom?.members?.some((m) => m._id === u._id))
                .map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleAddMember(u.email)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-xs">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className="p-1.5 text-slate-400 group-hover:text-[#10b981] group-hover:bg-[#10b981]/10 rounded-lg transition-colors">
                      <UserPlus size={16} />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL: Remove Member Confirmation                                         */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-2xl">
                <UserMinus size={22} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Remove Member</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to remove <strong>{userToDelete.name}</strong> from this channel?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatApp;