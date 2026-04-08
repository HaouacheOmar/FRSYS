// protected route: wrapper to restrict routes by authentication and role
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const { T } = useLang();
  const location = useLocation();

  // while auth state is loading, show a spinner text
  if (isLoading) {
    return <div className="container"><p>{T.loading}</p></div>;
  }

  // not authenticated -> redirect to login and keep intended location
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // if roles are provided and user role isn't allowed, redirect accordingly
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'guest') {
      return <Navigate to="/video-stream/" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  // allowed: render children
  return children;
};

export default ProtectedRoute;
