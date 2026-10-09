import { useState, useEffect } from 'react';
import { compagniesAPI } from '../services/api';
import { useLang } from '../context/LangContext';

const Companies = () => {
  const { T } = useLang();
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
    if (window.confirm(T.deleteConfirmCompany)) {
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

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  return (
    <div className="container">
      <h1>{T.companiesTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          {T.addCompany}
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? T.editCompany : T.addCompany}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{T.companyName}:</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
              />
            </div>
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

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>{T.companyName}</th>
              <th>{T.actions}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>{company.label}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(company)}>
                    {T.edit}
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(company.id)}>
                    {T.delete}
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
