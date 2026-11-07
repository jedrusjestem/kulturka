import { useState } from 'react';
import { Share, X, Smartphone } from 'lucide-react';

const KEY = 'kulturka-install-hint-dismissed';

/** Podpowiedź instalacji aplikacji na ekranie głównym (iPhone nie pokazuje jej sam). */
export default function InstallHint() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const android = /Android/.test(ua);
  const [hidden, setHidden] = useState(() => !!localStorage.getItem(KEY));
  if (standalone || hidden || (!ios && !android)) return null;
  return (
    <div className="install-hint">
      <Smartphone size={26} color="var(--sky-600)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <b>Dodaj Kulturkę do ekranu głównego</b>
        <div className="muted small">
          {ios ? (
            <>
              W Safari stuknij <Share size={13} style={{ verticalAlign: '-2px' }} /> <b>Udostępnij</b>, a potem <b>„Do ekranu początkowego”</b>.
            </>
          ) : (
            <>
              W Chrome otwórz menu <b>⋮</b> i wybierz <b>„Zainstaluj aplikację”</b>.
            </>
          )}{' '}
          Aplikacja otworzy się na pełnym ekranie, a kod QR zadziała bez internetu.
        </div>
      </div>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        style={{ width: 30, height: 30, flexShrink: 0 }}
        aria-label="Ukryj"
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setHidden(true);
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
