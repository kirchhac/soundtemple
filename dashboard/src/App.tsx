import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import FrequencyDashboard from './pages/FrequencyDashboard';
import ModelViewer from './pages/ModelViewer';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">
            <h1>Sound Temple</h1>
            <span className="nav-subtitle">Archaeoacoustic Research Dashboard</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              Frequency Analysis
            </NavLink>
            <NavLink to="/models" className={({ isActive }) => isActive ? 'active' : ''}>
              3D LiDAR Scans
            </NavLink>
          </div>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<FrequencyDashboard />} />
            <Route path="/models" element={<ModelViewer />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
