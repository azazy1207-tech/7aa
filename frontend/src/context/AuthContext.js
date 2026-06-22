import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem("session_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/auth/me`, { headers, withCredentials: true });
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    const t = localStorage.getItem("admin_token");
    if (!t) return setAdmin(null);
    try {
      const res = await axios.get(`${API}/admin/me`, { headers: { Authorization: `Bearer ${t}` } });
      setAdmin(res.data);
    } catch {
      localStorage.removeItem("admin_token");
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
    checkAdmin();
  }, [checkAuth, checkAdmin]);

  const loginGuest = async (name) => {
    const res = await axios.post(`${API}/auth/guest`, { name }, { withCredentials: true });
    localStorage.setItem("session_token", res.data.session_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginPhone = async (name, phone) => {
    const res = await axios.post(`${API}/auth/phone`, { name, phone }, { withCredentials: true });
    localStorage.setItem("session_token", res.data.session_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const processGoogleSession = async (session_id) => {
    const res = await axios.post(
      `${API}/auth/google/session`,
      { session_id },
      { withCredentials: true }
    );
    localStorage.setItem("session_token", res.data.session_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    const token = localStorage.getItem("session_token");
    try {
      await axios.post(
        `${API}/auth/logout`,
        {},
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
        }
      );
    } catch (_) {
      // ignore logout errors
    }
    localStorage.removeItem("session_token");
    setUser(null);
  };

  const adminLogin = async (email, password) => {
    const res = await axios.post(`${API}/admin/login`, { email, password });
    localStorage.setItem("admin_token", res.data.token);
    setAdmin({ email: res.data.email, role: "admin" });
    return res.data;
  };

  const adminLogout = () => {
    localStorage.removeItem("admin_token");
    setAdmin(null);
  };

  const authHeaders = () => {
    const t = localStorage.getItem("session_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const adminHeaders = () => {
    const t = localStorage.getItem("admin_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        loading,
        loginGuest,
        loginPhone,
        loginGoogle,
        processGoogleSession,
        logout,
        adminLogin,
        adminLogout,
        authHeaders,
        adminHeaders,
        refresh: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
