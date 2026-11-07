import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, RoleBadge, useConfirm, useToast } from '../components/ui';
import { QR_WINDOW_SECONDS, makeAttendancePayload } from '../lib/qr';

const SECRET_CACHE = 'kulturka-qr-secret';

export default function MyQr() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canvasRef = useRef(null);
  const [secret, setSecret] = useState(() => {
    // sekret w pamięci telefonu → kod działa także bez internetu
    try {
      const c = JSON.parse(localStorage.getItem(SECRET_CACHE) || 'null');
      return c?.userId === profile.id ? c.secret : null;
    } catch {
      return null;
    }
  });
  const [left, setLeft] = useState(QR_WINDOW_SECONDS);
  const [error, setError] = useState('');

  const loadSecret = async () => {
    try {
      const s = await api.getMyQrSecret();
      if (!s) throw new Error('Brak klucza QR – skontaktuj się z zarządem');
      localStorage.setItem(SECRET_CACHE, JSON.stringify({ userId: profile.id, secret: s }));
      setSecret(s);
      setError('');
    } catch (e) {
      if (!secret) setError(e.message);
    }
  };

  useEffect(() => {
    loadSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!secret) return;
    let lastWindow = -1;
    let stop = false;
    const tick = async () => {
      const now = Date.now();
      const w = Math.floor(now / 1000 / QR_WINDOW_SECONDS);
      setLeft(QR_WINDOW_SECONDS - Math.floor((now / 1000) % QR_WINDOW_SECONDS));
      if (w !== lastWindow && canvasRef.current && !stop) {
        lastWindow = w;
        const payload = await makeAttendancePayload(profile.id, secret, now);
        QRCode.toCanvas(canvasRef.current, payload, {
          width: 520,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0d2436', light: '#ffffff' },
        });
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [secret, profile.id]);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="card qr-card">
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 18 }}>
          <Avatar profile={profile} size={48} />
          <div style={{ textAlign: 'left' }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{profile.full_name}</b>
            <div>
              <RoleBadge role={profile.role} />
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <>
            <div className="qr-wrap">
              <canvas ref={canvasRef} />
            </div>
            <div style={{ maxWidth: 296, margin: '0 auto' }}>
              <div className="qr-progress">
                <div style={{ width: `${(left / QR_WINDOW_SECONDS) * 100}%` }} />
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                Kod odświeży się za <b>{left}s</b>
              </p>
            </div>
          </>
        )}

        <h2 style={{ marginTop: 18 }}>Kod obecności</h2>
        <p className="small muted" style={{ marginTop: 6 }}>
          Pokaż go osobie z zarządu na spotkaniu. Kod zmienia się co 30 sekund, więc zrzut ekranu wysłany komuś innemu nie zadziała.
        </p>
        <div className="row small" style={{ justifyContent: 'center', gap: 16, marginTop: 14, color: 'var(--sky-700)' }}>
          <span className="row" style={{ gap: 5 }}>
            <Sun size={15} /> Podkręć jasność ekranu
          </span>
          <span className="row" style={{ gap: 5 }}>
            <ShieldCheck size={15} /> Działa offline
          </span>
        </div>
      </div>

      <div className="center" style={{ marginTop: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            const ok = await confirm({
              title: 'Wygenerować nowy klucz?',
              message: 'Użyj tego, jeśli podejrzewasz, że ktoś inny ma dostęp do Twojego kodu (np. zgubiony telefon). Stare kody przestaną działać.',
              confirmText: 'Generuj nowy',
            });
            if (!ok) return;
            try {
              await api.regenerateQrSecret();
              localStorage.removeItem(SECRET_CACHE);
              setSecret(null);
              await loadSecret();
              toast.success('Wygenerowano nowy klucz QR');
            } catch (e) {
              toast.error(e);
            }
          }}
        >
          <RefreshCw size={15} /> Nowy klucz QR
        </button>
      </div>
    </div>
  );
}
