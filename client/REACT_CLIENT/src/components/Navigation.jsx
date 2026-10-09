import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo_app.svg';
import '../styles/Navigation.css';

const Navigation = () => {
  const { T, toggle } = useLang();
  const { role, user, logout } = useAuth();
  const { pathname } = useLocation();
  const [openFor, setOpenFor] = useState(null); // mobile menu is open for this path only
  const menuOpen = openFor === pathname; // navigating closes it
  const isAdmin = role === 'admin';

  const links = [
    { to: '/video-stream/', label: T.navVideoStream },
    { to: '/check-ins/', label: T.navCheckIns },
    { to: '/rentrees/', label: T.navReturns },
    ...(isAdmin
      ? [
          { to: '/compagnies/', label: T.navCompanies },
          { to: '/persons/', label: T.navPersons },
          { to: '/cameras/', label: T.navCameras },
          { to: '/spectacles/', label: T.navSpectacles },
          { to: '/access-control/', label: T.navAccess },
        ]
      : []),
  ];

  return (
    <nav className="navbar" aria-label="Main">
      <div className="nav-container">
        <Link to={isAdmin ? '/home' : '/video-stream/'} className="nav-logo">
          <img src={logo} alt="" aria-hidden="true" />
          <span>{T.appTitle}</span>
        </Link>

        <button
          type="button"
          className="nav-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="nav-menu"
          aria-label="Menu"
          onClick={() => setOpenFor(menuOpen ? null : pathname)}
        >
          <span aria-hidden="true" />
        </button>

        <div id="nav-menu" className={`nav-panel${menuOpen ? ' is-open' : ''}`}>
          <ul className="nav-menu">
            {links.map(({ to, label }) => (
              <li key={to} className="nav-item">
                <NavLink to={to} className="nav-link">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="nav-active-pill"
                          transition={{ type: 'spring', bounce: 0, visualDuration: 0.3 }}
                        />
                      )}
                      <span className="nav-link-label">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="nav-actions">
            <span className="nav-user" title={role}>
              <span className="nav-user-avatar" aria-hidden="true">
                {(user?.username || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="nav-user-name">{user?.username}</span>
              <span className={`nav-role nav-role-${role}`}>{role}</span>
            </span>
            <button type="button" className="lang-toggle" onClick={toggle} aria-label="Toggle language">
              {T.toggleLang}
            </button>
            <button type="button" className="logout-btn" onClick={logout}>
              {T.logout}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
