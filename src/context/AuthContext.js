import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext({ user: null, loading: true });

// Asks the server who is logged in (an empty /profile response means nobody)
export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    axios.get('/profile')
      .then((response) => {
        const name = response.data && response.data.user_name;
        setState({ user: name ? { name } : null, loading: false });
      })
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

// In production Netlify proxies /auth to the Render API; in dev the API runs on :8080
export const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';
export const LOGIN_URL = `${API_BASE}/auth/google`;
export const LOGOUT_URL = `${API_BASE}/auth/logout`;
