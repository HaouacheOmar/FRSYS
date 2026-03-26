import { useEffect, useRef } from 'react';

export function useAdminGuestPresenceWebSocket(onGuestsUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let reconnectTimeout;
    
    function connect() {
      // ✅ UPDATED: Dynamic WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new window.WebSocket(`${protocol}//${window.location.host}/ws/admin/notifications/`);
      
      wsRef.current = ws;
      ws.onopen = () => {
        // Optionally, send a ping or auth message
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'admin_notification' && data.event === 'guest_snapshot') {
            if (onGuestsUpdate) onGuestsUpdate(data.payload.online_guests);
          }
          if (data.type === 'admin_notification' && data.event === 'guest_presence') {
            if (onGuestsUpdate) onGuestsUpdate(data.payload.online_guests);
          }
        } catch {}
      };
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        ws.close();
      };
    }
    
    connect();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [onGuestsUpdate]);

  return wsRef;
}