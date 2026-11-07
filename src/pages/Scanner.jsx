import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { ArrowLeft, CheckCircle2, XCircle, WifiOff, CameraOff, Keyboard, SwitchCamera, CloudUpload } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { meetingPerms } from '../lib/perms';
import { Avatar, useToast } from '../components/ui';
import { fmtTime } from '../lib/format';

const QUEUE_KEY = 'kulturka-scan-queue';
const readQueue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
const writeQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

function beep(ok) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
  } catch {
    /* brak dźwięku */
  }
}

export default function Scanner() {
  const { id } = useParams();
  const toast = useToast();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const lastRef = useRef({ text: '', at: 0 });
  const busyRef = useRef(false);
  const [meeting, setMeeting] = useState(null);
  const [camError, setCamError] = useState('');
  const [results, setResults] = useState([]);
  const [queue, setQueue] = useState(() => readQueue().filter((x) => x.meetingId === id));
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const { profile, perms } = useAuth();
  const [allowed, setAllowed] = useState(perms.scan ? true : null);

  useEffect(() => {
    Promise.all([api.getMeeting(id), api.listMeetingAccess(id).catch(() => [])])
      .then(([m, acc]) => {
        setMeeting(m);
        setAllowed(meetingPerms(profile, perms, m, acc).scan);
      })
      .catch(() => setAllowed(false));
  }, [id, profile, perms]);

  const pushResult = (r) => setResults((list) => [{ ...r, at: new Date().toISOString(), key: Math.random() }, ...list].slice(0, 20));

  const flush = useCallback(async () => {
    const all = readQueue();
    if (!all.length || !navigator.onLine) return;
    const left = [];
    let sent = 0;
    for (const item of all) {
      try {
        const r = await api.scanAttendance(item.meetingId, item.payload, item.scannedAt);
        if (r.ok) sent++;
        else if (item.meetingId === id) pushResult({ ok: false, error: `(offline) ${r.error}` });
      } catch {
        left.push(item);
      }
    }
    writeQueue(left);
    setQueue(left.filter((x) => x.meetingId === id));
    if (sent) toast.success(`Wysłano ${sent} zapisanych offline skanów`);
  }, [id, toast]);

  const handle = useCallback(
    async (text) => {
      text = String(text || '').trim();
      const nowTs = Date.now();
      if (!text || busyRef.current) return;
      if (lastRef.current.text === text && nowTs - lastRef.current.at < 4000) return;
      lastRef.current = { text, at: nowTs };

      if (text.includes('#/u/')) {
        beep(false);
        pushResult({ ok: false, error: 'To statyczny kod profilu – poproś o kod z zakładki „Mój kod QR”' });
        return;
      }
      if (!text.startsWith('KKP1.')) {
        beep(false);
        pushResult({ ok: false, error: 'To nie jest kod obecności Kulturki' });
        return;
      }
      const scannedAt = new Date().toISOString();
      if (!navigator.onLine) {
        const q = [...readQueue(), { meetingId: id, payload: text, scannedAt }];
        writeQueue(q);
        setQueue(q.filter((x) => x.meetingId === id));
        beep(true);
        pushResult({ ok: true, offline: true, full_name: 'Zapisano offline' });
        return;
      }
      busyRef.current = true;
      try {
        const r = await api.scanAttendance(id, text, scannedAt);
        beep(r.ok);
        pushResult(r);
      } catch (e) {
        // błąd sieci → kolejka offline
        if (/fetch|network|Failed/i.test(e.message)) {
          const q = [...readQueue(), { meetingId: id, payload: text, scannedAt }];
          writeQueue(q);
          setQueue(q.filter((x) => x.meetingId === id));
          pushResult({ ok: true, offline: true, full_name: 'Zapisano offline' });
        } else {
          beep(false);
          pushResult({ ok: false, error: e.message });
        }
      } finally {
        busyRef.current = false;
      }
    },
    [id]
  );

  useEffect(() => {
    const on = () => {
      setOnline(true);
      flush();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    flush();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [flush]);

  useEffect(() => {
    if (!videoRef.current || allowed !== true) return;
    const s = new QrScanner(videoRef.current, (res) => handle(res.data), {
      returnDetailedScanResult: true,
      preferredCamera: 'environment',
      maxScansPerSecond: 6,
      highlightScanRegion: false,
      highlightCodeOutline: false,
    });
    scannerRef.current = s;
    s.start().catch((e) => {
      setCamError(
        String(e).includes('NotAllowed') || String(e).includes('permission')
          ? 'Brak zgody na użycie kamery. Zezwól na dostęp do kamery w ustawieniach przeglądarki.'
          : 'Nie udało się uruchomić kamery. Skaner wymaga HTTPS i aparatu w urządzeniu.'
      );
    });
    return () => {
      s.stop();
      s.destroy();
    };
  }, [handle, allowed]);

  const switchCam = async () => {
    try {
      const cams = await QrScanner.listCameras(true);
      if (cams.length < 2) return toast('Brak innej kamery');
      const s = scannerRef.current;
      const cur = s._preferredCamera;
      await s.setCamera(cur === 'user' ? 'environment' : 'user');
    } catch (e) {
      toast.error(e);
    }
  };

  const okCount = results.filter((r) => r.ok && !r.offline).length;

  if (allowed === false)
    return (
      <div className="card card-pad center stack" style={{ maxWidth: 480, margin: '0 auto', alignItems: 'center' }}>
        <CameraOff size={40} className="muted" />
        <h2>Brak uprawnień do skanera</h2>
        <p className="muted small">Obecność na tym spotkaniu sprawdza zarząd albo osoby z rolą, której zarząd nadał dostęp.</p>
        <Link to={`/spotkania/${id}`} className="btn btn-secondary">
          Wróć do spotkania
        </Link>
      </div>
    );

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link to={`/spotkania/${id}`} className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
        <ArrowLeft size={16} /> Wróć do spotkania
      </Link>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>Skaner obecności</h1>
          <p>{meeting ? `${meeting.title} · ${fmtTime(meeting.starts_at)}` : '…'}</p>
        </div>
        <span className="badge badge-success">{okCount} zeskanowanych</span>
      </div>

      {!online && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          <WifiOff size={18} /> Brak internetu – skany zapisują się w telefonie i wyślą się automatycznie po odzyskaniu połączenia.
        </div>
      )}
      {queue.length > 0 && online && (
        <div className="alert" style={{ marginBottom: 12 }}>
          <CloudUpload size={18} />
          <div style={{ flex: 1 }}>{queue.length} skanów czeka na wysłanie.</div>
          <button className="btn btn-secondary btn-sm" onClick={flush}>
            Wyślij teraz
          </button>
        </div>
      )}

      <div className="scanner-box">
        <video ref={videoRef} muted playsInline />
        {!camError && <div className="scanner-frame" />}
        {camError && (
          <div className="center" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', padding: 24 }}>
            <div>
              <CameraOff size={42} style={{ margin: '0 auto 10px' }} />
              <p>{camError}</p>
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'center', margin: '14px 0' }}>
        <button className="btn btn-ghost btn-sm" onClick={switchCam}>
          <SwitchCamera size={16} /> Zmień kamerę
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setManual((v) => !v)}>
          <Keyboard size={16} /> Wpisz kod ręcznie
        </button>
      </div>

      {manual && (
        <form
          className="row"
          style={{ marginBottom: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            lastRef.current = { text: '', at: 0 };
            handle(code);
            setCode('');
          }}
        >
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="KKP1.…" />
          <button className="btn btn-primary">Dodaj</button>
        </form>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {results.map((r) => (
          <div key={r.key} className={`scan-result ${r.ok ? 'ok' : 'err'}`}>
            {r.ok && !r.offline ? <Avatar profile={r} size={42} /> : r.ok ? <WifiOff size={26} /> : <XCircle size={26} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{r.ok ? r.full_name : 'Nie zaliczono'}</b>
              <div className="small">
                {r.ok ? (r.offline ? 'Wyślę, gdy wróci internet' : r.already ? 'Już był(a) oznaczony(a) jako obecny(a)' : 'Obecność zapisana ✓') : r.error}
              </div>
            </div>
            {r.ok && !r.offline && <CheckCircle2 size={22} />}
          </div>
        ))}
        {results.length === 0 && !camError && (
          <p className="center small muted">Skieruj aparat na kod QR członka. Kod odświeża się co 30 sekund, więc zrzut ekranu nie zadziała.</p>
        )}
      </div>
    </div>
  );
}
