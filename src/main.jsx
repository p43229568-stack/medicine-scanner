import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import WeatherDashboard from './WeatherDashboard.jsx';
import './styles.css';

const isMedicinePage = window.location.pathname.replace(/\/$/, '') === '/medicine';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isMedicinePage ? <App /> : <WeatherDashboard />}
  </React.StrictMode>
);
