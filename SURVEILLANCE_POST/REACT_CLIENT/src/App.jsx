import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LangProvider, useLang } from './context/LangContext';
import Navigation from './components/Navigation';
import Home from './components/Home';
import VideoStream from './components/VideoStream';
import CheckIns from './components/CheckIns';
import Companies from './components/Companies';
import Persons from './components/Persons';
import Cameras from './components/Cameras';
import Spectacles from './components/Spectacles';
import Rentrees from './components/Rentrees';
import './styles/Common.css';

function AppContent() {
  const { lang } = useLang();
  return (
    <div className="app" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/video-stream/" element={<VideoStream />} />
        <Route path="/check-ins/" element={<CheckIns />} />
        <Route path="/compagnies/" element={<Companies />} />
        <Route path="/persons/" element={<Persons />} />
        <Route path="/cameras/" element={<Cameras />} />
        <Route path="/spectacles/" element={<Spectacles />} />
        <Route path="/rentrees/" element={<Rentrees />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <LangProvider>
      <Router>
        <AppContent />
      </Router>
    </LangProvider>
  );
}

export default App;
