import { useLang } from '../context/LangContext';
import playIcon from '../assets/play-svgrepo-com.svg';
import stopIcon from '../assets/stop-svgrepo-com.svg';
import cameraIcon from '../assets/surveillance_cam.svg';

const CHIP_CLASS = { connected: 'camera-status-running', connecting: 'camera-status-checking' };

// "Camera status: …" chip for a useStreamSocket state.
export const CameraStatusChip = ({ state, message }) => {
  const { T } = useLang();
  return (
    <div className="camera-status-row">
      <span className={`camera-status-chip ${CHIP_CLASS[state] || 'camera-status-stopped'}`}>
        <img src={cameraIcon} alt="" className="camera-status-icon" aria-hidden="true" />
        <span>{T.cameraStatus}: {message}</span>
      </span>
    </div>
  );
};

// Play/stop button for a useStreamSocket state. startLabel/stopLabel are the tooltips.
export const CameraToggleButton = ({ state, onToggle, startLabel, stopLabel }) => {
  const label = state === 'connected' ? stopLabel : startLabel;
  return (
    <button
      className={`camera-toggle-btn ${state === 'connected' ? 'is-on' : ''} ${state === 'connecting' ? 'is-busy' : ''}`}
      onClick={onToggle}
      disabled={state === 'connecting'}
      title={label}
      aria-label={label}
    >
      <span className="camera-toggle-icons" aria-hidden="true">
        <img src={playIcon} alt="" className="camera-toggle-icon play-icon" />
        <img src={stopIcon} alt="" className="camera-toggle-icon stop-icon" />
      </span>
    </button>
  );
};
