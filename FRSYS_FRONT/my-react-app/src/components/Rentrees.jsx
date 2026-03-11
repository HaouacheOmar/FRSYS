import { useState, useEffect, useRef } from 'react';
import { rentreesAPI, spectaclesAPI } from '../services/api';

const Rentrees = () => {
  const [rentrees, setRentrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLateOnly, setShowLateOnly] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [cameraEvents, setCameraEvents] = useState([]);
  const wsRef = useRef(null);
  const refreshLockRef = useRef(false);
  const processingSpectaclesRef = useRef(new Map());

  const WS_URL = 'ws://localhost:8000/ws/video/stream/';

  useEffect(() => {
    loadRentrees();
  }, [showLateOnly]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadRentrees = async () => {
    try {
      setLoading(true);
      const data = showLateOnly ? await rentreesAPI.lateReturns() : await rentreesAPI.list();
      setRentrees(data.results || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scheduleRentreesRefresh = () => {
    if (refreshLockRef.current) return;
    refreshLockRef.current = true;
    setTimeout(async () => {
      await loadRentrees();
      refreshLockRef.current = false;
    }, 1000);
  };

  const getReturnStatus = (spectacle) => {
    if (!spectacle?.date_rentree) {
      return 'RETURNED';
    }

    if (!spectacle?.date_limite_retour) {
      return 'RETURNED - ON TIME';
    }

    const returnTime = new Date(spectacle.date_rentree);
    const deadline = new Date(spectacle.date_limite_retour);
    return returnTime > deadline ? 'RETURNED - LATE' : 'RETURNED - ON TIME';
  };

  const registerReturn = async (detection) => {
    const spectacleId = detection?.spectacle_id;
    if (!spectacleId || processingSpectaclesRef.current.has(spectacleId)) {
      return;
    }

    processingSpectaclesRef.current.set(spectacleId, Date.now());

    try {
      const spectacle = await spectaclesAPI.markReturn(spectacleId);
      const person = spectacle?.person;
      const personName = person ? `${person.prenom} ${person.nom}` : `${detection.prenom || ''} ${detection.nom || ''}`.trim();

      setCameraEvents((prev) => [
        {
          id: `${spectacleId}-${spectacle.date_rentree || Date.now()}`,
          person: personName || detection.matricule || 'Unknown',
          status: getReturnStatus(spectacle),
          time: spectacle.date_rentree || new Date().toLocaleString(),
        },
        ...prev,
      ].slice(0, 8));

      scheduleRentreesRefresh();
    } catch (err) {
      setError(err.message);
      processingSpectaclesRef.current.delete(spectacleId);
    }
  };

  const connectCamera = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setWsState('connecting');
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsState('connected');
      ws.send(JSON.stringify({ type: 'start' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'frame' || !Array.isArray(data.detections)) return;

        const eligibleDetections = data.detections.filter((det) => {
          const statusText = String(det?.status || '').toUpperCase();
          return statusText.includes('IN SPECTACLE') && Boolean(det?.spectacle_id);
        });

        if (eligibleDetections.length > 0) {
          eligibleDetections.forEach((det) => {
            registerReturn(det);
          });
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    ws.onerror = () => {
      setError('Camera websocket error');
    };

    ws.onclose = () => {
      setWsState('disconnected');
      wsRef.current = null;
    };

    wsRef.current = ws;
  };

  const disconnectCamera = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    processingSpectaclesRef.current.clear();
    setWsState('disconnected');
  };

  const getSpectacleInfo = (rentree) => {
    const spectacle = rentree?.spectacle;
    if (!spectacle) return 'N/A';

    const person = spectacle.person;
    const personName = person ? `${person.prenom} ${person.nom}` : 'Unknown';
    return `${personName} - ${spectacle.date_sortie}`;
  };

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <h1>Rentrees (Returns)</h1>

      {error && <div className="error">Error: {error}</div>}

      <div className={`status ${wsState}`}>
        Camera: {wsState}
      </div>

      <div className="controls">
        <button className="connect-btn" onClick={connectCamera}>
          Start Camera Recognition
        </button>
        <button className="disconnect-btn" onClick={disconnectCamera}>
          Stop Camera Recognition
        </button>
        <div className="filter-buttons">
          <button
            className={!showLateOnly ? 'filter-active' : 'filter-btn'}
            onClick={() => setShowLateOnly(false)}
          >
            All Returns
          </button>
          <button
            className={showLateOnly ? 'filter-active' : 'filter-btn'}
            onClick={() => setShowLateOnly(true)}
          >
            Late Returns Only
          </button>
        </div>
      </div>

      {cameraEvents.length > 0 && (
        <div className="detections">
          <h3>Recent Camera Return Events</h3>
          <div className="detections-list">
            {cameraEvents.map((evt) => (
              <div key={evt.id} className="detection-item">
                <strong>{evt.person}</strong> - {evt.status} - {evt.time}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Spectacle Info</th>
              <th>Date Rentree Effective</th>
              <th>Late?</th>
            </tr>
          </thead>
          <tbody>
            {rentrees.map((rentree) => (
              <tr key={rentree.id}>
                <td>{rentree.id}</td>
                <td>{getSpectacleInfo(rentree)}</td>
                <td>{rentree.date_rentree}</td>
                <td>
                  <span className={rentree.est_retard ? 'status-late' : 'status-ontime'}>
                    {rentree.est_retard ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Rentrees;
