import axios from "axios";
import { API_BASE } from "../context/AuthContext";

// ==============================
// Axios Instance
// ==============================
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
            "Your session has expired or your account has been logged in from another device."
          );

          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(error);
  }
);

export const useFileApi = () => {
  return {
    /**
     * Upload File
     */
    uploadFile: async (taskId, file) => {
      const formData = new FormData();
      formData.append("file", file);

      return (
        await apiClient.post(
          `/files/upload/${taskId}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        )
      ).data;
    },

    /**
     * Get Files of a Task
     */
    getTaskFiles: async (taskId) =>
      (await apiClient.get(`/files/task/${taskId}`)).data,

    /**
     * Delete File
     */
    deleteFile: async (fileId) =>
      (await apiClient.delete(`/files/${fileId}`)).data,

    /**
     * Upload New Version
     */
    uploadNewVersion: async (
      fileId,
      file,
      changeLog = ""
    ) => {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("changeLog", changeLog);

      return (
        await apiClient.post(
          `/files/${fileId}/version`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        )
      ).data;
    },

    /**
     * Get Version History
     */
    getVersionHistory: async (fileId) =>
      (await apiClient.get(`/files/${fileId}/history`)).data,

    /**
     * Restore Previous Version
     */
    restoreVersion: async (
      fileId,
      versionId
    ) =>
      (
        await apiClient.post(
          `/files/${fileId}/restore/${versionId}`
        )
      ).data,

    /**
     * Open / Download File
     * Uses a programmatic anchor click instead of window.open() —
     * window.open() gets silently blocked by popup blockers when the
     * click happens through nested handlers (like inside this modal),
     * with no visible error. A real <a> click is not treated as a
     * popup by any browser, so this opens reliably every time.
     */
    openFile: (url) => {
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  }
};