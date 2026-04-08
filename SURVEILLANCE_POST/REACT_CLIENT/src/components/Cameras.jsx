import { useState, useEffect, useRef } from 'react';
import { camerasAPI } from '../services/api';
import { useLang } from '../context/LangContext';
import camSvg from '../assets/surveillance_cam.svg';

const Cameras = () => {
  const { T } = useLang();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ip_address: '',
    model_name: '',
    username: '',
    password: '',
    rtsp_port: 554,
    rtsp_path: '/stream',
    is_active: false,
  });
  const [editingId, setEditingId] = useState(null);
  // streamStatus: { [cameraId]: 'checking' | 'online' | 'offline' }
  const [streamStatus, setStreamStatus] = useState({});
  const probeIntervalRef = useRef(null);

  // helper: build an rtsp url from camera data or form data
  // supports optional username/password and normalizes the path
  const buildRtspUrl = (cam) => {
    if (!cam || !cam.ip_address) return '';
    const host = cam.ip_address;
    const port = cam.rtsp_port ?? 554;
    const user = cam.username || '';
    const pass = cam.password || '';
    // ensure path starts with '/'
    let path = cam.rtsp_path || '/stream';
    if (!path.startsWith('/')) path = '/' + path;

    // build auth segment only when username provided
    const auth = user ? `${encodeURIComponent(user)}${pass ? `:${encodeURIComponent(pass)}` : ''}@` : '';
    return `rtsp://${auth}${host}:${port}${path}`;
  };

  useEffect(() => {
    loadCameras();
    return () => {
      if (probeIntervalRef.current) clearInterval(probeIntervalRef.current);
    };
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const data = await camerasAPI.list();
      const list = data.results || [];
      setCameras(list);
      setError('');
      // After loading, probe streams immediately then every 30s
      if (list.length > 0) {
        probeAll(list);
        if (probeIntervalRef.current) clearInterval(probeIntervalRef.current);
        probeIntervalRef.current = setInterval(() => probeAll(), 30000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const probeAll = async (camList) => {
    // Mark all as checking
    const ids = (camList || cameras).map((c) => c.id);
    setStreamStatus((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = 'checking'; });
      return next;
    });
    try {
      const results = await camerasAPI.pingAll();
      setStreamStatus((prev) => {
        const next = { ...prev };
        Object.entries(results).forEach(([id, info]) => {
          next[Number(id)] = info.online ? 'online' : 'offline';
        });
        return next;
      });
    } catch {
      setStreamStatus((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { next[id] = 'offline'; });
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await camerasAPI.update(editingId, formData);
      } else {
        await camerasAPI.create(formData);
      }
      setFormData({ ip_address: '', model_name: '', username: '', password: '', rtsp_port: 554, rtsp_path: '/stream' });
      setEditingId(null);
      setShowForm(false);
      loadCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (camera) => {
    setFormData({
      ip_address: camera.ip_address || '',
      model_name: camera.model_name || '',
      username: camera.username || '',
      password: '',
      rtsp_port: camera.rtsp_port ?? 554,
      rtsp_path: camera.rtsp_path || '/stream',
    });
    setEditingId(camera.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(T.deleteConfirmCamera)) {
      try {
        await camerasAPI.delete(id);
        loadCameras();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleToggleActive = async (camera) => {
    try {
      if (camera.is_active) {
        await camerasAPI.deactivate(camera.id);
      } else {
        await camerasAPI.activate(camera.id);
      }
      loadCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ ip_address: '', model_name: '', username: '', password: '', rtsp_port: 554, rtsp_path: '/stream' });
    setEditingId(null);
  };

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  return (
    <div className="container">
      <h1>{T.camerasTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          {T.addCamera}
        </button>
        <button className="btn-edit" onClick={() => probeAll()} style={{ marginLeft: 10 }}>
          {T.checkStreams}
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? T.editCamera : T.addCamera}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{T.ipAddress}:</label>
              <input
                type="text"
                value={formData.ip_address}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div className="form-group">
              <label>{T.modelName}:</label>
              <input
                type="text"
                value={formData.model_name}
                onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                placeholder="e.g. Hikvision DS-2CD2345"
                required
              />
            </div>
            <div className="form-group">
              <label>{T.username}:</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{T.password}:</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{T.rtspPort}:</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={formData.rtsp_port}
                onChange={(e) => setFormData({ ...formData, rtsp_port: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>{T.streamPath}:</label>
              <input
                type="text"
                value={formData.rtsp_path}
                onChange={(e) => setFormData({ ...formData, rtsp_path: e.target.value })}
                placeholder="/stream"
              />
            </div>
            {formData.ip_address && (
              <div className="rtsp-preview">
                <span className="rtsp-preview-label">{T.rtspPreviewLabel}:</span>
                <code className="rtsp-preview-url">{buildRtspUrl(formData)}</code>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="connect-btn">
                {editingId ? T.update : T.create}
              </button>
              <button type="button" className="disconnect-btn" onClick={handleCancel}>
                {T.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="persons-cards-grid">
        {cameras.map((camera) => (
          <article key={camera.id} className="person-split-card camera-split-card">
            <div className="person-split-photo camera-split-photo">
              <img src={camSvg} alt={T.camerasTitle} />
            </div>

            <div className="person-split-info">
              <h3>{camera.model_name}</h3>
              <p><strong>{T.ipLabel}:</strong> {camera.ip_address}</p>
              {camera.username && <p><strong>{T.userLabel}:</strong> {camera.username}</p>}
              <p className="rtsp-url-display"><strong>{T.rtspLabel}:</strong> <code>{camera.rtsp_url || buildRtspUrl(camera)}</code></p>
              <p>
                <strong>{T.streamLabel}:</strong>{' '}
                {(() => {
                  const s = streamStatus[camera.id];
                  if (s === 'checking') return <span className="camera-status-chip camera-status-checking">{T.statusChecking}</span>;
                  if (s === 'online')   return <span className="camera-status-chip camera-status-running">{T.statusOnline}</span>;
                  if (s === 'offline')  return <span className="camera-status-chip camera-status-stopped">{T.statusOffline}</span>;
                  return <span className="camera-status-chip">—</span>;
                })()}
              </p>
            </div>

            <div className="person-split-actions">
              <button className="btn-edit" onClick={() => handleEdit(camera)}>
                {T.edit}
              </button>
              <button
                className={camera.is_active ? 'btn-delete' : 'connect-btn'}
                onClick={() => handleToggleActive(camera)}
              >
                {camera.is_active ? T.deactivate : T.activate}
              </button>
              <button className="btn-delete" onClick={() => handleDelete(camera.id)}>
                {T.delete}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Cameras;
