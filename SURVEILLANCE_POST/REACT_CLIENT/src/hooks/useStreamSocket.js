import { useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LangContext';
import { wsUrl } from '../services/api';

const PING_MS = 30000;
const ERROR_MS = 5000;

// The live camera stream socket (/ws/video/stream/) shared by VideoStream, CheckIns and Rentrees.
// mode: 'checkin' | 'return' | undefined (plain viewing). onFrame(data) gets every 'frame'
// message; onStop() runs when the stream stops (user disconnect or socket closed).
export const useStreamSocket = ({ mode, onFrame, onStop } = {}) => {
  const { T } = useLang();
  const [state, setState] = useState('disconnected');
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const errorTimerRef = useRef(null);
  // Latest callbacks without reconnecting when the page re-renders.
  const handlersRef = useRef({ onFrame, onStop });
  useEffect(() => {
    handlersRef.current = { onFrame, onStop };
  });

  const showError = (message) => {
    setError(message);
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(''), ERROR_MS);
  };

  const stopped = () => {
    setState('disconnected');
    handlersRef.current.onStop?.();
  };

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setState('connecting');

    let socket;
    try {
      socket = new WebSocket(wsUrl('/ws/video/stream/'));
    } catch {
      showError(T.websocketConnectionFailed);
      setState('disconnected');
      return;
    }

    socket.onopen = () => {
      setState('connected');
      socket.send(JSON.stringify(mode ? { type: 'start', mode } : { type: 'start' }));
    };
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // ignore malformed messages
      }
      if (data.type === 'frame') handlersRef.current.onFrame?.(data);
      else if (data.type === 'error') showError(data.message);
    };
    socket.onerror = () => showError(T.websocketErrorOccurred);
    socket.onclose = () => {
      // A late close from a replaced (or unmounted) socket must not touch the current one.
      if (wsRef.current !== socket) return;
      wsRef.current = null;
      stopped();
    };
    wsRef.current = socket;
  };

  const disconnect = () => {
    const socket = wsRef.current;
    wsRef.current = null;
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
      socket.close();
    }
    stopped();
  };

  const toggle = () => {
    if (state === 'connected') disconnect();
    else if (state !== 'connecting') connect();
  };

  // Keepalive ping; close the socket and cancel timers when the page unmounts.
  useEffect(() => {
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_MS);
    return () => {
      clearInterval(ping);
      clearTimeout(errorTimerRef.current);
      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, []);

  const statusMessage = { connected: T.connected, connecting: T.connecting }[state] || T.disconnected;
  return { state, statusMessage, error, toggle };
};
