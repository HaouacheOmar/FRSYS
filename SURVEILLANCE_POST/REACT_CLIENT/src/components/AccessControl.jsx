import { useEffect, useState, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';
import { useLang } from '../context/LangContext';
import '../styles/GuestCards.css';
import userSvg from '../assets/users-svgrepo-com.svg';
import { useAuth } from '../context/AuthContext';

const AccessControl = () => {
  const { T } = useLang();
  const { user } = useAuth();
  const [grantForm, setGrantForm] = useState({
    label: '',
    role_to_grant: 'guest',
    max_uses: 10,
    expires_in_hours: 72,
  });
  const [roleForm, setRoleForm] = useState({ username: '', role: 'guest' });
  const [issuedToken, setIssuedToken] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [guests, setGuests] = useState([]);
  const [guestForm, setGuestForm] = useState({ username: '', password: '' });
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '', is_active: true });

  const wsRef = useRef(null);

  const loadGuests = async () => {
    try {
      const payload = await authAPI.listGuests();
      setGuests(payload?.results || []);
    } catch {
      // Keep existing list on fetch failures
    }
  };

  // Real-time: handle guest online/offline events
// Real-time: handle guest online/offline events
  useEffect(() => {
    let ws;
    if (user && user.role === 'admin') {
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/admin/notifications/`);
      
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'admin_notification') return;
          if (data.event === 'guest_snapshot') {
            const onlineMap = {};
            (data.payload?.online_guests || []).forEach(g => { onlineMap[g.username] = true; });
            setGuests(prev => prev.map(g => ({ ...g, is_online: !!onlineMap[g.username] })));
            return;
          }
          if (data.event === 'guest_online' || data.event === 'guest_offline') {
            const payload = data.payload || {};
            setGuests(prev => prev.map(g =>
              g.username === payload.username ? { ...g, is_online: payload.is_online, last_seen: payload.last_seen } : g
            ));
          }
        } catch {}
      };
      ws.onclose = () => { wsRef.current = null; };
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);


  useEffect(() => {
    loadGuests();
  }, []);

  const onIssueToken = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = await authAPI.createGrantToken({
        ...grantForm,
        max_uses: Number(grantForm.max_uses),
        expires_in_hours: Number(grantForm.expires_in_hours),
      });
      setIssuedToken(payload);
      setMessage(T.grantTokenIssued);
    } catch (err) {
      setError(err.message || T.failedCreateToken);
    }
  };

  const onGrantRole = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = await authAPI.grantRole(roleForm);
      setMessage(`${T.updatedUserRolePrefix} ${payload.username} ${T.updatedUserRoleMiddle} ${payload.role}.`);
      await loadGuests();
    } catch (err) {
      setError(err.message || T.failedGrantRole);
    }
  };

  const onCreateGuest = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await authAPI.createGuest(guestForm);
      setGuestForm({ username: '', password: '' });
      setMessage(T.guestAccountCreated);
      await loadGuests();
    } catch (err) {
      setError(err.message || T.failedCreateGuest);
    }
  };

  const onStartEditGuest = (guest) => {
    setEditingGuestId(guest.id);
    setEditForm({ username: guest.username, password: '', is_active: guest.is_active });
  };

  const onSaveGuest = async (guestId) => {
    setError('');
    setMessage('');

    const payload = {
      username: editForm.username,
      is_active: editForm.is_active,
    };
    if (editForm.password) {
      payload.password = editForm.password;
    }

    try {
      await authAPI.updateGuest(guestId, payload);
      setEditingGuestId(null);
      setEditForm({ username: '', password: '', is_active: true });
      setMessage(T.guestAccountUpdated);
      await loadGuests();
    } catch (err) {
      setError(err.message || T.failedUpdateGuest);
    }
  };

  const onDeleteGuest = async (guestId) => {
    setError('');
    setMessage('');
    try {
      await authAPI.deleteGuest(guestId);
      setMessage(T.guestAccountDeleted);
      await loadGuests();
    } catch (err) {
      setError(err.message || T.failedDeleteGuest);
    }
  };

  return (
    <div className="container">
      <h1>{T.accessControlTitle}</h1>

      {error && <div className="error">{T.errorPrefix}: {error}</div>}
      {message && <div className="status connected">{message}</div>}

      <div className="form-container">
        <h2>{T.issueRegistrationToken}</h2>
        <form onSubmit={onIssueToken}>
          <div className="form-group">
            <label>{T.label}</label>
            <input
              type="text"
              value={grantForm.label}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, label: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>{T.roleToGrant}</label>
            <select
              value={grantForm.role_to_grant}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, role_to_grant: e.target.value }))}
            >
              <option value="guest">guest</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>{T.maxUses}</label>
            <input
              type="number"
              min="1"
              value={grantForm.max_uses}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, max_uses: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>{T.expiresInHours}</label>
            <input
              type="number"
              min="1"
              value={grantForm.expires_in_hours}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, expires_in_hours: e.target.value }))}
            />
          </div>
          <button type="submit" className="connect-btn">{T.issueToken}</button>
        </form>

        {issuedToken && (
          <div className="error" style={{ marginTop: 16 }}>
            <strong>{T.registrationTokenLabel}:</strong> {issuedToken.token}
            <br />
            {T.roleLabel}: {issuedToken.role_to_grant} | {T.maxUses}: {issuedToken.max_uses}
            <br />
            {T.expiresLabel}: {new Date(issuedToken.expires_at).toLocaleString()}
          </div>
        )}
      </div>

      <div className="form-container">
        <h2>{T.grantRoleToExistingUser}</h2>
        <form onSubmit={onGrantRole}>
          <div className="form-group">
            <label>{T.username}</label>
            <input
              type="text"
              value={roleForm.username}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>{T.roleLabel}</label>
            <select
              value={roleForm.role}
              onChange={(e) => setRoleForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="guest">guest</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="submit" className="connect-btn">{T.grantRoleButton}</button>
        </form>
      </div>

      <div className="form-container">
        <h2>{T.createGuestAccount}</h2>
        <form onSubmit={onCreateGuest}>
          <div className="form-group">
            <label>{T.username}</label>
            <input
              type="text"
              value={guestForm.username}
              onChange={(e) => setGuestForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>{T.password}</label>
            <input
              type="password"
              minLength={8}
              value={guestForm.password}
              onChange={(e) => setGuestForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="connect-btn">{T.createGuestButton}</button>
        </form>
      </div>

      <div className="form-container">
        <h2>{T.manageGuestAccounts}</h2>
        {guests.length === 0 ? (
          <p>{T.noGuestAccountsFound}</p>
        ) : (
          <div className="guest-cards-list">
            {guests
              .filter((guest) => !user || guest.username !== user.username)
              .map((guest) => {
                const isEditing = editingGuestId === guest.id;
                return (
                  <div
                    key={guest.id}
                    className={`guest-card${guest.is_online ? ' online' : ' offline'}`}
                    tabIndex={0}
                  >
                    <div className="guest-card-photo">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={userSvg} alt="user" />
                        <span className={`status-dot ${guest.is_online ? 'online' : 'offline'}`}></span>
                      </div>
                    </div>
                    <div className="guest-card-info">
                      <div className="guest-card-username">{isEditing ? (
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                        />
                      ) : (
                        guest.username
                      )}</div>
                      <div className="guest-card-status">
                        <span className={guest.is_online ? 'status-active' : 'status-inactive'}>
                          {guest.is_online ? T.onlineLabel : T.offlineLabel}
                        </span>
                      </div>
                      <div className="guest-card-meta">
                        <span>{T.activeLabel}: {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                          />
                        ) : (
                          guest.is_active ? T.yes : T.no
                        )}</span>
                        <span>{T.lastSeenLabel}: {guest.last_seen ? new Date(guest.last_seen).toLocaleString() : '-'}</span>
                      </div>
                    </div>
                    <div className="guest-card-actions">
                      {isEditing ? (
                        <>
                          <input
                            type="password"
                            placeholder={T.newPasswordOptional}
                            value={editForm.password}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                          />
                          <button type="button" className="btn-edit" onClick={() => onSaveGuest(guest.id)}>{T.save}</button>
                          <button type="button" className="btn-delete" onClick={() => setEditingGuestId(null)}>{T.cancel}</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-edit" onClick={() => onStartEditGuest(guest)}>{T.edit}</button>
                          <button type="button" className="btn-delete" onClick={() => onDeleteGuest(guest.id)}>{T.delete}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessControl;
