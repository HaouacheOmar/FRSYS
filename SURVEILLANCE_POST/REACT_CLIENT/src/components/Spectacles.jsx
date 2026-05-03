// spectacles component: list, import and manage issued spectacles/glasses
// simple ui: upload excel, create/edit/delete, filter pending/completed
import { useState, useEffect } from 'react';
import { spectaclesAPI, personsAPI, API_BASE_URL, compagniesAPI } from '../services/api';
import { useLang } from '../context/LangContext';

const Spectacles = () => {
  // translations
  const { T } = useLang();

  // main state: list of spectacles and persons
  const [spectacles, setSpectacles] = useState([]);
  const [persons, setPersons] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
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

  // load persons and spectacles whenever filter changes
  useEffect(() => {
    loadPersons();
    loadSpectacles();
    loadCompanies();
  }, [filter, companyFilter]);

  // helper: normalize api list responses (supports pagination)
  const normalizeListResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  // fetch spectacles using filter
  const loadSpectacles = async () => {
    try {
      setLoading(true);
      const params = {};
      if (companyFilter) params.compagnie = companyFilter;
      let data;
      if (filter === 'pending') {
        data = await spectaclesAPI.pending(params);
      } else if (filter === 'completed') {
        data = await spectaclesAPI.completed(params);
      } else {
        data = await spectaclesAPI.list(params);
      }
      setSpectacles(normalizeListResponse(data));
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

  // fetch persons for select lists
  const loadPersons = async () => {
    try {
      const data = await personsAPI.list();
      setPersons(normalizeListResponse(data));
    } catch (err) {
      console.error('Failed to load persons:', err);
    }
  };

  // handle excel file upload: validate extension and call backend import
  const handleExcelUpload = async (file) => {
    if (!file) return;
    const fileName = file.name || '';
    const isExcel = /\.(xlsx|xls)$/i.test(fileName);

    if (!isExcel) {
      setError(T.dropzoneText);
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
      setError(err.message || `${T.errorPrefix}: Excel`);
    } finally {
      setLoading(false);
      setIsDragging(false);
    }
  };

  // file input change handler
  const onFileInputChange = async (e) => {
    const [file] = e.target.files || [];
    await handleExcelUpload(file);
    e.target.value = '';
  };

  // drag/drop helpers for the excel zone
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

  // create or update spectacle
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

  // populate form for editing
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

  // delete with confirmation
  const handleDelete = async (id) => {
    if (window.confirm(T.deleteConfirmSpectacle)) {
      try {
        await spectaclesAPI.delete(id);
        loadSpectacles();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // mark as returned
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

  // helpers to display person name/id and main photo url
  const getPersonName = (personField) => {
    if (personField && typeof personField === 'object') {
      return `${personField.prenom || ''} ${personField.nom || ''}`.trim() || T.na;
    }

    const personId = Number(personField);
    const person = persons.find((p) => p.id === personId);
    return person ? `${person.prenom} ${person.nom}` : T.na;
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

  const outingTitles = Array.from(
    new Set(
      spectacles
        .map((spectacle) => (spectacle?.title || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  if (loading) return <div className="container"><p>{T.loading}</p></div>;

  // ui: list, controls, dropzone and optional form
  return (
    <div className="container">
      <h1>{T.spectaclesTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}

      <div className="controls">
        <button className="connect-btn" onClick={() => setShowForm(true)}>
          {T.addSpectacle}
        </button>
        <select className="control-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">{T.selectCompany}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select className="control-select" value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)}>
          <option value="">{T.selectOutingTitle || 'All outing titles'}</option>
          {outingTitles.map((title) => (
            <option key={title} value={title}>{title}</option>
          ))}
        </select>
        <select className="control-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{T.filterAll}</option>
          <option value="pending">{T.filterPending}</option>
          <option value="completed">{T.filterCompleted}</option>
        </select>
      </div>

      <div
        className={`excel-dropzone ${isDragging ? 'excel-dropzone-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <p>{T.dropzoneText}</p>
        <label className="excel-upload-btn">
          {T.chooseExcel}
          <input type="file" accept=".xlsx,.xls" onChange={onFileInputChange} />
        </label>
        <small>{T.excelHint}</small>

        <div className="excel-format-preview">
          <div className="excel-format-header">{T.excelFormatPreviewTitle || 'Expected Excel Shape'}</div>
          <div className="excel-format-rule">{T.excelTitleFromFileRule || 'Outing title is taken from the Excel file name (without extension).'}</div>
          <div className="excel-format-columns">
            <span>{T.excelColumnMat || 'matricule (or mat)'}</span>
            <span>{T.excelColumnSortie || 'date_sortie'}</span>
            <span>{T.excelColumnLimite || 'date_limite_retour'}</span>
          </div>
          <div className="excel-format-example">
            <strong>{T.excelExampleRow || 'Example row'}:</strong> MAT-001 | 2026-04-13 | 2026-04-20
          </div>
        </div>
      </div>

      {uploadSummary && (
        <div className="excel-upload-summary">
          <p>
            {T.importedPrefix} <strong>{uploadSummary.fileName}</strong>: {T.importedCreated} {uploadSummary.createdCount}, {T.importedErrors} {uploadSummary.errorCount}
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
          <h2>{editingId ? T.editSpectacle : T.addSpectacle}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{T.person}:</label>
              <select
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                required
              >
                <option value="">{T.selectPerson}</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.prenom} {person.nom} - {person.mat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{T.dateSortieLabel}:</label>
              <input
                type="date"
                value={formData.date_sortie}
                onChange={(e) => setFormData({ ...formData, date_sortie: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{T.dateLimiteLabel}:</label>
              <input
                type="date"
                value={formData.date_limite_retour}
                onChange={(e) => setFormData({ ...formData, date_limite_retour: e.target.value })}
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

      <div className="persons-cards-grid">
        {spectacles
          .filter((spectacle) => {
            if (!companyFilter) return true;
            const cid = spectacle?.person?.compagnie?.id || spectacle?.person?.compagnie || null;
            return Number(cid) === Number(companyFilter);
          })
          .filter((spectacle) => {
            if (!titleFilter) return true;
            return (spectacle?.title || '').trim() === titleFilter;
          })
          .map((spectacle) => {
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
                <p><strong>{T.sortieLabel}:</strong> {spectacle.date_sortie ? new Date(spectacle.date_sortie).toLocaleDateString() : '—'}</p>
                <p><strong>{T.limiteLabel}:</strong> {spectacle.date_limite_retour ? new Date(spectacle.date_limite_retour).toLocaleDateString() : '—'}</p>
                <p><strong>{T.rentreeLabel}:</strong> {spectacle.date_rentree ? new Date(spectacle.date_rentree).toLocaleDateString() : <em>{T.pendingBadge}</em>}</p>
                <p>
                  <span className={isPending ? 'status-badge status-pending' : 'status-badge status-completed'}>
                    {isPending ? T.pendingBadge : T.completedBadge}
                  </span>
                </p>
              </div>

              <div className="person-split-actions">
                <button className="btn-edit" onClick={() => handleEdit(spectacle)}>
                  {T.edit}
                </button>
                {isPending && (
                  <button className="connect-btn" onClick={() => handleMarkReturn(spectacle.id)}>
                    {T.markReturned}
                  </button>
                )}
                <button className="btn-delete" onClick={() => handleDelete(spectacle.id)}>
                  {T.delete}
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
