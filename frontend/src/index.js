import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { markNativeDocument, isNativeApp } from './native/capacitorNative';
import { installKeyboardInset } from './native/keyboardInset';
import App from './App';

markNativeDocument();
installKeyboardInset();

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

function dropServiceWorkersAndCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

// Localhost: never register — SW caching broke CRA hot rebuilds before.
// Native Capacitor: never register — a SW pins a stale SPA after web deploys.
// Production browser: register the shell SW for PWA installability.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalDevHost() || isNativeApp()) {
      dropServiceWorkersAndCaches();
      return;
    }
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {
      // Installability still works once SW is reachable; ignore transient errors.
    });
  });
}
