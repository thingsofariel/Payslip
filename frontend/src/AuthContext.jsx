// src/AuthContext.jsx
//
// Holds the logged-in employee + JWT in memory only (React state).
// Deliberately NOT persisted to localStorage/sessionStorage -- a
// refresh logs the person out, which is the right tradeoff for a
// payroll system over "stay logged in forever."

import { createContext, useContext, useState } from 'react';
import { api } from './api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function login(email, password) {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const data = await api.login(email, password);
      setToken(data.token);
      setEmployee(data.employee);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout() {
    setToken(null);
    setEmployee(null);
  }

  return (
    <AuthContext.Provider value={{ token, employee, login, logout, loginError, isLoggingIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
