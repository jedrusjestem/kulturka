import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Trash2, KeyRound, ShieldAlert, Lock, Eye, EyeOff, Palette, X, Bell } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Spinner, useConfirm, useToast } from '../components/ui';
import { resizeImage } from '../lib/image';
import { PrivateInfoFields, privateComplete } from './PrivateInfo';
import { SOCIALS } from '../lib/socials';

const FACULTIES = [
  'W1 – Architektury',
  'W2 – Budownictwa Lądowego i Wodnego',
  'W3 – Chemiczny',
  'W4N – Informatyki i Telekomunikacji',
  'W5 – Elektryczny',
  'W6 – Geoinżynierii, Górnictwa i Geologii',
  'W7 – Inżynierii Środowiska',
  'W8N – Zarządzania',
  'W9 – Mechaniczno-Energetyczny',
  'W10 – Mechaniczny',
  'W11 – Podstawowych Problemów Techniki',
  'W12 – Elektroniki, Fotoniki i Mikrosystemów',
  'W13 – Matematyki',
  'Filia / inne',
];
export const COVER_COLORS = ['#7DC9EE', '#2394D0', '#0D2436', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
const PRIV_DEFAULT = { study: true, bio: true, interests: true, socials: true };

/** Przełącznik widoczności sekcji profilu dla innych członków */
function VisToggle({ on, onChange }) {
  return (
    <button type="button" className={`vis-toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} title="Widoczność dla innych członków">
      {on ? <Eye size={14} /> : <EyeOff size={14} />} {on ? 'Widoczne dla członków' : 'Ukryte (widzi tylko zarząd)'}
    </button>
  );
}

export default function EditProfile() {
  const { profile: me, perms, setProfile, refreshPrivate } = useAuth();
  const [params] = useSearchParams();
  const otherId = params.get('u');
  const editingOther = otherId && otherId !== me.id && perms.board;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [f, setF] = useState(null);
  const [priv, setPriv] = useState(null);
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');

  useEffect(() => {
    (editingOther ? api.getProfile(otherId) : api.getMyProfile()).then((p) => {
      const socials = { ...(p.socials || {}) };
      // starsze pola (sprzed listy serwisów)
      if (!socials.instagram && p.instagram) socials.instagram = p.instagram;
      if (!socials.facebook && p.facebook) socials.facebook = p.facebook;
      if (!socials.website && p.website) socials.website = p.website;
      setF({ ...p, socials, privacy: { ...PRIV_DEFAULT, ...(p.privacy || {}) }, interests: p.interests || [] });
    });
    if (!editingOther) api.getMyPrivate().then((x) => setPriv({ phone: '', student_id: '', birth_date: '', emergency_contact: '', info: '', ...(x || {}) }));
  }, [editingOther, otherId]);

  if (!f) return <Spinner center />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setVis = (k) => (v) => setF((x) => ({ ...x, privacy: { ...x.privacy, [k]: v } }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await resizeImage(file);
      const url = await api.uploadAvatar(blob);
      setF((x) => ({ ...x, avatar_url: url }));
      toast('Zdjęcie dodane – pamiętaj o zapisaniu');
    } catch (err) {
      toast.error(err);
    }
  };

  const addTag = () => {
    const t = tag.trim().replace(/^#/, '').toLowerCase().slice(0, 30);
    if (!t || f.interests.includes(t) || f.interests.length >= 20) return setTag('');
    setF((x) => ({ ...x, interests: [...x.interests, t] }));
    setTag('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return toast.error('Podaj imię i nazwisko');
    setBusy(true);
    try {
      const fields = ['full_name', 'headline', 'cover_color', 'faculty', 'study_field', 'study_year', 'bio', 'avatar_url', 'interests', 'privacy'];
      if (!editingOther) fields.push('notify_email');
      const patch = Object.fromEntries(fields.map((k) => [k, typeof f[k] === 'string' ? f[k].trim() : f[k]]));
      // tylko uzupełnione serwisy
      patch.socials = Object.fromEntries(
        Object.entries(f.socials || {})
          .map(([k, v]) => [k, String(v || '').trim().slice(0, 200)])
          .filter(([, v]) => v)
      );
      patch.instagram = patch.socials.instagram || '';
      patch.facebook = patch.socials.facebook || '';
      patch.website = patch.socials.website || '';
      if (!editingOther && priv) {
        if (me.role !== 'admin' && !privateComplete(priv)) throw new Error('Telefon i numer indeksu w danych poufnych są wymagane');
        if (me.role !== 'admin' || privateComplete(priv)) await api.saveMyPrivate(priv);
        refreshPrivate();
      }
      const updated = await api.updateProfile(f.id, patch);
      if (!editingOther) setProfile(updated);
      toast.success('Zapisano profil');
      navigate(perms.active ? `/u/${f.id}` : '/');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to={perms.active ? `/u/${f.id}` : '/'} className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
        <ArrowLeft size={16} /> Wróć
      </Link>
      <div className="page-head">
        <div>
          <h1>{editingOther ? `Edycja profilu: ${f.full_name}` : 'Twój profil'}</h1>
          <p>Ty decydujesz, co widzą inni członkowie. E-mail, telefon i dane poufne widzi tylko zarząd.</p>
        </div>
      </div>

      <form className="stack" style={{ gap: 18 }} onSubmit={save}>
        {/* ---- wygląd ---- */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="profile-cover" style={{ height: 110, background: coverBg(f.cover_color) }} />
          <div className="card-pad" style={{ marginTop: -54 }}>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ borderRadius: '50%', boxShadow: '0 0 0 5px #fff' }}>
                  <Avatar profile={f} size={92} />
                </div>
                <button type="button" className="btn btn-primary btn-icon" onClick={() => fileRef.current?.click()}
                  style={{ position: 'absolute', right: -4, bottom: -4, borderRadius: '50%', width: 36, height: 36 }} aria-label="Zmień zdjęcie">
                  <Camera size={16} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              </div>
              {f.avatar_url && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...x, avatar_url: '' }))}>
                  Usuń zdjęcie
                </button>
              )}
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Imię i nazwisko</label>
                <input className="input" value={f.full_name} onChange={set('full_name')} required maxLength={80} />
              </div>
              <div className="field">
                <label>Krótki opis pod imieniem</label>
                <input className="input" value={f.headline || ''} onChange={set('headline')} maxLength={120} placeholder="np. Grafika i plakaty 🎨" />
              </div>
              <div className="field">
                <label className="row" style={{ gap: 6 }}>
                  <Palette size={14} /> Kolor okładki
                </label>
                <div className="swatches">
                  {COVER_COLORS.map((c) => (
                    <button type="button" key={c} className={`swatch ${f.cover_color === c ? 'on' : ''}`} style={{ background: c }}
                      onClick={() => setF((x) => ({ ...x, cover_color: c }))} aria-label={c} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- o mnie ---- */}
        <div className="card card-pad stack">
          <div className="row row-wrap">
            <h3 style={{ flex: 1 }}>O mnie</h3>
            <VisToggle on={f.privacy.bio} onChange={setVis('bio')} />
          </div>
          <textarea className="textarea" rows={4} maxLength={1500} value={f.bio || ''} onChange={set('bio')}
            placeholder="Czym się zajmujesz w komisji, co lubisz, w czym możesz pomóc…" />
          <div className="row row-wrap" style={{ marginTop: 6 }}>
            <b className="small" style={{ flex: 1 }}>Zainteresowania</b>
            <VisToggle on={f.privacy.interests} onChange={setVis('interests')} />
          </div>
          <div className="row row-wrap" style={{ gap: 6 }}>
            {f.interests.map((t) => (
              <span key={t} className="badge badge-board">
                #{t}
                <button type="button" className="tag-x" onClick={() => setF((x) => ({ ...x, interests: x.interests.filter((y) => y !== t) }))} aria-label="Usuń">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="row">
            <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30} placeholder="np. fotografia"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }} />
            <button type="button" className="btn btn-secondary" onClick={addTag}>
              Dodaj
            </button>
          </div>
        </div>

        {/* ---- studia ---- */}
        <div className="card card-pad stack">
          <div className="row row-wrap">
            <h3 style={{ flex: 1 }}>Studia</h3>
            <VisToggle on={f.privacy.study} onChange={setVis('study')} />
          </div>
          <div className="field">
            <label>Wydział</label>
            <select className="select" value={f.faculty || ''} onChange={set('faculty')}>
              <option value="">— wybierz —</option>
              {FACULTIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
              {f.faculty && !FACULTIES.includes(f.faculty) && <option>{f.faculty}</option>}
            </select>
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Kierunek</label>
              <input className="input" value={f.study_field || ''} onChange={set('study_field')} maxLength={80} />
            </div>
            <div className="field">
              <label>Rok / stopień</label>
              <input className="input" value={f.study_year || ''} onChange={set('study_year')} placeholder="np. 2 rok inż." maxLength={40} />
            </div>
          </div>
        </div>

        {/* ---- social ---- */}
        <div className="card card-pad stack">
          <div className="row row-wrap">
            <h3 style={{ flex: 1 }}>Social media</h3>
            <VisToggle on={f.privacy.socials} onChange={setVis('socials')} />
          </div>
          <p className="small muted">Wpisz nazwę użytkownika albo wklej link. Na profilu pokażą się tylko uzupełnione serwisy.</p>
          {SOCIALS.filter((p) => p.key in (f.socials || {})).map((p) => (
            <div key={p.key} className="social-edit">
              <span className="social-dot" style={{ background: p.color }}>
                {p.short}
              </span>
              <div className="field" style={{ flex: 1 }}>
                <label>{p.label}</label>
                <input className="input" maxLength={200} value={f.socials[p.key] || ''} placeholder={p.placeholder}
                  onChange={(e) => setF((x) => ({ ...x, socials: { ...x.socials, [p.key]: e.target.value } }))} />
              </div>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ width: 34, height: 34, alignSelf: 'flex-end', marginBottom: 5 }}
                aria-label={`Usuń ${p.label}`}
                onClick={() => setF((x) => { const s2 = { ...x.socials }; delete s2[p.key]; return { ...x, socials: s2 }; })}>
                <X size={16} />
              </button>
            </div>
          ))}
          {SOCIALS.some((p) => !(p.key in (f.socials || {}))) && (
            <div className="social-add">
              {SOCIALS.filter((p) => !(p.key in (f.socials || {}))).map((p) => (
                <button type="button" key={p.key} className="social-chip add" onClick={() => setF((x) => ({ ...x, socials: { ...x.socials, [p.key]: '' } }))}>
                  <span className="social-dot sm" style={{ background: p.color }}>
                    {p.short}
                  </span>
                  + {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- dane poufne ---- */}
        {!editingOther && priv && me.role !== 'admin' && (
          <div className="card card-pad stack" style={{ borderColor: 'var(--sky-200)' }}>
            <h3 className="row" style={{ gap: 8 }}>
              <Lock size={18} /> Dane poufne – widzi tylko zarząd
            </h3>
            <p className="small muted">
              E-mail: <b>{priv.email}</b> (widoczny tylko dla zarządu). Poniższe dane nie pojawiają się na profilu.
            </p>
            <PrivateInfoFields value={priv} onChange={setPriv} />
          </div>
        )}

        {!editingOther && (
          <div className="card card-pad stack">
            <h3 className="row" style={{ gap: 8 }}>
              <Bell size={18} /> Powiadomienia
            </h3>
            <label className="check">
              <input type="checkbox" checked={f.notify_email ?? true} onChange={set('notify_email')} />
              <span>
                Wysyłaj mi powiadomienia e-mail (zatwierdzenie konta, ważne ogłoszenia, wydarzenia, sprawy, przypomnienia o spotkaniach)
              </span>
            </label>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={busy} style={{ minWidth: 160 }}>
            <Save size={17} /> {busy ? 'Zapisywanie…' : 'Zapisz profil'}
          </button>
        </div>
      </form>

      {!editingOther && (
        <div className="stack" style={{ marginTop: 28, gap: 18 }}>
          <div className="card card-pad stack">
            <h3 className="row">
              <KeyRound size={18} /> Zmiana hasła
            </h3>
            <form
              className="row row-wrap"
              onSubmit={async (e) => {
                e.preventDefault();
                if (pw.length < 8) return toast.error('Hasło musi mieć co najmniej 8 znaków');
                try {
                  await api.updatePassword(pw);
                  setPw('');
                  toast.success('Hasło zmienione');
                } catch (err) {
                  toast.error(err);
                }
              }}
            >
              <input className="input" style={{ flex: '1 1 220px' }} type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="Nowe hasło (min. 8 znaków)" autoComplete="new-password" />
              <button className="btn btn-secondary">Zmień hasło</button>
            </form>
          </div>

          <div className="card card-pad stack" style={{ borderColor: '#f9cccc' }}>
            <h3 className="row" style={{ color: 'var(--danger)' }}>
              <ShieldAlert size={18} /> Strefa niebezpieczna
            </h3>
            <p className="small muted">
              Usunięcie konta trwale kasuje Twój profil, posty, obecności i dane poufne z bazy aplikacji (RODO). Pliki już zapisane na Google Drive
              komisji (np. archiwalne listy obecności) usuwa zarząd na prośbę.
            </p>
            <button
              className="btn btn-danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Usunąć konto?',
                  message: 'Tej operacji nie można cofnąć. Twój profil, posty i historia obecności zostaną trwale usunięte.',
                  danger: true,
                  confirmText: 'Tak, usuń konto',
                });
                if (!ok) return;
                try {
                  await api.deleteMyAccount();
                  toast.success('Konto zostało usunięte');
                } catch (err) {
                  toast.error(err);
                }
              }}
            >
              <Trash2 size={17} /> Usuń moje konto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function coverBg(c) {
  const col = c || '#7DC9EE';
  return `radial-gradient(500px 200px at 20% 0%, rgba(255,255,255,0.35), transparent 60%), linear-gradient(120deg, ${col}, ${col}bb)`;
}
