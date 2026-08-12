import React, { createContext, useState, useEffect, useContext } from "react";

const AuthContext = createContext(null);

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const [token, setToken] = useState(
    localStorage.getItem("task_tracker_token") || null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ===========================
  // Logout
  // ===========================

  const logout = async (redirect = true) => {
    const currentToken = localStorage.getItem("task_tracker_token");

    // Record logout on server
    if (currentToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch (err) {
        console.error("Logout API Error:", err);
      }
    }

    // Clear local data
    localStorage.removeItem("task_tracker_token");
    localStorage.removeItem("user");

    setToken(null);
    setUser(null);
    setError(null);

    if (redirect) {
      window.location.replace("/login");
    }
  };

  // ===========================
  // Verify Current User
  // ===========================

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (
      response.status === 401 &&
      data.error?.includes("logged in from another device")
    ) {
      alert(
        "Your account has been logged in on another device. Please login again."
      );
    }

    await logout(false);
    return;
  }

  setUser(data.user);
} catch (err) {
  console.error("Failed to verify token:", err);
  await logout(false);
} finally {
  setLoading(false);
}
    };

    fetchMe();
  }, [token]);

  // ===========================
  // Email Login
  // ===========================

  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Authentication failed");
      }

      localStorage.setItem("task_tracker_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ===========================
  // Google Login
  // ===========================

  const googleLogin = async (credential) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: credential,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Google authentication failed.");
      }

      localStorage.setItem("task_tracker_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return data.user;
    } catch (err) {
      console.error("Google Auth Failed:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ===========================
  // Register
  // ===========================

  const register = async (name, email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role: "member",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Registration failed");
      }

      return await login(email, password);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        loading,
        error,
        login,
        googleLogin,
        register,
        logout,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};