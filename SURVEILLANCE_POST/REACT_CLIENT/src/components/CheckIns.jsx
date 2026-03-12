import { useState, useEffect, useRef } from 'react';
import '../styles/CheckIns.css';
import verifiedStateSvg from '../assets/verified_state.svg';
import dontBelongStateSvg from '../assets/dont_belong_state.svg';
import inverifiedStateSvg from '../assets/inverified_state.svg';
import neutralStateSvg from '../assets/neutral_state.svg';

const CheckIns = () => {
  const [ws, setWs] = useState(null);
  const [status, setStatus] = useState({ state: 'disconnected', message: 'Disconnected' });
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  // WebSocket server URL - same as video stream
  const WS_URL = 'ws://localhost:8000/ws/video/stream/';

  const updateStatus = (state, message) => {
    setStatus({ state, message });
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const getDisplayStatus = (detection) => {
    const raw = String(detection?.status || '').toUpperCase();
    const label = String(detection?.label || '').toUpperCase();

    // Check-ins should not display return-state transitions.
    if (raw.includes('RETURNED') || label.includes('RETURNED')) {
      return 'IN SPECTACLE';
    }
    if (raw.includes('IN SPECTACLE') || label.includes('IN SPECTACLE')) {
      return 'IN SPECTACLE';
    }
    if (raw.includes('NOT ON SPECTACLE') || label.includes('NOT ON SPECTACLE')) {
      return 'NOT ON SPECTACLE';
    }
    if (raw.includes('NO MATCH') || label.includes('NO MATCH')) {
      return 'NO MATCH';
    }
    if (
      raw.includes('UNKNOWN') ||
      label.includes('UNKNOWN') ||
      raw.includes('ERROR') ||
      detection?.error
    ) {
      return 'UNKNOWN';
    }
    return 'UNKNOWN';
  };

  const getStatusColor = (detection) => {
    const state = getDisplayStatus(detection);
    if (state === 'IN SPECTACLE') return 'green';
    if (state === 'NOT ON SPECTACLE') return 'orange';
    return 'red';
  };

  const getStatusBadgeText = (detection) => {
    const state = getDisplayStatus(detection);
    if (state === 'IN SPECTACLE') return 'IN SPECTACLE';
    if (state === 'NOT ON SPECTACLE') return 'NOT ON SPECTACLE';
    if (state === 'NO MATCH') return 'NO MATCH';
    return 'UNKNOWN';
  };

  const getStatusSvg = (color) => {
    switch(color) {
      case 'green':
        return verifiedStateSvg;
      case 'orange':
        return dontBelongStateSvg;
      case 'red':
        return inverifiedStateSvg;
      default:
        return neutralStateSvg;
    }
  };

  const handleMessage = (data) => {
    switch(data.type) {
      case 'frame':
        updateDetections(data.detections);
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

  const updateDetections = (detectionData) => {
    if (!Array.isArray(detectionData)) {
      setDetections([]);
      return;
    }

    const normalized = detectionData.map((det) => {
      if (det && typeof det === 'object') {
        const status = String(det.status || det.label || 'UNKNOWN');
        return { ...det, status };
      }
      return { status: String(det || 'UNKNOWN') };
    });

    setDetections(normalized);
  };

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    updateStatus('connecting', 'Connecting...');

    try {
      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        updateStatus('connected', 'Connected');
        websocket.send(JSON.stringify({ type: 'start', mode: 'checkin' }));
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
        showError('WebSocket error occurred');
      };

      websocket.onclose = () => {
        console.log('WebSocket closed');
        updateStatus('disconnected', 'Disconnected');
        wsRef.current = null;
        setWs(null);
      };

      wsRef.current = websocket;
      setWs(websocket);
    } catch (e) {
      console.error('Error creating WebSocket:', e);
      showError('Failed to create WebSocket connection');
      updateStatus('disconnected', 'Disconnected');
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
    }
    updateStatus('disconnected', 'Disconnected');
    setDetections([]);
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

  const renderPersonCard = (detection, index) => {
    const statusColor = getStatusColor(detection);
    const statusSvg = getStatusSvg(statusColor);
    
    return (
      <div key={index} className="person-card">
        <div className="person-card-info">
          <div className="person-info">
            <div className="person-header">
              {detection.prenom && detection.nom ? (
                <>
                  <h2>{detection.prenom} {detection.nom}</h2>
                  {detection.matricule && <p className="matricule">Matricule: {detection.matricule}</p>}
                </>
              ) : detection.matricule ? (
                <>
                  <h2>Unknown Person</h2>
                  <p className="matricule">Matricule: {detection.matricule}</p>
                </>
              ) : detection.label ? (
                <h2>{detection.label}</h2>
              ) : (
                <h2>Unknown Person</h2>
              )}
            </div>

            <div className="person-details">
              <div className="detail-row">
                <span className="detail-label">State:</span>
                <span className={`detail-value status-${statusColor}`}>{getStatusBadgeText(detection)}</span>
              </div>
              {detection.compagnie && (
                <div className="detail-row">
                  <span className="detail-label">Company:</span>
                  <span className="detail-value">{detection.compagnie}</span>
                </div>
              )}
              {detection.date_sortie && (
                <div className="detail-row">
                  <span className="detail-label">Exit Date:</span>
                  <span className="detail-value">{detection.date_sortie}</span>
                </div>
              )}
              {detection.error && (
                <div className="detail-row">
                  <span className="detail-label">Error:</span>
                  <span className="detail-value error-text">{detection.error}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Time:</span>
                <span className="detail-value">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <div className={`status-badge status-badge-${statusColor}`}>
              {getStatusBadgeText(detection)}
            </div>
          </div>
        </div>

        <div className="person-card-avatar">
          <div className={`face-indicator face-${statusColor}`}>
            <img src={statusSvg} alt={`${statusColor} status`} className="status-svg" />
            <div className="status-pulse"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="checkins-container">
      <h1>Face Recognition Check-Ins</h1>

      <div className={`status ${status.state}`}>
        {status.message}
      </div>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      <div className="controls">
        <button className="connect-btn" onClick={connectWebSocket}>
          Start Recognition
        </button>
        <button className="disconnect-btn" onClick={disconnectWebSocket}>
          Stop Recognition
        </button>
      </div>

      <div className="checkins-content">
        <div className="current-detections">
          {detections.length === 0 ? (
            <div className="no-detections">
              <div className="face-indicator face-gray">
                <img src={neutralStateSvg} alt="neutral status" className="status-svg" />
              </div>
              <p>No faces detected</p>
            </div>
          ) : (
            <div className="detections-grid">
              {detections.map((det, index) => renderPersonCard(det, index))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckIns;
