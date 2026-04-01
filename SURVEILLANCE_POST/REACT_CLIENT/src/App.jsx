import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { LangProvider, useLang } from './context/LangContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Home from './components/Home';
import VideoStream from './components/VideoStream';
import CheckIns from './components/CheckIns';
import Companies from './components/Companies';
import Persons from './components/Persons';
import Cameras from './components/Cameras';
import Spectacles from './components/Spectacles';
import Rentrees from './components/Rentrees';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterWithToken from './components/RegisterWithToken';
import AccessControl from './components/AccessControl';
import './styles/Common.css';

function AppContent() {
  const { lang } = useLang();
  const { role, isAuthenticated } = useAuth();

  const defaultRoute = role === 'guest' ? '/video-stream/' : '/home';

  return (
    <div className="app" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {isAuthenticated && <Navigation />}
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? defaultRoute : '/login'} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register-with-token" element={<RegisterWithToken />} />

        <Route
          path="/home"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <Home />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/video-stream/"
          element={(
            <ProtectedRoute allowedRoles={['admin', 'guest']}>
              <VideoStream />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/check-ins/"
          element={(
            <ProtectedRoute allowedRoles={['admin', 'guest']}>
              <CheckIns />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/rentrees/"
          element={(
            <ProtectedRoute allowedRoles={['admin', 'guest']}>
              <Rentrees />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compagnies/"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <Companies />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/persons/"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <Persons />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/cameras/"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <Cameras />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/spectacles/"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <Spectacles />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/access-control/"
          element={(
            <ProtectedRoute allowedRoles={['admin']}>
              <AccessControl />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? defaultRoute : '/login'} replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </Router>
      </LangProvider>
    </AuthProvider>
  );
}

export default App;
