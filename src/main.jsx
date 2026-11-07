import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/lexend';
import './styles.css';
import App from './App';

// iOS Safari ignoruje user-scalable=no – blokujemy gesty przybliżania ręcznie.
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
);
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
let lastTouch = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const t = Date.now();
    if (t - lastTouch < 300 && !e.target.closest('input, textarea, select')) e.preventDefault();
    lastTouch = t;
  },
  { passive: false }
);
// Próba zablokowania orientacji (działa w zainstalowanej aplikacji PWA na Androidzie).
try {
  screen.orientation?.lock?.('portrait').catch(() => {});
} catch {
  /* nieobsługiwane */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
