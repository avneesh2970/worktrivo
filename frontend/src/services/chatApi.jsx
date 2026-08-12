import axios from "axios";
import { API_BASE } from "../context/AuthContext";

// Axios instance
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==============================
// Request Interceptor
// ==============================
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("task_tracker_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==============================
// Response Interceptor
// ==============================
apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      const message =
        error.response.data?.error ||
        error.response.data?.message ||
        "";

      // Auto logout if session is invalid
      if (
        message.includes("logged in from another device") ||
        message.includes("Authentication failed") ||
        message.includes("Invalid token") ||
        message.includes("Token missing")
      ) {
        localStorage.removeItem("task_tracker_token");
        localStorage.removeItem("user");

        if (window.location.pathname !== "/login") {
          alert(
            "Your session has expired or you have logged in from another device."
          );

          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(error);
  }
);

export const useChatApi = () => {
  return {
    // ---------------- Chat Rooms ----------------
    getChatRooms: async () =>
      (await apiClient.get("/chat/rooms")).data,

    createRoom: async (data) =>
      (await apiClient.post("/chat/rooms", data)).data,

    // ---------------- Messages ----------------
    getMessages: async (roomId) =>
      (await apiClient.get(`/chat/${roomId}/messages`)).data,

    sendMessage: async (data) =>
      (await apiClient.post("/chat/send", data)).data,

    sendMessageWithMentions: async (data) =>
      (await apiClient.post("/chat/messages", data)).data,

    // ---------------- Mention Search ----------------
    searchMentionUsers: async (roomId, query = "") =>
      (
        await apiClient.post("/chat/users/search", {
          roomId,
          query,
        })
      ).data,

    // ---------------- Room Members ----------------
    addMember: async (roomId, email) =>
      (
        await apiClient.post(`/chat/${roomId}/add-member`, {
          email,
        })
      ).data,

    removeMember: async (roomId, userId) =>
      (
        await apiClient.delete(
          `/chat/${roomId}/remove-member/${userId}`
        )
      ).data,

    // ---------------- Message Actions ----------------
    markMessageRead: async (messageId) =>
      (
        await apiClient.patch(`/chat/message/${messageId}/read`)
      ).data,

    editMessage: async (messageId, text) =>
      (
        await apiClient.patch(`/chat/message/${messageId}/edit`, {
          text,
        })
      ).data,

    pinMessage: async (messageId) =>
      (
        await apiClient.patch(`/chat/message/${messageId}/pin`)
      ).data,

    unpinMessage: async (messageId) =>
      (
        await apiClient.patch(`/chat/message/${messageId}/unpin`)
      ).data,

    deleteMessage: async (messageId) =>
      (
        await apiClient.delete(`/chat/message/${messageId}`)
      ).data,
  };
};