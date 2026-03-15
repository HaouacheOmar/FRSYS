import userSvg from '../assets/users-svgrepo-com.svg';
import '../styles/GuestCards.css';

export function GuestMiniCard({ username, is_online }) {
  return (
    <div className={`guest-mini-card${is_online ? ' online' : ' offline'}`}> 
      <div className="guest-mini-photo">
        <img src={userSvg} alt="user" />
        <span className={`status-dot ${is_online ? 'online' : 'offline'}`}></span>
      </div>
      <div className="guest-mini-info">
        <div className="guest-mini-username">{username}</div>
        <div className="guest-mini-status">
          <span className={is_online ? 'status-active' : 'status-inactive'}>
            {is_online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}