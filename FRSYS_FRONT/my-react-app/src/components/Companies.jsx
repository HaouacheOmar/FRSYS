import { useState, useEffect } from 'react';
import { compagniesAPI } from '../services/api';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ label: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await compagniesAPI.list();
       setCompanies(data.results || []);
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
        await compagniesAPI.update(editingId, formData);
      } else {
        await compagniesAPI.create(formData);
      }
      setFormData({ label: '' });
      setEditingId(null);
      setShowForm(false);
      loadCompanies();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (company) => {
    setFormData({ label: company.label });
    setEditingId(company.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await compagniesAPI.delete(id);
        loadCompanies();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ label: '' });
    setEditingId(null);
  };

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <h1>Companies (Compagnies)</h1>

      {error && <div className="error">Error: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          Add Company
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? 'Edit Company' : 'Add Company'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Company Name:</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
              />
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
              <th>Company Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>{company.id}</td>
                <td>{company.label}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(company)}>
                    Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(company.id)}>
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

export default Companies;
