// rentrees component: shows recorded returns and listens to camera websocket
// it can auto-detect returned items from websocket frames and refresh list
import { useState, useEffect, useRef } from 'react';
import { rentreesAPI, API_BASE_URL, compagniesAPI } from '../services/api';
import { useLang } from '../context/LangContext';

const Rentrees = () => {
  const { T } = useLang();
  const [rentrees, setRentrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [showLateOnly, setShowLateOnly] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [cameraEvents, setCameraEvents] = useState([]);
  const wsRef = useRef(null);
  const refreshLockRef = useRef(false);

  // websocket url used by this component (local dev default)
  const WS_URL = 'ws://127.0.0.1:8000/ws/video/stream/';
  const getSocketLabel = (state) => {
    if (state === 'connected') return T.connected;
    if (state === 'connecting') return T.connecting;
    if (state === 'disconnected') return T.disconnected;
    return state;
  };

  useEffect(() => {
    loadRentrees();
  }, [showLateOnly, companyFilter]);

  useEffect(() => {
    loadCompanies();
  }, []);

  // cleanup socket on unmount
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
      const params = {};
      if (companyFilter) params.compagnie = companyFilter;
      const data = showLateOnly ? await rentreesAPI.lateReturns(params) : await rentreesAPI.list(params);
      setRentrees(data.results || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await compagniesAPI.list();
      setCompanies(data.results || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  // small debounce to avoid rapid refreshes
  const scheduleRentreesRefresh = () => {
    if (refreshLockRef.current) return;
    refreshLockRef.current = true;
    setTimeout(async () => {
      await loadRentrees();
      refreshLockRef.current = false;
    }, 1000);
  };

  // connect to camera websocket and listen for return events
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

        // filter detections that indicate returned items
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

          // keep recent events at the top and limit to 8
          setCameraEvents((prev) => [...entries, ...prev].slice(0, 8));
          scheduleRentreesRefresh();
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    ws.onerror = () => {
      setError(T.socketError);
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

  // small helpers to display person and photo
  const getPersonInfo = (rentree) => {
    const person = rentree?.spectacle?.person;
    if (!person) return { name: T.unknown, id: null };
    return {
      name: `${person.prenom || ''} ${person.nom || ''}`.trim() || T.unknown,
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
    if (!spectacle) return T.na;

    const person = spectacle.person;
    const personName = person ? `${person.prenom} ${person.nom}` : T.unknown;
    return `${personName} - ${spectacle.date_sortie}`;
  };

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  return (
    <div className="container">
      <h1>{T.rentreesTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}

      <div className={`status ${wsState}`}>
        {T.cameraStatus}: {getSocketLabel(wsState)}
      </div>

      <div className="controls">
        <button className="connect-btn" onClick={connectCamera}>
          {T.startCameraRecognition}
        </button>
        <button className="disconnect-btn" onClick={disconnectCamera}>
          {T.stopCameraRecognition}
        </button>
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} style={{ marginLeft: 10 }}>
          <option value="">{T.selectCompany}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <div className="filter-buttons">
          <button
            className={!showLateOnly ? 'filter-active' : 'filter-btn'}
            onClick={() => setShowLateOnly(false)}
          >
            {T.allReturns}
          </button>
          <button
            className={showLateOnly ? 'filter-active' : 'filter-btn'}
            onClick={() => setShowLateOnly(true)}
          >
            {T.lateReturnsOnly}
          </button>
        </div>
      </div>

      {cameraEvents.length > 0 && (
        <div className="detections">
          <h3>{T.recentEvents}</h3>
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
        {rentrees
          .filter((rentree) => {
            if (!companyFilter) return true;
            const cid = rentree?.spectacle?.person?.compagnie?.id || rentree?.spectacle?.person?.compagnie || null;
            return Number(cid) === Number(companyFilter);
          })
          .map((rentree) => {
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
                <p><strong>{T.sortieLabel}:</strong> {dateSortie ? new Date(dateSortie).toLocaleDateString() : '—'}</p>
                <p><strong>{T.rentreeLabel}:</strong> {rentree.date_rentree ? new Date(rentree.date_rentree).toLocaleDateString() : '—'}</p>
                <p>
                  <span className={`status-badge ${isLate ? 'status-pending' : 'status-completed'}`}>
                    {isLate ? T.lateLabel : T.onTimeLabel}
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
