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
// Klawiatura otwarta → klasa na <body> (ukrywa dolne menu, żeby nie zasłaniało pól).
document.addEventListener('focusin', (e) => {
  if (e.target.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select'))
    document.body.classList.add('kb-open');
});
document.addEventListener('focusout', () => {
  setTimeout(() => {
    if (!document.activeElement?.matches?.('input, textarea, select')) document.body.classList.remove('kb-open');
  }, 100);
});

// Po schowaniu klawiatury (iOS/Android) przywróć poprawne położenie widoku.
document.addEventListener('focusout', (e) => {
  if (!e.target.matches?.('input, textarea, select')) return;
  setTimeout(() => {
    if (document.activeElement?.matches?.('input, textarea, select')) return;
    if (document.body.style.position !== 'fixed') window.scrollTo(window.scrollX, window.scrollY);
    // reset ewentualnego przybliżenia
    const meta = document.querySelector('meta[name=viewport]');
    if (meta) {
      const c = meta.content;
      meta.content = c + ' ';
      meta.content = c;
    }
  }, 120);
});

// Nowa wersja aplikacji (service worker) → automatyczne przeładowanie, żeby nikt nie siedział na starej wersji.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  // sprawdzaj aktualizacje co 30 min i po powrocie do aplikacji
  const check = () => navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
  setInterval(check, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}

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
