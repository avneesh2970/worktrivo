import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth, API_BASE } from "./AuthContext";

export const SocketContext = createContext(null);

/**
 * Dispatches a native device notification.
 * On mobile/phones (Android/iOS PWA), standard `new Notification(...)` constructor is blocked
 * and throws TypeError or fails silently. The standard mobile way is `serviceWorkerRegistration.showNotification(...)`.
 */
export const triggerSystemNotification = (title, options = {}) => {
  if (typeof window === "undefined") return;

  // 1. Play subtle audio ping
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (audioErr) {
    // AudioContext might require prior user gesture
  }

  // 2. Hardware vibration (Android phones)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([180, 80, 180]);
    } catch (vibErr) {}
  }

  // 3. System Notification (ServiceWorker on Mobile vs Desktop fallback)
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notifOptions = {
    icon: "/siteicon.png",
    badge: "/siteicon.png",
    vibrate: [200, 100, 200],
    renotify: true,
    tag: options.tag || "worktrivo-alert",
    ...options,
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        if (registration && registration.showNotification) {
          return registration.showNotification(title, notifOptions);
        }
        return new Notification(title, notifOptions);
      })
      .catch(() => {
        try {
          new Notification(title, notifOptions);
        } catch (e) {}
      });
  } else {
    try {
      new Notification(title, notifOptions);
    } catch (e) {}
  }
};

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();

  const [socket, setSocket] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [mentionNotifications, setMentionNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const [messages, setMessages] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  // Register service worker for mobile notifications
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("WorkTrivo ServiceWorker registered for mobile notifications:", reg.scope);
        })
        .catch((err) => {
          console.warn("ServiceWorker registration failed:", err.message);
        });
    }
  }, []);

  // Request browser/phone notification permissions explicitly
  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch (err) {
      console.warn("Notification permission request error:", err);
      return "default";
    }
  };

  // ---------------- Notifications ----------------

  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (token && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => setNotificationPermission(p)).catch(() => {});
      }
    }
  }, [token]);

  // ---------------- Socket ----------------

  const resolveSocketUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
    if (import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE.replace(/\/api\/?$/, "");
    }
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
      return window.location.origin;
    }
    return "http://localhost:5000";
  };

  useEffect(() => {
    if (!token || !user) {
      socket?.disconnect();
      setSocket(null);
      return;
    }

    const socketUrl = resolveSocketUrl();

    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket Connected to:", socketUrl);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });

    // ---------------- Notifications ----------------

    newSocket.on("notification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      const title =
        notification.type === "chat"
          ? "New Chat Message"
          : notification.type === "report"
          ? "Daily Report Update"
          : "WorkTrivo Notification";

      triggerSystemNotification(title, {
        body: notification.message || "You have a new update in WorkTrivo.",
        tag: `notif-${notification._id || Date.now()}`,
        data: { url: notification.link || "/" },
      });
    });

    newSocket.on("room_read", (data) => {
      window.dispatchEvent(new CustomEvent("room_read", { detail: data }));
    });

    newSocket.on("projectUpdated", () => {
      window.dispatchEvent(new Event("refreshProjects"));
    });

    // ---------------- Real-time Daily Reports ----------------
    newSocket.on("dailyReportUpdated", (payload) => {
      console.log("Received real-time dailyReportUpdated:", payload);
      window.dispatchEvent(
        new CustomEvent("refreshDailyReports", { detail: payload })
      );
    });

    newSocket.on("taskUpdated", (payload) => {
      window.dispatchEvent(
        new CustomEvent("refreshTasks", { detail: payload })
      );
    });

    // ---------------- Messages ----------------

    newSocket.on("receive_message", (message) => {
      console.log("Received socket message:", message);
      window.dispatchEvent(
        new CustomEvent("new_chat_message", { detail: message })
      );
      setMessages((prev) => {
        const exists = prev.some((m) => m._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });

      // If message is from someone else and window/chat is not active, trigger notification
      const senderId = message?.sender?._id || message?.sender;
      if (senderId && user?._id && senderId.toString() !== user._id.toString()) {
        const senderName = message?.sender?.name || "New Message";
        const bodyPreview = message?.text || (message?.attachments?.length ? "📎 Sent an attachment" : "Sent a message");
        triggerSystemNotification(`💬 ${senderName}`, {
          body: bodyPreview,
          tag: `chat-msg-${message._id}`,
          data: { url: `/chat` },
        });
      }
    });

    newSocket.on("message_updated", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        )
      );
    });

    newSocket.on("message_deleted", ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((msg) => msg._id !== messageId)
      );
    });

    newSocket.on("message_pinned", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        )
      );
    });

    newSocket.on("message_unpinned", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        )
      );
    });

    // ---------------- Mention ----------------

    newSocket.on("mentioned", (data) => {
      setMentionNotifications((prev) => [data, ...prev]);

      triggerSystemNotification(`@${data.senderName} mentioned you`, {
        body: data.message?.text || "You were mentioned in a conversation.",
        tag: `mention-${Date.now()}`,
        data: { url: `/chat` },
      });
    });

    // ---------------- Presence ----------------

    newSocket.on("user_online", ({ userId }) => {
      setOnlineUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    });

    newSocket.on("user_offline", ({ userId }) => {
      setOnlineUsers((prev) =>
        prev.filter((id) => id !== userId)
      );
    });

    // ---------------- Typing ----------------

    newSocket.on("typing", ({ user: typingUser }) => {
      setTypingUsers((prev) =>
        prev.includes(typingUser)
          ? prev
          : [...prev, typingUser]
      );
    });

    newSocket.on("stop_typing", ({ user: typingUser }) => {
      setTypingUsers((prev) =>
        prev.filter((name) => name !== typingUser)
      );
    });

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, [token, user]);

  // ---------------- Notification APIs ----------------

  const markAllAsRead = async () => {
    if (!token) return;

    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
        }))
      );

      setUnreadCount(0);
    }
  };

  const markAsRead = async (id) => {
    if (!token) return;

    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, read: true } : n
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const deleteNotification = async (id) => {
    if (!token) return;

    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const notification = notifications.find((n) => n._id === id);

      setNotifications((prev) =>
        prev.filter((n) => n._id !== id)
      );

      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const clearAllNotifications = async () => {
    if (!token) return;

    const res = await fetch(`${API_BASE}/notifications`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      setNotifications([]);
      setMentionNotifications([]);
      setUnreadCount(0);
    }
  };

  // ---------------- Socket Emitters ----------------

  const joinRoom = (roomId) => socket?.emit("join_room", roomId);

  const leaveRoom = (roomId) => socket?.emit("leave_room", roomId);

  const sendMessage = (data) => socket?.emit("send_message", data);

  const startTyping = (roomId) =>
    socket?.emit("typing", {
      roomId,
      user: user?.name,
    });

  const stopTyping = (roomId) =>
  socket?.emit("stop_typing", {
    roomId,
    user: user?.name,
  });

  const markMessageRead = (messageId) =>
    socket?.emit("mark_read", {
      messageId,
    });

  const editMessage = (messageId, text) =>
    socket?.emit("edit_message", {
      messageId,
      text,
    });

  const deleteMessage = (messageId) =>
    socket?.emit("delete_message", {
      messageId,
    });

  const pinMessage = (messageId) =>
    socket?.emit("pin_message", {
      messageId,
    });

  const unpinMessage = (messageId) =>
    socket?.emit("unpin_message", {
      messageId,
    });

  return (
    <SocketContext.Provider
      value={{
        socket,

        notifications,
        mentionNotifications,

        unreadCount,

        fetchNotifications,
        markAllAsRead,
        markAsRead,
        deleteNotification,
        clearAllNotifications,

        messages,
        setMessages,

        onlineUsers,
        typingUsers,

        joinRoom,
        leaveRoom,
        sendMessage,

        startTyping,
        stopTyping,

        markMessageRead,
        editMessage,
        deleteMessage,

        pinMessage,
        unpinMessage,

        setMentionNotifications,

        notificationPermission,
        requestNotificationPermission,
        triggerSystemNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      "useSocket must be used within a SocketProvider"
    );
  }

  return context;
};