import { useState } from 'react';
import { useLang } from '../context/LangContext';
import { useStreamSocket } from '../hooks/useStreamSocket';
import { CameraStatusChip, CameraToggleButton } from './CameraControls';
import '../styles/CheckIns.css';
import verifiedStateSvg from '../assets/verified_state.svg';
import dontBelongStateSvg from '../assets/dont_belong_state.svg';
import inverifiedStateSvg from '../assets/inverified_state.svg';
import neutralStateSvg from '../assets/neutral_state.svg';

// Status of one detection, from the backend status (or label) text.
// Check-ins don't show return transitions: a RETURNED person is still "in outing" here.
const getState = (detection) => {
  const text = `${detection?.status || ''} ${detection?.label || ''}`.toUpperCase();
  if (text.includes('RETURNED') || text.includes('IN SPECTACLE')) return 'in';
  if (text.includes('NOT ON SPECTACLE')) return 'out';
  if (text.includes('NO MATCH')) return 'nomatch';
  return 'unknown';
};

const STATE_COLOR = { in: 'green', out: 'orange' }; // everything else: red
const COLOR_SVG = { green: verifiedStateSvg, orange: dontBelongStateSvg, red: inverifiedStateSvg };

const CheckIns = () => {
  const { T } = useLang();
  const [detections, setDetections] = useState([]);
  const stream = useStreamSocket({
    mode: 'checkin',
    onFrame: (data) => setDetections(Array.isArray(data.detections) ? data.detections.filter(Boolean) : []),
    onStop: () => setDetections([]),
  });

  const stateText = { in: T.inSpectacle, out: T.notOnSpectacle, nomatch: T.noMatch, unknown: T.unknown };

  const renderPersonCard = (detection, index) => {
    const state = getState(detection);
    const statusColor = STATE_COLOR[state] || 'red';

    return (
      <div key={index} className="person-card">
        <div className="person-card-info">
          <div className="person-info">
            <div className="person-header">
              {detection.prenom && detection.nom ? (
                <h2>{detection.prenom} {detection.nom}</h2>
              ) : (
                <h2>{detection.matricule ? T.unknownPerson : detection.label || T.unknownPerson}</h2>
              )}
              {detection.matricule && <p className="matricule">{T.matricule}: {detection.matricule}</p>}
            </div>

            <div className="person-details">
              <div className="detail-row">
                <span className="detail-label">{T.stateLabel}:</span>
                <span className={`detail-value status-${statusColor}`}>{stateText[state]}</span>
              </div>
              {detection.compagnie && (
                <div className="detail-row">
                  <span className="detail-label">{T.companyLabel}:</span>
                  <span className="detail-value">{detection.compagnie}</span>
                </div>
              )}
              {detection.date_sortie && (
                <div className="detail-row">
                  <span className="detail-label">{T.exitDateLabel}:</span>
                  <span className="detail-value">{detection.date_sortie}</span>
                </div>
              )}
              {detection.error && (
                <div className="detail-row">
                  <span className="detail-label">{T.errorPrefix}:</span>
                  <span className="detail-value error-text">{detection.error}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">{T.timeLabel}:</span>
                <span className="detail-value">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <div className={`status-badge status-badge-${statusColor}`}>
              {stateText[state]}
            </div>
          </div>
        </div>

        <div className="person-card-avatar">
          <div className={`face-indicator face-${statusColor}`}>
            <img src={COLOR_SVG[statusColor]} alt={`${statusColor} status`} className="status-svg" />
            <div className="status-pulse"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="checkins-container">
      <h1>{T.checkInsTitle}</h1>

      <CameraStatusChip state={stream.state} message={stream.statusMessage} />

      {stream.error && (
        <div className="error">
          {T.errorPrefix}: {stream.error}
        </div>
      )}

      <div className="controls">
        <CameraToggleButton state={stream.state} onToggle={stream.toggle} startLabel={T.startRecognition} stopLabel={T.stopRecognition} />
      </div>

      <div className="checkins-content">
        <div className="current-detections">
          {detections.length === 0 ? (
            <div className="no-detections">
              <div className="face-indicator face-gray">
                <img src={neutralStateSvg} alt="neutral status" className="status-svg" />
              </div>
              <p>{T.noFacesDetected}</p>
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
