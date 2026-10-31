import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import { AdminApp } from './components/admin/AdminApp';
import './index.css';

function Root() {
  const [isAdmin, setIsAdmin] = useState(() => {
    const isSubdomainAdmin = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');
    return isSubdomainAdmin || window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#admin');
  });

  useEffect(() => {
    const handlePopState = () => {
      const isSubdomainAdmin = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');
      setIsAdmin(isSubdomainAdmin || window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#admin'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <>
      {isAdmin ? <AdminApp /> : <App />}
      <Analytics />
      <SpeedInsights />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
