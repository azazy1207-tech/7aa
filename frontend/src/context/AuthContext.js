import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${https://sevenaa.onrender.com}/api`;

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
