import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authAPI, refreshSession, setAuthLostHandler, wsUrl } from '../services/api';

const AuthContext = createContext(null);
const SESSION_REFRESH_MS = 10 * 60 * 1000; // below ACCESS_TOKEN_LIFETIME (15 min) in settings.py
const PRESENCE_RETRY_MS = 5000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const guestPresenceSocketRef = useRef(null);
  const presenceRetryRef = useRef(null);

  const closeGuestPresenceSocket = () => {
    clearTimeout(presenceRetryRef.current);
    const socket = guestPresenceSocketRef.current;
    // Clear the ref first: onclose treats "still current" as an unexpected drop and reconnects.
    guestPresenceSocketRef.current = null;
    if (socket) socket.close();
  };

  const connectGuestPresenceSocket = () => {
    if (!user || user.role !== 'guest') {
      closeGuestPresenceSocket();
      return;
    }
    if (guestPresenceSocketRef.current && guestPresenceSocketRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket(wsUrl('/ws/presence/guest/'));
    let pingInterval;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'ping' }));
      // Keep the connection alive and verify presence
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);
    };
    socket.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (guestPresenceSocketRef.current !== socket) return; // closed on purpose
      // Server restart / network blip: without this the guest shows offline to admins
      // until they reload the page.
      guestPresenceSocketRef.current = null;
      presenceRetryRef.current = setTimeout(connectGuestPresenceSocket, PRESENCE_RETRY_MS);
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

  // Any API call whose 401 can't be fixed by a refresh ends the session.
  useEffect(() => {
    setAuthLostHandler(() => {
      closeGuestPresenceSocket();
      setUser(null);
    });
    return () => setAuthLostHandler(() => {});
  }, []);

  // Access token lives 15 min. WebSockets only send the cookie on connect and never
  // see a 401, so refresh proactively while logged in.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    const timer = setInterval(async () => {
      if (!(await refreshSession())) {
        closeGuestPresenceSocket();
        setUser(null);
      }
    }, SESSION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [userId]);

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
