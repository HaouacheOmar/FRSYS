import { useEffect, useState } from 'react';
import { spectaclesAPI, API_BASE_URL } from '../services/api';
import { useLang } from '../context/LangContext';

export default function OutingsByTitle() {
  const { T } = useLang();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(true);

  useEffect(() => {
    loadGroups();
  }, [pendingOnly]);

  async function loadGroups() {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (pendingOnly) params.pending = 1;
      const data = await spectaclesAPI.byTitle(params);
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container"><p>{T.loading}</p></div>;
  return (
    <div className="container">
      <h1>{T.outingsByTitle || 'Outings by Title'}</h1>
      <div style={{ marginBottom: 12 }}>
        <label>
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> {T.showPendingOnly || 'Show pending only'}
        </label>
        <button style={{ marginLeft: 8 }} onClick={loadGroups}>{T.refresh || 'Refresh'}</button>
      </div>

      {error && <div className="error">{error}</div>}

      {groups.map((g) => (
        <section key={g.title} className="outing-group">
          <h2>{g.title} <small>({g.count})</small></h2>
          <div className="persons-row">
            {g.persons.map((p) => (
              <article key={p.id} className="person-card">
                <img src={`${API_BASE_URL}/persons/${p.id}/main-photo/`} alt={`${p.prenom} ${p.nom}`} width={96} height={96} onError={(e) => e.currentTarget.src='/main.svg'} />
                <div>
                  <strong>{p.prenom} {p.nom}</strong>
                  <div>{p.mat}</div>
                  <div>{p.compagnie?.label || ''}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && <p>{T.noResults || 'No outings found'}</p>}
    </div>
  );
}
