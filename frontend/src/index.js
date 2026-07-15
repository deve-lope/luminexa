import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function isLocalDevHost() {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local')
  );
}

// Localhost: never register — SW caching broke CRA hot rebuilds before.
// Production / public host: register the shell SW for PWA installability.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalDevHost()) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if (window.caches) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability still works once SW is reachable; ignore transient errors.
    });
  });
}
