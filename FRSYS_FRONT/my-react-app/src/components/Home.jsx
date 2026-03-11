import '../styles/Common.css';

const Home = () => {
  return (
    <div className="container">
      <h1>Face Recognition System</h1>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>
          Welcome to the Face Recognition System. Use the navigation menu to access different features.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '40px' }}>
          <div className="feature-card">
            <h3>Video Stream</h3>
            <p>Real-time face recognition streaming with WebSocket</p>
          </div>
          <div className="feature-card">
            <h3>Check-Ins</h3>
            <p>Face recognition check-in system with color-coded status indicators</p>
          </div>
          <div className="feature-card">
            <h3>Companies</h3>
            <p>Manage company records and associations</p>
          </div>
          <div className="feature-card">
            <h3>Persons</h3>
            <p>Manage person profiles and face data</p>
          </div>
          <div className="feature-card">
            <h3>Cameras</h3>
            <p>Configure and manage RTSP camera feeds</p>
          </div>
          <div className="feature-card">
            <h3>Spectacles</h3>
            <p>Track spectacle checkout and returns</p>
          </div>
          <div className="feature-card">
            <h3>Returns</h3>
            <p>Monitor and manage return records</p>
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
