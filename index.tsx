import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Handle Vite dynamic import chunk mismatches across deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected, reloading...', event);
  const key = `vite_preload_reload_${window.location.pathname}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, 'true');
    window.location.reload();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);