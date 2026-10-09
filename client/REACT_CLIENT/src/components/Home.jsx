import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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

  const features = [
    { to: '/video-stream/', title: T.homeVideoStream, text: T.homeVideoStreamDesc },
    { to: '/check-ins/', title: T.homeCheckIns, text: T.homeCheckInsDesc },
    { to: '/rentrees/', title: T.homeReturns, text: T.homeReturnsDesc },
    { to: '/spectacles/', title: T.homeSpectacles, text: T.homeSpectaclesDesc },
    { to: '/persons/', title: T.homePersons, text: T.homePersonsDesc },
    { to: '/compagnies/', title: T.homeCompanies, text: T.homeCompaniesDesc },
    { to: '/cameras/', title: T.homeCameras, text: T.homeCamerasDesc },
  ];

  return (
    <div className="container">
      <h1>{T.homeTitle}</h1>
      <p className="page-subtitle">{T.homeWelcome}</p>

      {role === 'admin' && (
        <>
          <div className="panel">
            <h2>{T.guestsOnline} ({onlineGuests.length})</h2>
            <div className={`status ${socketState}`}>
              {T.guestNotificationSocket}: {socketLabel[socketState] || socketState}
            </div>
            {onlineGuests.length === 0 ? (
              <p className="empty-state">{T.noGuestsOnline}</p>
            ) : (
              <motion.div className="guest-mini-list" layout>
                <AnimatePresence initial={false}>
                  {onlineGuests.map((guest) => (
                    <motion.div
                      key={guest.user_id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                    >
                      <GuestMiniCard username={guest.username} is_online />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          <div className="panel">
            <h2>{T.guestNotifications} ({notificationCount})</h2>
            {notifications.length === 0 ? (
              <p className="empty-state">{T.noGuestActivity}</p>
            ) : (
              <div className="detections-list">
                <AnimatePresence initial={false}>
                  {notifications.map((note) => (
                    <motion.div
                      key={note.id}
                      layout
                      className={`detection-item${note.event === 'guest_online' ? '' : ' no-match'}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <strong>{note.username}</strong>{' '}
                      {note.event === 'guest_online' ? T.guestConnectedAt : T.guestDisconnectedAt}{' '}
                      <span className="mono">{note.at}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </>
      )}

      <div className="feature-grid">
        {features.map(({ to, title, text }) => (
          <Link key={to} to={to} className="feature-card">
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="feature-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;
