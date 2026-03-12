import { useState, useEffect, useRef } from 'react';
import { rentreesAPI, API_BASE_URL } from '../services/api';

const Rentrees = () => {
  const [rentrees, setRentrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLateOnly, setShowLateOnly] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [cameraEvents, setCameraEvents] = useState([]);
  const wsRef = useRef(null);
  const refreshLockRef = useRef(false);

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

  const connectCamera = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setWsState('connecting');
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsState('connected');
      ws.send(JSON.stringify({ type: 'start', mode: 'return' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'frame' || !Array.isArray(data.detections)) return;

        const returns = data.detections.filter((det) => {
          const statusText = String(det?.status || det?.label || '').toUpperCase();
          return statusText.includes('RETURNED - ON TIME') || statusText.includes('RETURNED - LATE');
        });

        if (returns.length > 0) {
          const entries = returns.map((det) => ({
            id: `${det.matricule}-${Date.now()}`,
            person: `${det.prenom || ''} ${det.nom || ''}`.trim() || det.matricule || 'Unknown',
            status: det.status,
            time: det.date_rentree || new Date().toLocaleString(),
          }));

          setCameraEvents((prev) => [...entries, ...prev].slice(0, 8));
          scheduleRentreesRefresh();
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
    setWsState('disconnected');
  };

  const getPersonInfo = (rentree) => {
    const person = rentree?.spectacle?.person;
    if (!person) return { name: 'Unknown', id: null };
    return {
      name: `${person.prenom || ''} ${person.nom || ''}`.trim() || 'Unknown',
      id: person.id ?? null,
    };
  };

  const getMainPhoto = (rentree) => {
    const pid = rentree?.spectacle?.person?.id;
    if (!pid) return '/main.svg';
    return `${API_BASE_URL}/persons/${pid}/main-photo/`;
  };

  const handleCardImageError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.setAttribute('src', '/main.svg');
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

      <div className="persons-cards-grid">
        {rentrees.map((rentree) => {
          const { name } = getPersonInfo(rentree);
          const isLate = rentree.est_retard;
          const dateSortie = rentree?.spectacle?.date_sortie;
          return (
            <article key={rentree.id} className="person-split-card spectacle-split-card">
              <div className="person-split-photo">
                <img
                  src={getMainPhoto(rentree)}
                  alt={name}
                  onError={handleCardImageError}
                />
              </div>

              <div className="person-split-info">
                <h3>{name}</h3>
                <p><strong>Sortie:</strong> {dateSortie ? new Date(dateSortie).toLocaleDateString() : '—'}</p>
                <p><strong>Rentree:</strong> {rentree.date_rentree ? new Date(rentree.date_rentree).toLocaleDateString() : '—'}</p>
                <p>
                  <span className={`status-badge ${isLate ? 'status-pending' : 'status-completed'}`}>
                    {isLate ? 'Late' : 'On Time'}
                  </span>
                </p>
              </div>

              <div className="person-split-actions">
                {/* read-only — returns are recorded automatically */}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default Rentrees;
