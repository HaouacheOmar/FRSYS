// Utility: login + presence websocket helper
// Adjust API endpoints to match your backend.

// Example login that accepts credentials and returns access token (if server returns JSON)
export async function apiLogin({ username, password }) {
  const res = await fetch('http://192.168.1.105:8000/api/auth/login/', {
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

// Open presence websocket. If cookies are used, set url without token and ensure cookies sent
// If cross-site cookies are not available, pass `accessToken` to use query-param fallback.
export function openPresenceSocket({ host = '192.168.1.105', port = 8000, accessToken = null, onMessage, onOpen, onClose, onError }) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const originHost = `${host}:${port}`;
  let url = `${protocol}://${originHost}/ws/presence/guest/`;
  if (accessToken) {
    const qs = new URLSearchParams({ token: accessToken });
    url += `?${qs.toString()}`;
  }

  const ws = new WebSocket(url);

  ws.onopen = (e) => {
    if (onOpen) onOpen(e);
    // optional: send hello or auth ping
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

// React hook example (very small)
import { useEffect, useRef } from 'react';

export function usePresence({ accessToken = null, host = '192.168.1.105', port = 8000, handlers = {} }) {
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = openPresenceSocket({ host, port, accessToken, ...handlers });
    return () => {
      try { wsRef.current && wsRef.current.close(); } catch(e) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, host, port]);

  return wsRef;
}
