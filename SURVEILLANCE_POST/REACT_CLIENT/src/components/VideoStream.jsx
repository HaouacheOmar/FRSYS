import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import '../styles/VideoStream.css';

const VideoStream = () => {
  const { T } = useLang();
  const [ws, setWs] = useState(null);
  const [status, setStatus] = useState({ state: 'disconnected', message: T.disconnected });
  const [fps, setFps] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState('');
  const [frameCount, setFrameCount] = useState(0);
  const lastFpsUpdate = useRef(Date.now());
  const wsRef = useRef(null);

  // ✅ UPDATED: Dynamic WebSocket URL
  // This routes the WS request through the Vite Proxy so your cookies are securely attached!
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}/ws/video/stream/`;

  const updateStatus = (state, message) => {
    setStatus({ state, message });
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const updateFps = () => {
    setFrameCount(prev => {
      const count = prev + 1;
      const now = Date.now();
      const elapsed = now - lastFpsUpdate.current;

      if (elapsed >= 1000) {
        const currentFps = Math.round((count * 1000) / elapsed);
        setFps(currentFps);
        lastFpsUpdate.current = now;
        return 0;
      }
      return count;
    });
  };

  const handleMessage = (data) => {
    switch(data.type) {
      case 'frame':
        displayFrame(data);
        updateDetections(data.detections);
        updateFps();
        break;

      case 'error':
        showError(data.message);
        break;

      case 'connection':
      case 'status':
        console.log(data.message);
        break;

      case 'pong':
        // Keepalive acknowledgement
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const displayFrame = (data) => {
    const img = document.getElementById('videoFrame');
    if (img) {
      img.src = 'data:image/jpeg;base64,' + data.image;
    }
  };

  const updateDetections = (detectionData) => {
    if (!Array.isArray(detectionData)) {
      setFaceCount(0);
      setDetections([]);
      return;
    }

    setFaceCount(detectionData.length);
    setDetections(detectionData);
  };

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(T.alreadyConnected);
      return;
    }

    updateStatus('connecting', T.connecting);

    try {
      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        updateStatus('connected', T.connected);
        websocket.send(JSON.stringify({ type: 'start' }));
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showError(T.websocketErrorOccurred);
      };

      websocket.onclose = () => {
        console.log('WebSocket closed');
        updateStatus('disconnected', T.disconnected);
        wsRef.current = null;
        setWs(null);
      };

      wsRef.current = websocket;
      setWs(websocket);
    } catch (e) {
      console.error('Error creating WebSocket:', e);
      showError(T.websocketConnectionFailed);
      updateStatus('disconnected', T.disconnected);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
    }
    updateStatus('disconnected', T.disconnected);
  };

  useEffect(() => {
    // Keep connection alive with periodic ping
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const renderDetectionItem = (det, index) => {
    // Handle error
    if (det.error) {
      return (
        <div key={index} className="detection-item no-match">
          <strong>{T.face} {index + 1}:</strong> {T.errorLabel}<br />
          <small>{det.error}</small>
        </div>
      );
    }

    // Handle detected person with full info
    if (det.matricule && det.nom && det.prenom) {
      const status = det.status || 'UNKNOWN';
      const statusClass = status.includes('ELIGIBLE') ? '' : 'no-match';
      const compagnie = det.compagnie || 'N/A';
      return (
        <div key={index} className={`detection-item ${statusClass}`}>
          <strong>{T.face} {index + 1}:</strong> {det.prenom} {det.nom}<br />
          <small>{T.matricule}: {det.matricule} | {T.company}: {compagnie} | {T.statusLabel}: {status}</small>
        </div>
      );
    }

    // Handle partial info
    if (det.nom && det.prenom) {
      const status = det.status || 'UNKNOWN';
      const statusClass = status.includes('ELIGIBLE') ? '' : 'no-match';
      return (
        <div key={index} className={`detection-item ${statusClass}`}>
          <strong>{T.face} {index + 1}:</strong> {det.prenom} {det.nom}<br />
          <small>{T.statusLabel}: {status}</small>
        </div>
      );
    }

    // Handle label from box
    if (det.label) {
      return (
        <div key={index} className="detection-item">
          <strong>{T.face} {index + 1}:</strong> {det.label}
        </div>
      );
    }

    // Fallback
    return (
      <div key={index} className="detection-item">
        <strong>{T.face} {index + 1}:</strong> {T.dataUnavailable}
      </div>
    );
  };

  return (
    <div className="container">
      <h1>{T.videoStreamTitle}</h1>

      <div className={`status ${status.state}`}>
        {status.message}
      </div>

      {error && (
        <div className="error">
          {T.errorPrefix}: {error}
        </div>
      )}

      <div className="controls">
        <button className="connect-btn" onClick={connectWebSocket}>
          {T.connect}
        </button>
        <button className="disconnect-btn" onClick={disconnectWebSocket}>
          {T.disconnect}
        </button>
      </div>

      <div className="video-container">
        <img id="videoFrame" src="" alt={T.videoStreamTitle} />
      </div>

      <div className="info">
        {T.fpsLabel}: <span>{fps}</span> | {T.facesDetectedLabel}: <span>{faceCount}</span>
      </div>

      <div className="detections">
        <h3>{T.detectionsTitle}:</h3>
        <div className="detections-list">
          {detections.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center' }}>{T.noFacesText}</p>
          ) : (
            detections.map((det, index) => renderDetectionItem(det, index))
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoStream;