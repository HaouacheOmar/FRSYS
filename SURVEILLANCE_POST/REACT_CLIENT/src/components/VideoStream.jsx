import { useRef, useState } from 'react';
import { useLang } from '../context/LangContext';
import { useStreamSocket } from '../hooks/useStreamSocket';
import { CameraStatusChip, CameraToggleButton } from './CameraControls';
import '../styles/VideoStream.css';

// Live camera view: frames, fps and the detections list.
const VideoStream = () => {
  const { T } = useLang();
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState([]);
  const [frameSrc, setFrameSrc] = useState(null);

  // fps = frames received per ~1s window
  const framesInWindow = useRef(0);
  const windowStart = useRef(0);
  const countFrame = () => {
    const now = performance.now();
    framesInWindow.current += 1;
    const elapsed = now - windowStart.current;
    if (elapsed >= 1000) {
      setFps(Math.round((framesInWindow.current * 1000) / elapsed));
      framesInWindow.current = 0;
      windowStart.current = now;
    }
  };

  const stream = useStreamSocket({
    onFrame: (data) => {
      if (data.image) setFrameSrc('data:image/jpeg;base64,' + data.image);
      setDetections(Array.isArray(data.detections) ? data.detections : []);
      countFrame();
    },
    onStop: () => setFrameSrc(null),
  });

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

    // recognized person: name, status, plus matricule/company when known
    if (det.nom && det.prenom) {
      const status = det.status || 'UNKNOWN';
      // backend statuses: IN SPECTACLE / RETURNED - … (expected) vs NOT ON SPECTACLE (not)
      const statusClass = /IN SPECTACLE|RETURNED/.test(status) ? '' : 'no-match';
      return (
        <div key={index} className={`detection-item ${statusClass}`}>
          <strong>{T.face} {index + 1}:</strong> {det.prenom} {det.nom}<br />
          <small>
            {det.matricule && <>{T.matricule}: {det.matricule} | {T.company}: {det.compagnie || 'N/A'} | </>}
            {T.statusLabel}: {status}
          </small>
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

      <CameraStatusChip state={stream.state} message={stream.statusMessage} />

      {stream.error && (
        <div className="error">
          {T.errorPrefix}: {stream.error}
        </div>
      )}

      <div className="controls">
        <CameraToggleButton state={stream.state} onToggle={stream.toggle} startLabel={T.connect} stopLabel={T.disconnect} />
      </div>

      <div className="video-container">
        <img id="videoFrame" src={frameSrc || undefined} alt={T.videoStreamTitle} />
      </div>

      <div className="info">
        {T.fpsLabel}: <span>{fps}</span> | {T.facesDetectedLabel}: <span>{detections.length}</span>
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
