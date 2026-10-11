/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from "react";
import { getMe, login, register, logout } from "./services/auth.api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkCurrentSession = async () => {
      try {
        const data = await getMe();
        if (isMounted && data && data.user) {
          setUser(data.user);
        }
      } catch {
        // Expected 401 when visitor has no existing session/cookie
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkCurrentSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async ({ email, password }) => {
    const data = await login({ email, password });
    if (data && data.user) {
      setUser(data.user);
    }
    return data;
  };

  const handleRegister = async ({ username, email, password }) => {
    const data = await register({ username, email, password });
    if (data && data.user) {
      setUser(data.user);
    }
    return data;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        setLoading,
        handleLogin,
        handleRegister,
        handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
