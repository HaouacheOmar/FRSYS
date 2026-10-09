import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import logo from '../assets/logo_app.svg';
import '../styles/Login.css';

const Login = () => {
  const { login, isAuthenticated, isLoading, role } = useAuth();
  const { T, toggle } = useLang();
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
      <button type="button" className="auth-lang-toggle" onClick={toggle} aria-label="Toggle language">
        {T.toggleLang}
      </button>
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="" aria-hidden="true" />
          <span>{T.appTitle}</span>
        </div>
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
              autoComplete="username"
              autoFocus
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
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="connect-btn" disabled={submitting}>
            {submitting ? T.signingIn : T.signInButton}
          </button>
        </form>

        <p className="auth-footer">
          {T.haveRegistrationToken} <Link to="/register-with-token">{T.createAccount}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
