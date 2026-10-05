import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export const AuthContext = createContext({ user: null, loading: true });

// Asks the server who is logged in (an empty /profile response means nobody)
export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    axios.get('/profile')
      .then((response) => {
        const data = response.data || {};
        setState({
          user: data.user_name
            ? { id: data.user_id, name: data.user_name, celiac_mode: !!data.celiac_mode, celiac_strict: !!data.celiac_strict }
            : null,
          loading: false
        });
      })
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  // Applies changed settings (e.g. Celiac Mode) without reloading the profile
  const updateUser = useCallback((fields) => {
    setState((current) => (current.user ? { ...current, user: { ...current.user, ...fields } } : current));
  }, []);

  return <AuthContext.Provider value={{ ...state, updateUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

// In production Netlify proxies /auth to the Render API; in dev the API runs on :8080
export const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';
export const LOGIN_URL = `${API_BASE}/auth/google`;
export const LOGOUT_URL = `${API_BASE}/auth/logout`;
