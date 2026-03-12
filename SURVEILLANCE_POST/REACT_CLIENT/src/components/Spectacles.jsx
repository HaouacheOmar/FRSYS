import { useState, useEffect } from 'react';
import { spectaclesAPI, personsAPI, API_BASE_URL } from '../services/api';

const Spectacles = () => {
  const [spectacles, setSpectacles] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [formData, setFormData] = useState({
    person: '',
    date_sortie: '',
    date_limite_retour: '',
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadPersons();
    loadSpectacles();
  }, [filter]);

  const normalizeListResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

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
      setSpectacles(normalizeListResponse(data));
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
      setPersons(normalizeListResponse(data));
    } catch (err) {
      console.error('Failed to load persons:', err);
    }
  };

  const handleExcelUpload = async (file) => {
    if (!file) return;
    const fileName = file.name || '';
    const isExcel = /\.(xlsx|xls)$/i.test(fileName);

    if (!isExcel) {
      setError('Please upload an Excel file (.xlsx or .xls).');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await spectaclesAPI.importExcel(file);
      setUploadSummary({
        fileName,
        createdCount: result?.created_count ?? 0,
        errorCount: result?.error_count ?? 0,
        errors: Array.isArray(result?.errors) ? result.errors : [],
      });
      await loadSpectacles();
    } catch (err) {
      setError(err.message || 'Failed to import excel file.');
    } finally {
      setLoading(false);
      setIsDragging(false);
    }
  };

  const onFileInputChange = async (e) => {
    const [file] = e.target.files || [];
    await handleExcelUpload(file);
    e.target.value = '';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const [file] = e.dataTransfer.files || [];
    await handleExcelUpload(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        person_id: Number(formData.person),
        date_sortie: formData.date_sortie,
        date_limite_retour: formData.date_limite_retour,
      };

      if (editingId) {
        await spectaclesAPI.update(editingId, payload);
      } else {
        await spectaclesAPI.create(payload);
      }
      setFormData({ person: '', date_sortie: '', date_limite_retour: '' });
      setEditingId(null);
      setShowForm(false);
      loadSpectacles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (spectacle) => {
    setFormData({
      person: String(spectacle.person?.id ?? spectacle.person ?? ''),
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

  const handleMarkReturn = async (id) => {
    try {
      await spectaclesAPI.markReturn(id);
      loadSpectacles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ person: '', date_sortie: '', date_limite_retour: '' });
    setEditingId(null);
  };

  const getPersonName = (personField) => {
    if (personField && typeof personField === 'object') {
      return `${personField.prenom || ''} ${personField.nom || ''}`.trim() || 'N/A';
    }

    const personId = Number(personField);
    const person = persons.find((p) => p.id === personId);
    return person ? `${person.prenom} ${person.nom}` : 'N/A';
  };

  const getPersonId = (personField) => {
    if (personField && typeof personField === 'object') return personField.id;
    return Number(personField) || null;
  };

  const getMainPhoto = (personField) => {
    const pid = getPersonId(personField);
    if (!pid) return '/main.svg';
    return `${API_BASE_URL}/persons/${pid}/main-photo/`;
  };

  const handleCardImageError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.setAttribute('src', '/main.svg');
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

      <div
        className={`excel-dropzone ${isDragging ? 'excel-dropzone-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <p>Drag and drop Excel file here (.xlsx, .xls)</p>
        <label className="excel-upload-btn">
          Choose Excel file
          <input type="file" accept=".xlsx,.xls" onChange={onFileInputChange} />
        </label>
        <small>Expected columns: matricule (or mat), date_sortie, date_limite_retour.</small>
      </div>

      {uploadSummary && (
        <div className="excel-upload-summary">
          <p>
            Imported <strong>{uploadSummary.fileName}</strong>: created {uploadSummary.createdCount}, errors {uploadSummary.errorCount}
          </p>
          {uploadSummary.errors.length > 0 && (
            <ul>
              {uploadSummary.errors.slice(0, 5).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      <div className="persons-cards-grid">
        {spectacles.map((spectacle) => {
          const isPending = !spectacle.date_rentree;
          return (
            <article key={spectacle.id} className="person-split-card spectacle-split-card">
              <div className="person-split-photo">
                <img
                  src={getMainPhoto(spectacle.person)}
                  alt={getPersonName(spectacle.person)}
                  onError={handleCardImageError}
                />
              </div>

              <div className="person-split-info">
                <h3>{getPersonName(spectacle.person)}</h3>
                <p><strong>Sortie:</strong> {spectacle.date_sortie ? new Date(spectacle.date_sortie).toLocaleDateString() : '—'}</p>
                <p><strong>Limite:</strong> {spectacle.date_limite_retour ? new Date(spectacle.date_limite_retour).toLocaleDateString() : '—'}</p>
                <p><strong>Rentree:</strong> {spectacle.date_rentree ? new Date(spectacle.date_rentree).toLocaleDateString() : <em>Pending</em>}</p>
                <p>
                  <span className={isPending ? 'status-badge status-pending' : 'status-badge status-completed'}>
                    {isPending ? 'Pending' : 'Completed'}
                  </span>
                </p>
              </div>

              <div className="person-split-actions">
                <button className="btn-edit" onClick={() => handleEdit(spectacle)}>
                  Edit
                </button>
                {isPending && (
                  <button className="connect-btn" onClick={() => handleMarkReturn(spectacle.id)}>
                    Mark Returned
                  </button>
                )}
                <button className="btn-delete" onClick={() => handleDelete(spectacle.id)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default Spectacles;
