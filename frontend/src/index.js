import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
// import MobileStudent from './MobileStudent';
import './components/MobileStudent.css';
import MobileStudent from './components/MobileStudent';
// Simple routing based on URL path
const AppRouter = () => {
  const path = window.location.pathname;
  
  if (path === '/mobile' || path.startsWith('/mobile')) {
    return <MobileStudent />;
  }
  
  return <App />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);