import React, { useEffect, useRef, useState } from "react";
import { useChatApi } from '../services/chatApi';

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
} from "lucide-react";




import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { API_BASE } from "../context/AuthContext";

const ChatApp = () => {

    const {
        getChatRooms,
        getMessages,
        addMember,
        removeMember,
        unpinMessage,
        sendMessageWithMentions,
        searchMentionUsers,
    } = useChatApi();


    const { user, token } = useAuth();
    const {
        pinMessage,
        messages,
        setMessages,
        joinRoom,
        leaveRoom,
        startTyping,
        stopTyping,
        editMessage,
        deleteMessage,
        onlineUsers = [],
        typingUsers = [],
    } = useSocket();

    // UI States
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [text, setText] = useState("");
    const [mentionSuggestions, setMentionSuggestions] = useState([]);
    const [mentionedUsers, setMentionedUsers] = useState([]);
    const [showMentionBox, setShowMentionBox] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [activePinnedIndex, setActivePinnedIndex] = useState(0);
    const [showSidebarMobile, setShowSidebarMobile] = useState(false);

    // Modal & Action Confirmation States
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [msgToDelete, setMsgToDelete] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [toastMessage, setToastMessage] = useState(null);

    // Refs — these MUST live inside the component, not at module scope
    const bottomRef = useRef(null);
    const typingTimeout = useRef(null);
    const toastTimeout = useRef(null);
    const mentionRequestId = useRef(0);

    const TARGET_ROOM_ID = "6a673c7413146dfc8952c40c";

    // Toast helper
    const showToast = (msg, type = "info") => {
        setToastMessage({ msg, type });
        clearTimeout(toastTimeout.current);
        toastTimeout.current = setTimeout(() => setToastMessage(null), 3000);
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        loadRooms();
    }, []);

    // Cleanup any pending timers on unmount
    useEffect(() => {
        return () => {
            clearTimeout(typingTimeout.current);
            clearTimeout(toastTimeout.current);
        };
    }, []);

    const loadRooms = async () => {
        try {
            const res = await getChatRooms();
            const filteredData = (res.data || []).filter(
                (room) => room._id === TARGET_ROOM_ID
            );
            setRooms(filteredData);
            if (filteredData.length > 0) setSelectedRoom(filteredData[0]);
        } catch (err) {
            console.error(err);
            showToast("Failed to load chat room", "error");
        }
    };

    const formatMessageDate = (date) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date();

        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return "Today";
        }

        if (d.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        return d.toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const handleRemoveMember = async () => {
        if (!userToDelete) return;
        try {
            await removeMember(selectedRoom._id, userToDelete._id);
            await loadRooms();
            showToast(`${userToDelete.name} removed from room`, "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to remove member", "error");
        } finally {
            setUserToDelete(null);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setUsersList(Array.isArray(data) ? data.filter((u) => u.active) : []);
        } catch (err) {
            console.error("Error fetching users:", err);
            showToast("Could not load users", "error");
        }
    };

    const handleOpenAddMember = () => {
        fetchUsers();
        setIsAddMemberOpen(true);
    };

    const handleAddMember = async (email) => {
        if (!selectedRoom) return;
        try {
            await addMember(selectedRoom._id, email);
            showToast("Member added successfully!", "success");
            setIsAddMemberOpen(false);
            loadRooms();
        } catch (err) {
            console.error(err);
            showToast("Failed to add member.", "error");
        }
    };

    useEffect(() => {
        if (!selectedRoom) return;
        loadMessages(selectedRoom._id);
        joinRoom(selectedRoom._id);
        return () => leaveRoom(selectedRoom._id);
    }, [selectedRoom]);

    const loadMessages = async (roomId) => {
        try {
            const res = await getMessages(roomId);
            setMessages(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSend = async () => {
        if (!text.trim()) return;

        try {
            await sendMessageWithMentions({
                chatRoom: selectedRoom._id,
                text,
                attachments: [],
                mentions: mentionedUsers.map((u) => u._id),
                replyTo: null,
            });

            setText("");
            setMentionedUsers([]);
            setMentionSuggestions([]);
            setShowMentionBox(false);

            clearTimeout(typingTimeout.current);
            stopTyping(selectedRoom._id);
        } catch (err) {
            console.error(err);
            showToast("Failed to send message", "error");
        }
    };

    const handleEdit = (msg) => {
        setEditingId(msg._id);
        setEditingText(msg.text);
    };

    const saveEdit = () => {
        if (!editingText.trim()) return;
        editMessage(editingId, editingText);
        setEditingId(null);
        setEditingText("");
        showToast("Message updated", "info");
    };

    const confirmDeleteMessage = () => {
        if (!msgToDelete) return;
        deleteMessage(msgToDelete);
        setMsgToDelete(null);
        showToast("Message deleted", "info");
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

    const selectMention = (mentionUser) => {
        setText((prev) =>
            prev.replace(/@[a-zA-Z0-9_]*$/, `@${mentionUser.name} `)
        );

        setMentionedUsers((prev) => {
            if (prev.some((u) => u._id === mentionUser._id)) return prev;
            return [...prev, mentionUser];
        });

        setMentionSuggestions([]);
        setShowMentionBox(false);
    };

    // Wired up: handles typing indicator + live @mention search
    const handleTyping = async (e) => {
        const value = e.target.value;
        setText(value);

        if (!selectedRoom) return;

        if (value.trim()) {
            startTyping(selectedRoom._id);

            clearTimeout(typingTimeout.current);

            typingTimeout.current = setTimeout(() => {
                stopTyping(selectedRoom._id);
            }, 1000);
        } else {
            clearTimeout(typingTimeout.current);
            stopTyping(selectedRoom._id);
        }

        // Mention search: trigger on a trailing "@query" fragment
        const match = value.match(/@([a-zA-Z0-9_]*)$/);

        if (match) {
            const query = match[1];
            const requestId = ++mentionRequestId.current;

            try {
                const res = await searchMentionUsers(query);

                // Ignore stale/out-of-order responses
                if (requestId !== mentionRequestId.current) return;

                const results = res?.data || [];
                setMentionSuggestions(results);
                setShowMentionBox(results.length > 0);
            } catch (err) {
                console.error("Mention search failed:", err);
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

    const renderMessage = (msg) => {
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
                            className="font-semibold text-[#dc9750] hover:text-emerald-300 transition-colors"
                        >
                            {mentionText}
                        </span>,
                    ];
                });
            });
        });

        return parts;
    };

    const formatTime = (date) =>
        new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const filteredUsers = usersList.filter(
        (u) =>
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pinnedMessages = messages.filter((m) => m.pinned && !m.deleted);
    const displayMessages = messages.filter((m) => !m.deleted);

    const scrollToMessage = (msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-[#dc9750]", "transition-all");
            setTimeout(() => el.classList.remove("ring-2", "ring-[#dc9750]"), 2000);
        }
    };

    const otherTypingUsers = typingUsers.filter(
        (name) => name !== user?.name
    );

    return (
        <div className="relative flex h-full w-full overflow-hidden bg-[#12151b]">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-md transition-all duration-300 ${toastMessage.type === "error"
                        ? "bg-rose-950/90 border-rose-800 text-rose-200"
                        : toastMessage.type === "success"
                            ? "bg-emerald-950/90 border-emerald-800 text-emerald-200"
                            : "bg-slate-900/90 border-slate-700 text-slate-200"
                        }`}
                >
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="truncate">{toastMessage.msg}</span>
                </div>
            )}

            {/* Remove Member Modal */}
            {userToDelete && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 transition-all">
                    <div className="bg-[#1c212b] border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-2.5 bg-rose-500/10 rounded-xl shrink-0">
                                <UserMinus size={22} />
                            </div>
                            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Remove Member</h3>
                        </div>
                        <p
                            className="
                            text-[13px]
                            sm:text-sm
                            leading-6
                            break-words
                            whitespace-pre-wrap
                            "
                        >
                            Are you sure you want to remove{" "}
                            <strong className="text-slate-200">{userToDelete.name}</strong> from this channel?
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setUserToDelete(null)}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 active:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRemoveMember}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Message Modal */}
            {msgToDelete && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 transition-all">
                    <div className="bg-[#1c212b] border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-2.5 bg-rose-500/10 rounded-xl shrink-0">
                                <Trash2 size={22} />
                            </div>
                            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Delete Message</h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            This message will be permanently removed for all members in this channel.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setMsgToDelete(null)}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 active:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteMessage}
                                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {isAddMemberOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                            <h3 className="font-semibold text-sm sm:text-base">Add People to Channel</h3>
                            <button
                                onClick={() => setIsAddMemberOpen(false)}
                                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
                            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 focus-within:border-[#dc9750]/80 px-3 transition-colors">
                                <Search size={18} className="text-slate-500 shrink-0" />
                                <input
                                    autoFocus
                                    placeholder="Search members by name or email..."
                                    className="w-full bg-transparent px-3 py-3 outline-none text-xs sm:text-sm text-slate-200 placeholder:text-slate-600"
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/30">
                            {filteredUsers.length === 0 ? (
                                <div className="text-center py-8 text-xs sm:text-sm text-slate-500">
                                    No active users found.
                                </div>
                            ) : (
                                filteredUsers.map((u) => (
                                    <button
                                        key={u._id}
                                        onClick={() => handleAddMember(u.email)}
                                        className="w-full p-3 hover:bg-slate-800/60 active:bg-slate-800/80 rounded-xl flex items-center justify-between transition-all group text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-[#dc9750]/20 text-[#dc9750] border border-[#dc9750]/30 flex items-center justify-center text-xs font-bold shrink-0">
                                                {u.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs sm:text-sm font-medium text-slate-200 group-hover:text-white truncate">
                                                    {u.name}
                                                </div>
                                                <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                                                    {u.email}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-2 text-slate-400 group-hover:text-[#dc9750] group-hover:bg-[#dc9750]/10 rounded-lg transition-colors shrink-0">
                                            <UserPlus size={18} />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Overlay for Mobile */}
            {showSidebarMobile && (
                <div
                    onClick={() => setShowSidebarMobile(false)}
                    className="
                        fixed
                        inset-0
                        bg-black/60
                        backdrop-blur-sm
                        z-30
                        lg:hidden
                        transition-all
                        duration-300
                        "
                />
            )}

            {/* Sidebar: Channel Members Drawer */}
            <aside
                className={`
                    fixed lg:relative
                    top-0 left-0
                    z-40 lg:z-auto
                    h-screen lg:h-full
                    w-[260px]
                    md:w-[280px]
                    lg:w-72
                    bg-[#171b23]
                    border-r border-[rgba(220,151,80,0.14)]
                    flex flex-col
                    shrink-0
                    lg:translate-x-0
                    transform
                    transition-transform
                    duration-300
                    ease-in-out
                    ${showSidebarMobile
                        ? "translate-x-0"
                        : "-translate-x-full lg:translate-x-0"
                    }
                `}
            >
                <div className="h-16 px-4 sm:px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50">
                    <div className="flex items-center gap-2.5">
                        <Users size={18} className="text-[#dc9750]" />
                        <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">
                            Channel Members
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                            {selectedRoom?.members?.length || 0}
                        </span>
                        {/* Mobile close button for sidebar */}
                        <button
                            onClick={() => setShowSidebarMobile(false)}
                            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                    {selectedRoom?.members?.map((member) => {
                        const isOnline = onlineUsers.includes(member._id);
                        return (
                            <div
                                key={member._id}
                                className="flex items-center justify-between p-3 sm:p-2.5 rounded-xl hover:bg-slate-800/50 active:bg-slate-800/80 transition-colors group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        <img
                                            src={
                                                member.profilePhoto ||
                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    member.name
                                                )}&background=1e1b4b&color=818cf8`
                                            }
                                            alt={member.name}
                                            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-700/60"
                                        />
                                        <div
                                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${isOnline ? "bg-emerald-500" : "bg-slate-600"
                                                }`}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-medium text-slate-200 truncate">
                                            {member.name}
                                            {(member.role === "admin" || member.role === "manager") && (
                                                <div className="text-[11px] sm:text-[12px] font-small text-yellow-400 truncate">
                                                    {member.role === "admin" ? "Admin" : "Manager"}
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className={`text-[10px] sm:text-[11px] ${isOnline ? "text-[#dc9750]/90" : "text-slate-500"
                                                }`}
                                        >
                                            {isOnline ? "Online" : "Offline"}
                                        </div>
                                    </div>
                                </div>

                                {(user?.role === "admin" || user?.role === "manager") && (
                                    <button
                                        onClick={() => setUserToDelete(member)}
                                        title="Remove from group"
                                        className="opacity-100 lg:opacity-0 group-hover:opacity-100 p-2 sm:p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex flex-col flex-1 h-full w-full bg-[#081225] relative min-w-0">
                {!selectedRoom ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-slate-500 gap-3 p-4">
                        <MessageSquareText
                            size={48}
                            className="stroke-[1.5] text-slate-700 animate-pulse"
                        />
                        <p className="text-xs sm:text-sm font-medium text-center">Connecting to workspace...</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <header
                            className="
                            sticky
                            top-0
                            z-20
                            h-16

                            border-b
                            border-[rgba(220,151,80,0.14)]

                            px-3
                            sm:px-4
                            lg:px-6

                            flex
                            justify-between
                            items-center

                            bg-[#14181f]
                            backdrop-blur-xl
                            "
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <button
                                    onClick={() => setShowSidebarMobile(true)}
                                    className="lg:hidden p-2 hover:bg-slate-800 active:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
                                    title="Open Channel Members"
                                >
                                    <Users size={20} />
                                </button>
                                <div className="min-w-0">
                                    <h2 className="font-semibold text-sm sm:text-base text-slate-100 truncate">
                                        # {selectedRoom.name}
                                    </h2>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        {selectedRoom.members?.length || 0} participants
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleOpenAddMember}
                                className="
                                    flex
                                    items-center
                                    justify-center
                                    gap-2
                                    w-10
                                    h-10
                                    md:w-auto
                                    md:h-auto
                                    md:px-4
                                    md:py-2.5

                                    bg-[#dc9750]
                                    hover:bg-[#e8ac74]
                                    active:bg-[#b87a3d]

                                    text-[#241608]
                                    font-semibold

                                    rounded-xl

                                    shadow-lg
                                    shadow-[#dc9750]/25

                                    transition-all
                                    duration-300
                                    hover:scale-[1.03]
                                    active:scale-95

                                    shrink-0
                                    cursor-pointer
                                    "
                            >
                                <UserPlus size={17} strokeWidth={2.3} />

                                <span className="hidden md:inline">
                                    Add Member
                                </span>
                            </button>
                        </header>

                        {/* Pinned Messages Banner */}
                        {pinnedMessages.length > 0 && (
                            <div
                                className="
                                sticky
                                top-16
                                z-10
                                bg-[#171b23]
                                backdrop-blur-xl
                                border-b
                                border-[#dc9750]/20
                                px-4
                                py-2
                                flex
                                items-center
                                justify-between
                                gap-3
                                shadow-md
                                "
                            >
                                <div
                                    onClick={() =>
                                        scrollToMessage(
                                            pinnedMessages[activePinnedIndex % pinnedMessages.length]._id
                                        )
                                    }
                                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                                >
                                    <div className="p-1.5 bg-[#dc9750]/10 text-[#dc9750] rounded-lg shrink-0">
                                        <Pin size={15} className="rotate-45" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-[#dc9750] uppercase tracking-wider">
                                                Pinned ({pinnedMessages.length})
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-300 truncate font-medium group-hover:text-white transition-colors">
                                            <span className="text-slate-400 font-normal">
                                                {
                                                    pinnedMessages[
                                                        activePinnedIndex % pinnedMessages.length
                                                    ].sender?.name
                                                }
                                                :
                                            </span>{" "}
                                            {
                                                pinnedMessages[
                                                    activePinnedIndex % pinnedMessages.length
                                                ].text
                                            }
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    {pinnedMessages.length > 1 && (
                                        <div className="flex items-center border border-slate-800 rounded-lg bg-slate-950/50">
                                            <button
                                                onClick={() =>
                                                    setActivePinnedIndex((prev) =>
                                                        prev > 0 ? prev - 1 : pinnedMessages.length - 1
                                                    )
                                                }
                                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-l-lg transition-colors cursor-pointer"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setActivePinnedIndex((prev) => prev + 1)
                                                }
                                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-r-lg transition-colors cursor-pointer"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() =>
                                            handleUnpin(
                                                pinnedMessages[
                                                    activePinnedIndex % pinnedMessages.length
                                                ]._id
                                            )
                                        }
                                        title="Unpin message"
                                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Messages Scroll Container */}
                        <div
                            className="
                                flex-1
                                overflow-y-auto

                                px-2
                                sm:px-3
                                md:px-4
                                lg:px-5

                                pt-2
                                pb-3
                                sm:pb-4

                                space-y-3
                                sm:space-y-4

                                bg-[#081225]
                                "
                        >
                            {displayMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 p-4">
                                    <MessageSquareText size={32} />
                                    <p className="text-xs text-center">
                                        No messages yet. Start the conversation!
                                    </p>
                                </div>
                            ) : (
                                displayMessages.map((msg, index) => {
                                    const currentDate = new Date(msg.createdAt).toDateString();

                                    const previousDate =
                                        index > 0
                                            ? new Date(displayMessages[index - 1].createdAt).toDateString()
                                            : null;

                                    const mine = msg.sender?._id === user?._id;

                                    const showAvatar =
                                        !mine &&
                                        (index === 0 ||
                                            displayMessages[index - 1]?.sender?._id !==
                                            msg.sender?._id);

                                    return (
                                        <React.Fragment key={msg._id}>

                                            {/* Date Separator */}
                                            {currentDate !== previousDate && (
                                                <div className="flex justify-center my-4">
                                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium">
                                                        {formatMessageDate(msg.createdAt)}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Message */}
                                            <div
                                                id={`msg-${msg._id}`}
                                                className={`group relative flex items-end gap-2 w-full ${mine ? "justify-end" : "justify-start"
                                                    }`}
                                            >

                                                {/* Avatar */}
                                                {!mine && (
                                                    <div className="w-8 h-8 shrink-0 self-end">
                                                        {showAvatar && (
                                                            <img
                                                                src={
                                                                    msg.sender?.profilePhoto ||
                                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                                        msg.sender?.name || "U"
                                                                    )}&background=1e1b4b&color=818cf8`
                                                                }
                                                                alt={msg.sender?.name}
                                                                className="w-8 h-8 rounded-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                )}

                                                {/* Floating Toolbar */}
                                                <div
                                                    className={`absolute -top-3.5 z-20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-[#171b23] border border-[rgba(220,151,80,0.14)] rounded-lg p-1 flex items-center gap-1 shadow-lg ${mine ? "right-2" : "left-9"
                                                        }`}
                                                >
                                                    {user?.role !== "member" && (
                                                        <button
                                                            onClick={() => pinMessage(msg._id)}
                                                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-[#dc9750] rounded cursor-pointer"
                                                        >
                                                            <Pin size={13} className="rotate-45" />
                                                        </button>
                                                    )}

                                                    {mine && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(msg)}
                                                                className="p-1 hover:bg-[#1A2A4C] text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>

                                                            <button
                                                                onClick={() => setMsgToDelete(msg._id)}
                                                                className="p-1 hover:bg-[#1A2A4C] text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Bubble */}
                                                <div
                                                    className={`

                                                    max-w-[85%]
                                                    sm:max-w-[80%]
                                                    md:max-w-[72%]
                                                    xl:max-w-[65%]

                                                    rounded-2xl
                                                    p-3
                                                    sm:p-3.5
                                                    relative
                                                    transition-all

                                                    ${mine
                                                            ? "bg-[#b87a3d] text-white rounded-br-xs shadow-md shadow-[#c4823f]/10"
                                                            : "bg-[#1c212b] border border-[rgba(220,151,80,0.14)] text-slate-200 rounded-bl-xs"
                                                        }
                                                `}
                                                >

                                                    {/* Pinned */}
                                                    {msg.pinned && (
                                                        <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium mb-1">
                                                            <Pin
                                                                size={11}
                                                                className="rotate-45 fill-amber-400"
                                                            />
                                                            <span>Pinned</span>
                                                        </div>
                                                    )}

                                                    {/* Sender */}
                                                    {!mine && showAvatar && (
                                                        <div className="text-xs font-semibold text-[#dc9750] mb-1">
                                                            {msg.sender?.name}
                                                        </div>
                                                    )}

                                                    {/* Edit */}
                                                    {editingId === msg._id ? (
                                                        <div className="space-y-2 mt-1">
                                                            <textarea
                                                                value={editingText}
                                                                onChange={(e) =>
                                                                    setEditingText(e.target.value)
                                                                }
                                                                className="w-full bg-slate-950/80 border border-[#dc9750]/50 rounded-lg p-2 text-xs text-white outline-none resize-none"
                                                                rows={2}
                                                            />

                                                            <div className="flex justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => setEditingId(null)}
                                                                    className="px-2.5 py-1 text-[10px] bg-slate-800 text-slate-300 rounded-md"
                                                                >
                                                                    Cancel
                                                                </button>

                                                                <button
                                                                    onClick={saveEdit}
                                                                    className="px-2.5 py-1 text-[10px] bg-[#dc9750] text-white rounded-md"
                                                                >
                                                                    Save
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[13px] sm:text-sm leading-6 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                                            {renderMessage(msg)}
                                                        </p>
                                                    )}

                                                    {/* Time */}
                                                    <div
                                                        className={`flex items-center justify-end gap-1 text-[11px] mt-2 ${mine
                                                            ? "text-[#f6dcb8]/80"
                                                            : "text-slate-500"
                                                            }`}
                                                    >
                                                        <span>{formatTime(msg.createdAt)}</span>

                                                        {mine && (
                                                            <CheckCheck
                                                                size={13}
                                                                className="text-[#dc9750]"
                                                            />
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

                        {/* Typing indicator */}
                        {otherTypingUsers.length > 0 && (
                            <div className="px-4 pb-1 text-[10px] sm:text-[11px] text-[#dc9750] italic">
                                {otherTypingUsers.join(", ")} typing...
                            </div>
                        )}

                        {/* Mention Suggestion Box */}
                        {showMentionBox && mentionSuggestions.length > 0 && (
                            <div className="mx-2 sm:mx-4 mb-2 bg-[#171b23] border border-[rgba(220,151,80,0.14)] rounded-xl max-h-52 overflow-y-auto">
                                {mentionSuggestions.map((mentionUser) => (
                                    <button
                                        key={mentionUser._id}
                                        onClick={() => selectMention(mentionUser)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-[#1A2A4C] text-left cursor-pointer"
                                    >
                                        <img
                                            src={
                                                mentionUser.profilePhoto ||
                                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    mentionUser.name
                                                )}`
                                            }
                                            alt={mentionUser.name}
                                            className="w-8 h-8 rounded-full"
                                        />

                                        <div>
                                            <div className="text-sm text-white">
                                                {mentionUser.name}
                                            </div>

                                            <div className="text-xs text-slate-400">
                                                {mentionUser.email}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Message Input Box */}
                        <footer
                            className="
                            sticky
                            bottom-0
                            z-20
                            px-2
                            py-2
                            sm:p-4
                            bg-[#14181f]
                            backdrop-blur-xl
                            border-t
                            border-[rgba(220,151,80,0.14)]
                            pb-[max(8px,env(safe-area-inset-bottom))]
                            "
                        >
                            <div className="
                                flex
                                items-center
                                gap-2
                                bg-[#0F1A32]
                                border
                                border-[rgba(220,151,80,0.14)]
                                focus-within:border-[#b87a3d]
                                rounded-2xl

                                px-2
                                py-2

                                sm:p-2

                                transition-all
                                shadow-inner
                                ">
                                <input
                                    type="text"
                                    value={text}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder={`Message #${selectedRoom?.name || "room"}...`}
                                    className="
                                        flex-1
                                        bg-transparent

                                        px-2
                                        sm:px-3

                                        py-2

                                        text-[14px]
                                        sm:text-sm

                                        text-slate-200

                                        outline-none

                                        placeholder:text-slate-600
                                        "
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!text.trim()}
                                    className="
                                        p-3
                                        sm:p-2.5

                                        bg-[#dc9750]
                                        hover:bg-[#e8ac74]
                                        active:bg-[#b87a3d]

                                        disabled:bg-slate-800
                                        disabled:text-slate-600

                                        text-[#241608]

                                        rounded-xl

                                        shadow-lg
                                        shadow-[#dc9750]/25

                                        transition-all
                                        duration-300
                                        hover:scale-105
                                        active:scale-95

                                        cursor-pointer
                                        shrink-0
                                    "
                                >
                                    <Send size={17} strokeWidth={2.4} />
                                </button>
                            </div>
                        </footer>
                    </>
                )}
            </main>
        </div>
    );
};

export default ChatApp;