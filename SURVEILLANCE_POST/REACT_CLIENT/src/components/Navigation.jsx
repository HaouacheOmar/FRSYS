import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import '../styles/Navigation.css';

const Navigation = () => {
  const { T, toggle } = useLang();
  const { role, user, logout } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to={isAdmin ? '/home' : '/video-stream/'} className="nav-logo">
          {T.appTitle}
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/video-stream" className="nav-link">{T.navVideoStream}</Link>
          </li>
          <li className="nav-item">
            <Link to="/check-ins" className="nav-link">{T.navCheckIns}</Link>
          </li>
          <li className="nav-item">
            <Link to="/rentrees" className="nav-link">{T.navReturns}</Link>
          </li>
          {isAdmin && (
            <>
              <li className="nav-item">
                <Link to="/compagnies" className="nav-link">{T.navCompanies}</Link>
              </li>
              <li className="nav-item">
                <Link to="/persons" className="nav-link">{T.navPersons}</Link>
              </li>
              <li className="nav-item">
                <Link to="/cameras" className="nav-link">{T.navCameras}</Link>
              </li>
              <li className="nav-item">
                <Link to="/spectacles" className="nav-link">{T.navSpectacles}</Link>
              </li>
              <li className="nav-item">
                <Link to="/access-control" className="nav-link">{T.navAccess}</Link>
              </li>
            </>
          )}
        </ul>
        <div className="nav-actions">
          <div className="nav-user">{user?.username} ({role})</div>
          <button className="lang-toggle" onClick={toggle} aria-label="Toggle language">
            {T.toggleLang}
          </button>
          <button className="logout-btn" onClick={logout}>
            {T.logout}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
