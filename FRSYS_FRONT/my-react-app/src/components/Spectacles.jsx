import { useState, useEffect } from 'react';
import { spectaclesAPI, personsAPI } from '../services/api';

const Spectacles = () => {
  const [spectacles, setSpectacles] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [formData, setFormData] = useState({
    person: '',
    date_sortie: '',
    date_rentree: '',
    date_limite_retour: '',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadPersons();
    loadSpectacles();
  }, [filter]);

  const loadSpectacles = async () => {
    try {
      setLoading(true);
      let data;
      if (filter === 'pending') {
        data = await spectaclesAPI.pending();
      } else if (filter === 'completed') {
        data = await spectaclesAPI.completed();
      } else {
        data = await spectaclesAPI.list();
      }
       setSpectacles(data.results || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPersons = async () => {
    try {
      const data = await personsAPI.list();
       setPersons(data.results || []);
    } catch (err) {
      console.error('Failed to load persons:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        person_id: Number(formData.person),
        date_sortie: formData.date_sortie,
        date_rentree: formData.date_rentree || null,
        date_limite_retour: formData.date_limite_retour,
      };

      if (editingId) {
        await spectaclesAPI.update(editingId, payload);
      } else {
        await spectaclesAPI.create(payload);
      }
      setFormData({ person: '', date_sortie: '', date_rentree: '', date_limite_retour: '' });
      setEditingId(null);
      setShowForm(false);
      loadSpectacles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (spectacle) => {
    const personId = spectacle.person?.id || spectacle.person;

    setFormData({
      person: String(personId || ''),
      date_sortie: spectacle.date_sortie,
      date_rentree: spectacle.date_rentree || '',
      date_limite_retour: spectacle.date_limite_retour,
    });
    setEditingId(spectacle.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this spectacle?')) {
      try {
        await spectaclesAPI.delete(id);
        loadSpectacles();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ person: '', date_sortie: '', date_rentree: '', date_limite_retour: '' });
    setEditingId(null);
  };

  const getPersonName = (personValue) => {
    if (personValue && typeof personValue === 'object') {
      return `${personValue.nom || ''} ${personValue.prenom || ''}`.trim() || 'N/A';
    }

    const person = persons.find((p) => p.id === personValue);
    return person ? `${person.nom} ${person.prenom}` : 'N/A';
  };

  if (loading) return <div className="container"><p>Loading...</p></div>;

  return (
    <div className="container">
      <h1>Spectacles</h1>

      {error && <div className="error">Error: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          Add Spectacle
        </button>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'filter-active' : 'filter-btn'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'pending' ? 'filter-active' : 'filter-btn'}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={filter === 'completed' ? 'filter-active' : 'filter-btn'}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-container">
          <h2>{editingId ? 'Edit Spectacle' : 'Add Spectacle'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Person:</label>
              <select
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                required
              >
                <option value="">Select Person</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.prenom} {person.nom} - {person.mat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date Sortie:</label>
              <input
                type="date"
                value={formData.date_sortie}
                onChange={(e) => setFormData({ ...formData, date_sortie: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Date Limite Retour:</label>
              <input
                type="date"
                value={formData.date_limite_retour}
                onChange={(e) => setFormData({ ...formData, date_limite_retour: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Date Rentree (optional):</label>
              <input
                type="date"
                value={formData.date_rentree}
                onChange={(e) => setFormData({ ...formData, date_rentree: e.target.value })}
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
              <th>Person</th>
              <th>Date Sortie</th>
              <th>Date Limite</th>
              <th>Date Rentree</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {spectacles.map((spectacle) => (
              <tr key={spectacle.id}>
                <td>{spectacle.id}</td>
                <td>{getPersonName(spectacle.person)}</td>
                <td>{spectacle.date_sortie}</td>
                <td>{spectacle.date_limite_retour}</td>
                <td>{spectacle.date_rentree || 'Pending'}</td>
                <td>
                  <span className={spectacle.date_rentree ? 'status-active' : 'status-inactive'}>
                    {spectacle.date_rentree ? 'Completed' : 'Pending'}
                  </span>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(spectacle)}>
                    Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(spectacle.id)}>
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

export default Spectacles;
