// rentrees component: shows recorded returns and listens to camera websocket
// it can auto-detect returned items from websocket frames and refresh list
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { rentreesAPI, compagniesAPI } from '../services/api';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { useStreamSocket } from '../hooks/useStreamSocket';
import { personName, personPhotoUrl, showPlaceholderPhoto } from '../utils/person';
import { CameraStatusChip, CameraToggleButton } from './CameraControls';

const Rentrees = () => {
  const { T } = useLang();
  const { role } = useAuth();
  const isGuest = role === 'guest';
  const [rentrees, setRentrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [returnsFilter, setReturnsFilter] = useState('all');
  const [cameraEvents, setCameraEvents] = useState([]);
  const refreshLockRef = useRef(false);

  useEffect(() => {
    loadRentrees();
  }, [returnsFilter, companyFilter]);

  useEffect(() => {
    if (!isGuest) {
      loadCompanies();
    } else {
      setCompanies([]);
      setCompanyFilter('');
    }
  }, [isGuest]);

  const loadRentrees = async () => {
    try {
      setLoading(true);
      const params = {};
      if (companyFilter) params.compagnie = companyFilter;
      if (returnsFilter === 'late') params.est_retard = 'true';
      const data = await rentreesAPI.list(params);
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

  // Camera in 'return' mode: the backend records returns; show them as they happen.
  const stream = useStreamSocket({
    mode: 'return',
    onFrame: (data) => {
      if (!Array.isArray(data.detections)) return;
      const returns = data.detections.filter((det) => {
        const statusText = String(det?.status || det?.label || '').toUpperCase();
        return statusText.includes('RETURNED - ON TIME') || statusText.includes('RETURNED - LATE');
      });
      if (returns.length === 0) return;

      const entries = returns.map((det) => ({
        id: `${det.matricule}-${Date.now()}`,
        person: personName(det, det.matricule || T.unknown),
        status: det.status,
        time: det.date_rentree || new Date().toLocaleString(),
      }));
      // keep recent events at the top and limit to 8
      setCameraEvents((prev) => [...entries, ...prev].slice(0, 8));
      scheduleRentreesRefresh();
    },
  });

  // guests don't get person photos
  const photoFor = (rentree) => personPhotoUrl(isGuest ? null : rentree?.spectacle?.person?.id);

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  return (
    <div className="container">
      <h1>{T.rentreesTitle}</h1>

      {(error || stream.error) && <div className="error">{T.errorPrefix}: {error || stream.error}</div>}

      <CameraStatusChip state={stream.state} message={stream.statusMessage} />

      <div className="controls">
        <CameraToggleButton
          state={stream.state}
          onToggle={stream.toggle}
          startLabel={T.startCameraRecognition}
          stopLabel={T.stopCameraRecognition}
        />
        {!isGuest && (
          <select className="control-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">{T.selectCompany}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        )}
        <select className="control-select" value={returnsFilter} onChange={(e) => setReturnsFilter(e.target.value)}>
          <option value="all">{T.allReturns}</option>
          <option value="late">{T.lateReturnsOnly}</option>
        </select>
      </div>

      {cameraEvents.length > 0 && (
        <div className="detections panel">
          <h3>{T.recentEvents}</h3>
          <div className="detections-list">
            <AnimatePresence initial={false}>
              {cameraEvents.map((evt) => (
                <motion.div
                  key={evt.id}
                  layout
                  // a late return is the one the guard must notice
                  className={`detection-item${String(evt.status).includes('LATE') ? ' no-match' : ''}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }}
                >
                  <strong>{evt.person}</strong> · {evt.status} · <span className="mono">{evt.time}</span>
                </motion.div>
              ))}
            </AnimatePresence>
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
          const name = personName(rentree?.spectacle?.person, T.unknown);
          const isLate = rentree.est_retard;
          const dateSortie = rentree?.spectacle?.date_sortie;
          return (
            <article key={rentree.id} className="person-split-card spectacle-split-card">
              <div className="person-split-photo">
                <img
                  src={photoFor(rentree)}
                  alt={name}
                  onError={showPlaceholderPhoto}
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
