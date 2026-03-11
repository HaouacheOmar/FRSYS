import { useState, useEffect } from 'react';
import { personsAPI, compagniesAPI } from '../services/api';

const Persons = () => {
  const [persons, setPersons] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    mat: '',
    nom: '',
    prenom: '',
    compagnie: '',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadPersons();
    loadCompanies();
  }, []);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const data = await personsAPI.list();
       setPersons(data.results || []);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        mat: formData.mat,
        nom: formData.nom,
        prenom: formData.prenom,
        compagnie_id: Number(formData.compagnie),
      };

      if (editingId) {
        await personsAPI.update(editingId, payload);
      } else {
        await personsAPI.create(payload);
      }
      setFormData({ mat: '', nom: '', prenom: '', compagnie: '' });
      setEditingId(null);
      setShowForm(false);
      loadPersons();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (person) => {
    setFormData({
      mat: person.mat,
      nom: person.nom,
      prenom: person.prenom,
      compagnie: String(person.compagnie?.id || ''),
    });
    setEditingId(person.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      try {
        await personsAPI.delete(id);
        loadPersons();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ mat: '', nom: '', prenom: '', compagnie: '' });
    setEditingId(null);
  };

  const getCompanyName = (person) => {
    if (person?.compagnie?.label) {
      return person.compagnie.label;
    }

    const companyId = person?.compagnie?.id || person?.compagnie;
    const company = companies.find((c) => c.id === companyId);
    return company ? company.label : 'N/A';
  };

  const getPersonInitials = (person) => {
    const first = person?.prenom?.[0] || '';
    const last = person?.nom?.[0] || '';
    return `${last}${first}`.toUpperCase() || 'NA';
  };

  const getPersonPhoto = (person) => person?.photo_url || person?.photo || null;

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <h1>Persons</h1>

      {error && <div className="error">Error: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          Add Person
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? 'Edit Person' : 'Add Person'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Matricule:</label>
              <input
                type="text"
                value={formData.mat}
                onChange={(e) => setFormData({ ...formData, mat: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name (Nom):</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>First Name (Prenom):</label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Company:</label>
              <select
                value={formData.compagnie}
                onChange={(e) => setFormData({ ...formData, compagnie: e.target.value })}
                required
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.label}
                  </option>
                ))}
              </select>
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

      <div className="card-grid">
        {persons.map((person) => {
          const photo = getPersonPhoto(person);

          return (
            <article key={person.id} className="entity-card">
              <div className="entity-photo-wrap">
                {photo ? (
                  <img src={photo} alt={`${person.nom} ${person.prenom}`} className="entity-photo" />
                ) : (
                  <div className="entity-avatar-fallback">{getPersonInitials(person)}</div>
                )}
              </div>

              <div className="entity-content">
                <h3>{person.nom} {person.prenom}</h3>
                <p className="entity-subtitle">Matricule: {person.mat}</p>
                <p className="entity-company">Compagnie: {getCompanyName(person)}</p>

                <div className="entity-actions">
                  <button className="btn-edit" onClick={() => handleEdit(person)}>
                    Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(person.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {persons.length === 0 && (
          <p className="empty-state">No persons found.</p>
        )}
      </div>
    </div>
  );
};

export default Persons;
