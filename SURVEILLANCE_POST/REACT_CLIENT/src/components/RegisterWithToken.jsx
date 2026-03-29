// register with token: simple registration form used by admin-invited users
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useLang } from '../context/LangContext';
import '../styles/Login.css';

const RegisterWithToken = () => {
  const navigate = useNavigate();
  const { T } = useLang();
  const [form, setForm] = useState({ token: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // submit registration using the provided token
  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const payload = await authAPI.registerWithToken(form);
      setMessage(`${T.accountCreatedAs} ${payload.role}. ${T.canNowSignIn}`);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || T.registrationFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{T.registerWithTokenTitle}</h1>
        <p>{T.registerWithTokenSubtitle}</p>

        {error && <div className="error">{T.errorPrefix}: {error}</div>}
        {message && <div className="status connected">{message}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="token">{T.registrationToken}</label>
            <input
              id="token"
              type="text"
              value={form.token}
              onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="username">{T.username}</label>
            <input
              id="username"
              type="text"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{T.password}</label>
            <input
              id="password"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="connect-btn" disabled={submitting}>
            {submitting ? T.creatingAccount : T.createAccountButton}
          </button>
        </form>

        <p style={{ marginTop: 12 }}>
          {T.alreadyRegistered} <Link to="/login">{T.signInLower}</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterWithToken;
