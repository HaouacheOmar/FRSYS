import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const guestPresenceSocketRef = useRef(null);

  const closeGuestPresenceSocket = () => {
    if (guestPresenceSocketRef.current) {
      guestPresenceSocketRef.current.close();
      guestPresenceSocketRef.current = null;
    }
  };

  const connectGuestPresenceSocket = () => {
    if (!user || user.role !== 'guest') {
      closeGuestPresenceSocket();
      return;
    }
    if (guestPresenceSocketRef.current && guestPresenceSocketRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sameOriginWsBase = typeof window !== 'undefined' ? `${protocol}//${window.location.host}` : '';
    const configuredWsBase = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' && window.REACT_APP_WS_URL) || '';
    const wsBase = import.meta.env.DEV ? sameOriginWsBase : configuredWsBase || sameOriginWsBase;

    console.log('Connecting to guest presence WebSocket at:', wsBase);
    const socket = new WebSocket(`${wsBase.replace(/\/$/, '')}/ws/presence/guest/`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'ping' }));
    };
    socket.onclose = () => {
      guestPresenceSocketRef.current = null;
    };

    guestPresenceSocketRef.current = socket;
  };

  const loadCurrentUser = async () => {
    try {
      // Bootstrap auth from refresh token first to avoid noisy /me 401 on cold starts.
      await authAPI.refresh();
      const payload = await authAPI.me();
      setUser(payload?.user || null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    connectGuestPresenceSocket();
    return () => {
      closeGuestPresenceSocket();
    };
  }, [user?.id, user?.role]);

  const login = async (username, password) => {
    const payload = await authAPI.login({ username, password });
    setUser(payload?.user || null);
    return payload?.user || null;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } finally {
      closeGuestPresenceSocket();
      setUser(null);
    }
  };

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    reloadUser: loadCurrentUser,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};
