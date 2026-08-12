import axios from "axios";
import { API_BASE } from "../context/AuthContext";

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("task_tracker_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const useLoginActivityApi = () => {
  return {
    /**
     * Admin / Manager
     * Get all login activities
     */
    getLoginActivities: async (
      page = 1,
      limit = 20,
      search = "",
      action = ""
    ) => {
      return (
        await apiClient.get("/login-activity", {
          params: {
            page,
            limit,
            search,
            action,
          },
        })
      ).data;
    },

    /**
     * Logged-in User
     * Get own login history
     */
    getMyLoginActivities: async () =>
      (await apiClient.get("/login-activity/me")).data,

    /**
     * Admin Only
     * Clear all activity logs
     */
    clearLoginActivities: async () =>
      (await apiClient.delete("/login-activity")).data,
  };
};