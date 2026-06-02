// Utility: login + presence websocket helper
// Adjust API endpoints to match your backend.

// Example login that accepts credentials and returns access token (if server returns JSON)
export async function apiLogin({ username, password }) {
  const res = await fetch('/api/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // important if server sets HttpOnly cookie
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error('Login failed');

  // If your server sets a cookie, nothing more needed.
  // If server returns JSON tokens, parse and return them.
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Open presence websocket.
export function openPresenceSocket({ accessToken = null, onMessage, onOpen, onClose, onError }) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const originHost = window.location.host;
  let url = `${protocol}://${originHost}/ws/presence/guest/`;
  if (accessToken) {
    const qs = new URLSearchParams({ token: accessToken });
    url += `?${qs.toString()}`;
  }

  const ws = new WebSocket(url);

  ws.onopen = (e) => {
    if (onOpen) onOpen(e);
  };

  ws.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      if (onMessage) onMessage(payload);
    } catch (err) {
      if (onMessage) onMessage(ev.data);
    }
  };

  ws.onclose = (e) => {
    if (onClose) onClose(e);
  };

  ws.onerror = (e) => {
    if (onError) onError(e);
  };

  return ws;
}

// React hook example
import { useEffect, useRef } from 'react';

export function usePresence({ accessToken = null, handlers = {} }) {
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = openPresenceSocket({ accessToken, ...handlers });
    return () => {
      try { wsRef.current && wsRef.current.close(); } catch(e) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return wsRef;
}
