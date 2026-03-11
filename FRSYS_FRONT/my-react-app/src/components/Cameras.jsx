import { useState, useEffect } from 'react';
import { camerasAPI } from '../services/api';

const Cameras = () => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    rtsp_url: '',
    is_active: false,
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const data = await camerasAPI.list();
       setCameras(data.results || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      setFormData({ label: '', rtsp_url: '', is_active: false });
      setEditingId(null);
      setShowForm(false);
      loadCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (camera) => {
    setFormData({
      label: camera.label,
      rtsp_url: camera.rtsp_url,
      is_active: camera.is_active,
    });
    setEditingId(camera.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this camera?')) {
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
    setFormData({ label: '', rtsp_url: '', is_active: false });
    setEditingId(null);
  };

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <h1>Cameras</h1>

      {error && <div className="error">Error: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          Add Camera
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? 'Edit Camera' : 'Add Camera'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Camera Label:</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>RTSP URL:</label>
              <input
                type="text"
                value={formData.rtsp_url}
                onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                placeholder="rtsp://username:password@ip:port/path"
                required
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                {' '}Active
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="connect-btn">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" className="disconnect-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>RTSP URL</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((camera) => (
              <tr key={camera.id}>
                <td>{camera.id}</td>
                <td>{camera.label}</td>
                <td>{camera.rtsp_url}</td>
                <td>
                  <span className={camera.is_active ? 'status-active' : 'status-inactive'}>
                    {camera.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(camera)}>
                    Edit
                  </button>
                  <button
                    className={camera.is_active ? 'btn-delete' : 'connect-btn'}
                    onClick={() => handleToggleActive(camera)}
                  >
                    {camera.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(camera.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Cameras;
