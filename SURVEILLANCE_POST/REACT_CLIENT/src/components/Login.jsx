import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import '../styles/Login.css';

const Login = () => {
  const { login, isAuthenticated, isLoading, role } = useAuth();
  const { T, toggle, lang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    const defaultTarget = role === 'guest' ? '/video-stream/' : '/home';
    return <Navigate to={location.state?.from?.pathname || defaultTarget} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await login(username, password);
      const target = loggedUser?.role === 'guest' ? '/video-stream/' : '/home';
      navigate(location.state?.from?.pathname || target, { replace: true });
    } catch (err) {
      // Try to parse error for HTTP 401 and show friendly message
      if (err.message && (err.message === 'Invalid credentials.' || err.message.includes('401'))) {
        setError(T.invalidCredentials || 'Credentials invalid');
      } else {
        setError(err.message || T.loginFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <button
        type="button"
        className="lang-toggle-btn"
        onClick={toggle}
        style={{ position: 'absolute', top: 24, right: 32, zIndex: 10 }}
        aria-label="Toggle language"
      >
        {T.toggleLang}
      </button>
      <div className="auth-card">
        <h1>{T.signInTitle}</h1>
        <p>{T.signInSubtitle}</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="username">{T.username}</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{T.password}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="connect-btn" disabled={submitting}>
            {submitting ? T.signingIn : T.signInButton}
          </button>
        </form>

        <p style={{ marginTop: 12 }}>
          {T.haveRegistrationToken} <Link to="/register-with-token">{T.createAccount}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
