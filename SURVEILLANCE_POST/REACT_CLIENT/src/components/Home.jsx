import { useLang } from '../context/LangContext';
import '../styles/Common.css';

const Home = () => {
  const { T } = useLang();
  return (
    <div className="container">
      <h1>{T.homeTitle}</h1>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>
          {T.homeWelcome}
        </p>
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
