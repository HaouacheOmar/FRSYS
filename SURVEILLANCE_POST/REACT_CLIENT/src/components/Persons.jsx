import { useState, useEffect } from 'react';
import { personsAPI, compagniesAPI, API_BASE_URL } from '../services/api';
import { useLang } from '../context/LangContext';

const Persons = () => {
  const { T } = useLang();
  const [persons, setPersons] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [companyFilter, setCompanyFilter] = useState('');
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
      compagnie: String(person.compagnie?.id ?? person.compagnie ?? ''),
    });
    setEditingId(person.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(T.deleteConfirmPerson)) {
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

  const getCompanyName = (companyField) => {
    if (companyField && typeof companyField === 'object') {
      return companyField.label || 'N/A';
    }

    const companyId = Number(companyField);
    const company = companies.find((c) => c.id === companyId);
    return company?.label || 'N/A';
  };

  const getMainPhoto = (person) => {
    if (!person?.id) return '/main.svg';
    return `${API_BASE_URL}/persons/${person.id}/main-photo/`;
  };

  const handleCardImageError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.setAttribute('src', '/main.svg');
  };

  const filteredPersons = companyFilter
    ? persons.filter((person) => {
        const companyId = person.compagnie?.id ?? person.compagnie;
        return String(companyId) === String(companyFilter);
      })
    : persons;

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  return (
    <div className="container">
      <h1>{T.personsTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}

      <div className="controls">
        <select
          className="control-select"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">{T.filterAll}</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.label}
            </option>
          ))}
        </select>
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          {T.addPerson}
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? T.editPerson : T.addPerson}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{T.matricule}:</label>
              <input
                type="text"
                value={formData.mat}
                onChange={(e) => setFormData({ ...formData, mat: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{T.lastName}:</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{T.firstName}:</label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{T.company}:</label>
              <select
                value={formData.compagnie}
                onChange={(e) => setFormData({ ...formData, compagnie: e.target.value })}
                required
              >
                <option value="">{T.selectCompany}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.label}
                  </option>
                ))}
              </select>
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

      <div className="persons-cards-grid">
        {filteredPersons.map((person) => (
          <article key={person.id} className="person-split-card">
            <div className="person-split-photo">
              <img
                src={getMainPhoto(person)}
                alt={`${person.prenom} ${person.nom}`}
                onError={handleCardImageError}
              />
            </div>

            <div className="person-split-info">
              <h3>{person.prenom} {person.nom}</h3>
              <p><strong>{T.matricule}:</strong> {person.mat}</p>
              <p><strong>{T.company}:</strong> {getCompanyName(person.compagnie)}</p>
            </div>

            <div className="person-split-actions">
              <button className="btn-edit" onClick={() => handleEdit(person)}>
                {T.edit}
              </button>
              <button className="btn-delete" onClick={() => handleDelete(person.id)}>
                {T.delete}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Persons;
