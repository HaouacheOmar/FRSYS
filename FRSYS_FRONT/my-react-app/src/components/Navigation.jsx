import { Link } from 'react-router-dom';
import '../styles/Navigation.css';

const Navigation = () => {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          Face Recognition System
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/video-stream" className="nav-link">
              Video Stream
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/check-ins" className="nav-link">
              Check-Ins
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/compagnies" className="nav-link">
              Companies
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/persons" className="nav-link">
              Persons
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/cameras" className="nav-link">
              Cameras
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/spectacles" className="nav-link">
              Spectacles
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/rentrees" className="nav-link">
              Returns
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
