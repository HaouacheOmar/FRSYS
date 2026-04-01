// imports: react hooks, language translations, and styles
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import '../styles/VideoStream.css';

// video stream component: connects to a websocket, shows frames,
// displays detections and simple connection controls.
const VideoStream = () => {
  // translation helper
  const { T } = useLang();

  // websocket and ui state
  const [ws, setWs] = useState(null);
  const [status, setStatus] = useState({ state: 'disconnected', message: T.disconnected });
  const [fps, setFps] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState('');
  const [frameSrc, setFrameSrc] = useState(null);

  // frame counting for fps calculation
  const [frameCount, setFrameCount] = useState(0);
  const lastFpsUpdate = useRef(Date.now());

  // refs to keep websocket instance between renders
  const wsRef = useRef(null);

  // build ws url: in dev use same-origin (Vite proxy), in production use configured backend
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sameOriginWsBase = `${protocol}//${window.location.host}`;
  const configuredWsBase = import.meta.env.VITE_WS_URL || '';
  const WS_BASE = import.meta.env.DEV ? sameOriginWsBase : configuredWsBase || sameOriginWsBase;
  const WS_URL = `${WS_BASE.replace(/\/$/, '')}/ws/video/stream/`;

  // update connection status text shown in the ui
  const updateStatus = (state, message) => {
    setStatus({ state, message });
  };

  // show a transient error message for 5s
  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // increment frame counter and compute fps every ~1000ms
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

  // handle messages coming from the server via ws
  const handleMessage = (data) => {
    switch(data.type) {
      case 'frame':
        // image frame with optional detections
        displayFrame(data);
        updateDetections(data.detections);
        updateFps();
        break;

      case 'error':
        // server reported an error
        showError(data.message);
        break;

      case 'connection':
      case 'status':
        // informational messages
        console.log(data.message);
        break;

      case 'pong':
        // keepalive acknowledgement, ignore
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  // set frame data for render
  const displayFrame = (data) => {
    if (data?.image) {
      setFrameSrc('data:image/jpeg;base64,' + data.image);
    }
  };

  // normalize detections: ensure array, update count and list
  const updateDetections = (detectionData) => {
    if (!Array.isArray(detectionData)) {
      setFaceCount(0);
      setDetections([]);
      return;
    }

    setFaceCount(detectionData.length);
    setDetections(detectionData);
  };

  // open a websocket connection and wire event handlers
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log(T.alreadyConnected);
      return;
    }

    updateStatus('connecting', T.connecting);

    try {
      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        // notify server to start streaming frames
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
        // cleanup on close
        console.log('WebSocket closed');
        updateStatus('disconnected', T.disconnected);
        wsRef.current = null;
        setWs(null);
        setFrameSrc(null);
      };

      wsRef.current = websocket;
      setWs(websocket);
    } catch (e) {
      console.error('Error creating WebSocket:', e);
      showError(T.websocketConnectionFailed);
      updateStatus('disconnected', T.disconnected);
    }
  };

  // ask server to stop and then close the socket
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
    }
    updateStatus('disconnected', T.disconnected);
  };

  // keepalive ping every 30s and cleanup on unmount
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // cleanup when component unmounts
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // render a single detection box in the side panel
  const renderDetectionItem = (det, index) => {
    // error from server for this face
    if (det.error) {
      return (
        <div key={index} className="detection-item no-match">
          <strong>{T.face} {index + 1}:</strong> {T.errorLabel}<br />
          <small>{det.error}</small>
        </div>
      );
    }

    // full person info available: show name, matricule, company and status
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

    // partial info: name but no matricule
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

    // detection label provided by drawing code
    if (det.label) {
      return (
        <div key={index} className="detection-item">
          <strong>{T.face} {index + 1}:</strong> {det.label}
        </div>
      );
    }

    // fallback when no useful data available
    return (
      <div key={index} className="detection-item">
        <strong>{T.face} {index + 1}:</strong> {T.dataUnavailable}
      </div>
    );
  };

  // component ui
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
        <img id="videoFrame" src={frameSrc || undefined} alt={T.videoStreamTitle} />
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
