import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, QrCode, CalendarDays, Megaphone, Users, ArrowLeft, Sparkles } from 'lucide-react';
import { api, isDemo } from '../api';
import { useAuth } from '../auth';
import { gear, useToast } from '../components/ui';
import { DemoRibbon, RotateLock } from '../components/Layout';
import { ROLE_LABELS } from '../lib/perms';

function AuthShell({ children }) {
  return (
    <>
      {isDemo && <DemoRibbon />}
      <div className="auth">
        <section className="auth-hero">
          <img src={gear} className="gear-bg" alt="" />
          <div className="row" style={{ gap: 14, position: 'relative' }}>
            <img src="./logo-ss-pwr.jpg" alt="Samorząd Studencki PWr" style={{ width: 64, borderRadius: 16 }} />
            <div style={{ fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
              <b style={{ fontSize: 18, letterSpacing: '0.04em' }}>KULTURKA</b>
              <div style={{ fontSize: 13, opacity: 0.9 }}>Samorząd Studencki Politechniki Wrocławskiej</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <h1>Komisja Kultury i&nbsp;Projektów</h1>
            <p>Jedno miejsce dla członków komisji: ogłoszenia, spotkania, agendy i obecność – na komputerze i w telefonie.</p>
            <div className="auth-features">
              <span>
                <Megaphone size={16} /> Ważne ogłoszenia
              </span>
              <span>
                <CalendarDays size={16} /> Kalendarz spotkań
              </span>
              <span>
                <QrCode size={16} /> Obecność kodem QR
              </span>
              <span>
                <Users size={16} /> Profile członków
              </span>
            </div>
          </div>
          <div className="small" style={{ opacity: 0.85, position: 'relative' }}>
            © {new Date().getFullYear()} Samorząd Studencki PWr · Komisja Kultury i Projektów
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-box">
            <div className="auth-logo-mobile">
              <img src="./logo-ss-pwr.jpg" alt="" />
              <div>
                <b>Kulturka</b>
                <div className="small muted">Komisja Kultury i Projektów SS PWr</div>
              </div>
            </div>
            {children}
          </div>
        </section>
      </div>
      <RotateLock />
    </>
  );
}

export function Login() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.signIn({ email: email.trim(), password });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h2>Witaj ponownie 👋</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Zaloguj się na konto członka komisji.
      </p>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <div className="input-icon">
            <Mail size={18} />
            <input id="email" className="input" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="imie.nazwisko@student.pwr.edu.pl" />
          </div>
        </div>
        <div className="field">
          <div className="row">
            <label htmlFor="pw">Hasło</label>
            <div className="spacer" />
            <Link to="/reset" className="small">Nie pamiętasz hasła?</Link>
          </div>
          <div className="input-icon">
            <Lock size={18} />
            <input id="pw" className="input" type="password" autoComplete="current-password" required={!isDemo}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} style={{ height: 48, marginTop: 6 }}>
          {busy ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>
      <p className="center small muted" style={{ marginTop: 20 }}>
        Nie masz konta? <Link to="/rejestracja">Zarejestruj się</Link>
      </p>
      {isDemo && <DemoPersonas />}
    </AuthShell>
  );
}

function DemoPersonas() {
  return (
    <div className="demo-box">
      <div className="row small" style={{ fontWeight: 700, color: 'var(--sky-700)' }}>
        <Sparkles size={16} /> Szybkie logowanie (demo)
      </div>
      <div className="persona-grid">
        {api.demoPersonas().map(([label, u]) => (
          <button key={u.id} type="button" className="persona" onClick={() => api.signInAs(u.id)}>
            <b>{label}</b>
            <span>{u.full_name}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        W trybie demo hasło nie jest sprawdzane. Role: {Object.values(ROLE_LABELS).slice(0, 4).join(', ')}.
      </p>
    </div>
  );
}

export function Register() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', password2: '', consent: false });
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    api.getPublicSettings().then((s) => setDomain(s?.allowed_email_domain || '')).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Hasło musi mieć co najmniej 8 znaków');
    if (form.password !== form.password2) return toast.error('Hasła nie są takie same');
    if (domain && !form.email.toLowerCase().endsWith('@' + domain.toLowerCase()))
      return toast.error(`Użyj adresu w domenie @${domain}`);
    if (!form.consent) return toast.error('Zaakceptuj zgodę na przetwarzanie danych');
    setBusy(true);
    try {
      const res = await api.signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        consent: form.consent,
      });
      if (res.needsConfirmation) setDone(true);
      else navigate('/');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <AuthShell>
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="stat-icon" style={{ width: 64, height: 64, borderRadius: 20 }}>
            <Mail size={30} />
          </div>
          <h2>Sprawdź skrzynkę</h2>
          <p className="muted">
            Wysłaliśmy link potwierdzający na <b>{form.email}</b>. Po potwierdzeniu zaloguj się – Twoje konto będzie czekało na akceptację zarządu.
          </p>
          <Link to="/" className="btn btn-secondary">Wróć do logowania</Link>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell>
      <Link to="/" className="row small muted" style={{ marginBottom: 14 }}>
        <ArrowLeft size={16} /> Logowanie
      </Link>
      <h2>Dołącz do komisji</h2>
      <p className="muted" style={{ marginBottom: 22 }}>
        Po rejestracji ktoś z zarządu zatwierdzi Twoje konto.
      </p>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="fn">Imię i nazwisko</label>
          <div className="input-icon">
            <User size={18} />
            <input id="fn" className="input" required value={form.fullName} onChange={set('fullName')} autoComplete="name" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="em">E-mail {domain && <span className="muted">(tylko @{domain})</span>}</label>
          <div className="input-icon">
            <Mail size={18} />
            <input id="em" className="input" type="email" required value={form.email} onChange={set('email')}
              autoComplete="email" placeholder={domain ? `nr_albumu@${domain}` : 'twoj@email.pl'} />
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="p1">Hasło</label>
            <input id="p1" className="input" type="password" required minLength={8} value={form.password}
              onChange={set('password')} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="p2">Powtórz hasło</label>
            <input id="p2" className="input" type="password" required value={form.password2} onChange={set('password2')}
              autoComplete="new-password" />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.consent} onChange={set('consent')} />
          <span className="small muted">
            Wyrażam zgodę na przetwarzanie moich danych (imię, nazwisko, e-mail, dane profilu, obecności) przez Komisję Kultury i Projektów SS PWr
            w celu organizacji prac komisji. Mogę w każdej chwili usunąć konto w ustawieniach profilu.
          </span>
        </label>
        <button className="btn btn-primary btn-block" disabled={busy} style={{ height: 48 }}>
          {busy ? 'Tworzenie konta…' : 'Utwórz konto'}
        </button>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <AuthShell>
      <Link to="/" className="row small muted" style={{ marginBottom: 14 }}>
        <ArrowLeft size={16} /> Logowanie
      </Link>
      <h2>Reset hasła</h2>
      {sent ? (
        <div className="alert alert-success" style={{ marginTop: 16 }}>
          Jeśli konto istnieje, wysłaliśmy na {email} link do ustawienia nowego hasła.
        </div>
      ) : (
        <form className="stack" onSubmit={submit} style={{ marginTop: 16 }}>
          <p className="muted">Podaj adres e-mail konta – wyślemy link do zmiany hasła.</p>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
          <button className="btn btn-primary btn-block">Wyślij link</button>
        </form>
      )}
    </AuthShell>
  );
}

export function NewPassword() {
  const toast = useToast();
  const { clearRecovery } = useAuth();
  const [pw, setPw] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error('Hasło musi mieć co najmniej 8 znaków');
    try {
      await api.updatePassword(pw);
      toast.success('Hasło zmienione');
      clearRecovery();
      window.location.hash = '#/';
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <AuthShell>
      <h2>Ustaw nowe hasło</h2>
      <form className="stack" onSubmit={submit} style={{ marginTop: 16 }}>
        <input className="input" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Nowe hasło (min. 8 znaków)" autoComplete="new-password" />
        <button className="btn btn-primary btn-block">Zapisz hasło</button>
      </form>
    </AuthShell>
  );
}
