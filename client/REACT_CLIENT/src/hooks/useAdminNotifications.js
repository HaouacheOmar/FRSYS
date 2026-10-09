import { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../services/api';

// Admin live guest-presence socket (/ws/admin/notifications/), used by Home and AccessControl.
// onEvent(event, payload) gets 'guest_snapshot' | 'guest_online' | 'guest_offline'.
// Returns the socket state: 'disconnected' | 'connecting' | 'connected' | 'error'.
export const useAdminNotifications = ({ enabled, onEvent }) => {
  const [socketState, setSocketState] = useState(null); // null = no event since connecting
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = new WebSocket(wsUrl('/ws/admin/notifications/'));
    socket.onopen = () => {
      setSocketState('connected');
      socket.send(JSON.stringify({ type: 'ping' }));
    };
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // ignore malformed messages
      }
      if (data.type === 'admin_notification') onEventRef.current(data.event, data.payload || {});
    };
    socket.onerror = () => setSocketState('error');
    socket.onclose = () => setSocketState((state) => (state === 'error' ? state : 'disconnected'));
    return () => {
      socket.onclose = null; // unmount/disable: not a state change worth rendering
      socket.close();
      setSocketState(null);
    };
  }, [enabled]);

  if (!enabled) return 'disconnected';
  return socketState ?? 'connecting';
};
