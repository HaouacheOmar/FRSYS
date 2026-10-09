import { useMemo, useState } from 'react';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import '../styles/Common.css';
import { GuestMiniCard } from './GuestMiniCard';

const Home = () => {
  const { T } = useLang();
  const { role } = useAuth();
  const [onlineGuests, setOnlineGuests] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const notificationCount = useMemo(() => notifications.length, [notifications]);
  const socketLabel = { connected: T.connected, connecting: T.connecting, disconnected: T.disconnected };

  const socketState = useAdminNotifications({
    enabled: role === 'admin',
    onEvent: (event, payload) => {
      if (event === 'guest_snapshot') {
        setOnlineGuests(payload.online_guests || []);
        return;
      }
      if (event !== 'guest_online' && event !== 'guest_offline') return;

      setNotifications((prev) => [
        {
          id: `${payload.user_id}-${Date.now()}`,
          event,
          username: payload.username,
          at: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12));

      setOnlineGuests((prev) => {
        const withoutUser = prev.filter((guest) => guest.user_id !== payload.user_id);
        if (event === 'guest_online') {
          return [...withoutUser, payload].sort((a, b) => a.username.localeCompare(b.username));
        }
        return withoutUser;
      });
    },
  });

  return (
    <div className="container">
      <h1>{T.homeTitle}</h1>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>
          {T.homeWelcome}
        </p>

        {role === 'admin' && (
          <div style={{ margin: '0 0 24px', textAlign: 'left' }}>
            <div className={`status ${socketState}`} style={{ marginBottom: 10 }}>
              {T.guestNotificationSocket}: {socketLabel[socketState] || socketState}
            </div>
            <div className="form-container" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>{T.guestsOnline} ({onlineGuests.length})</h2>
              {onlineGuests.length === 0 ? (
                <p>{T.noGuestsOnline}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 8 }}>
                  {onlineGuests.map((guest) => (
                    <GuestMiniCard
                      key={guest.user_id}
                      username={guest.username}
                      is_online={true}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="form-container">
              <h2 style={{ marginTop: 0 }}>{T.guestNotifications} ({notificationCount})</h2>
              {notifications.length === 0 ? (
                <p>{T.noGuestActivity}</p>
              ) : (
                <div className="detections-list">
                  {notifications.map((note) => (
                    <div key={note.id} className="detection-item">
                      <strong>{note.username}</strong> {note.event === 'guest_online' ? T.guestConnectedAt : T.guestDisconnectedAt} {note.at}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '40px' }}>
          <div className="feature-card">
            <h3>{T.homeVideoStream}</h3>
            <p>{T.homeVideoStreamDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homeCheckIns}</h3>
            <p>{T.homeCheckInsDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homeCompanies}</h3>
            <p>{T.homeCompaniesDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homePersons}</h3>
            <p>{T.homePersonsDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homeCameras}</h3>
            <p>{T.homeCamerasDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homeSpectacles}</h3>
            <p>{T.homeSpectaclesDesc}</p>
          </div>
          <div className="feature-card">
            <h3>{T.homeReturns}</h3>
            <p>{T.homeReturnsDesc}</p>
          </div>
        </div>
      </div>
      <style>{`
        .feature-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s;
        }
        .feature-card:hover {
          transform: translateY(-5px);
        }
        .feature-card h3 {
          margin: 0 0 10px 0;
          color: white;
        }
        .feature-card p {
          margin: 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default Home;
