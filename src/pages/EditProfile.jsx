import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Trash2, KeyRound, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Spinner, useConfirm, useToast } from '../components/ui';
import { resizeImage } from '../lib/image';

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

export default function EditProfile() {
  const { profile: me, perms, setProfile } = useAuth();
  const [params] = useSearchParams();
  const otherId = params.get('u');
  const editingOther = otherId && otherId !== me.id && perms.board;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');

  useEffect(() => {
    (editingOther ? api.getProfile(otherId) : Promise.resolve(me)).then((p) => setF({ ...p }));
  }, [editingOther, otherId, me]);

  if (!f) return <Spinner center />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

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

  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return toast.error('Podaj imię i nazwisko');
    setBusy(true);
    try {
      const fields = ['full_name', 'faculty', 'study_field', 'study_year', 'bio', 'phone', 'instagram', 'facebook', 'show_email', 'show_phone', 'avatar_url', 'notify_email'];
      const patch = Object.fromEntries(fields.map((k) => [k, typeof f[k] === 'string' ? f[k].trim() : f[k]]));
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
          <h1>{editingOther ? `Edycja profilu: ${f.full_name}` : 'Edytuj profil'}</h1>
          <p>Te informacje widzą inni członkowie komisji.</p>
        </div>
      </div>

      <form className="stack" style={{ gap: 18 }} onSubmit={save}>
        <div className="card card-pad">
          <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Avatar profile={f} size={92} />
              <button type="button" className="btn btn-primary btn-icon" onClick={() => fileRef.current?.click()}
                style={{ position: 'absolute', right: -4, bottom: -4, borderRadius: '50%', width: 36, height: 36 }} aria-label="Zmień zdjęcie">
                <Camera size={16} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 220, gap: 8 }}>
              <div className="field">
                <label>Imię i nazwisko</label>
                <input className="input" value={f.full_name} onChange={set('full_name')} required maxLength={80} />
              </div>
              {f.avatar_url && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setF((x) => ({ ...x, avatar_url: '' }))}>
                  Usuń zdjęcie
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card card-pad stack">
          <h3>Studia</h3>
          <div className="field">
            <label>Wydział</label>
            <select className="select" value={f.faculty} onChange={set('faculty')}>
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
              <input className="input" value={f.study_field} onChange={set('study_field')} maxLength={80} />
            </div>
            <div className="field">
              <label>Rok / stopień</label>
              <input className="input" value={f.study_year} onChange={set('study_year')} placeholder="np. 2 rok inż." maxLength={40} />
            </div>
          </div>
          <div className="field">
            <label>O mnie</label>
            <textarea className="textarea" rows={4} maxLength={1500} value={f.bio} onChange={set('bio')}
              placeholder="Czym się zajmujesz w komisji, co lubisz, w czym możesz pomóc…" />
          </div>
        </div>

        <div className="card card-pad stack">
          <h3>Kontakt i prywatność</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Telefon</label>
              <input className="input" type="tel" value={f.phone} onChange={set('phone')} maxLength={20} />
            </div>
            <div className="field">
              <label>Instagram</label>
              <input className="input" value={f.instagram} onChange={set('instagram')} placeholder="@nazwa" maxLength={40} />
            </div>
          </div>
          <div className="field">
            <label>Facebook (link lub nazwa)</label>
            <input className="input" value={f.facebook} onChange={set('facebook')} maxLength={120} />
          </div>
          <label className="check">
            <input type="checkbox" checked={f.show_email} onChange={set('show_email')} />
            <span>Pokazuj mój e-mail innym członkom</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={f.show_phone} onChange={set('show_phone')} />
            <span>Pokazuj mój telefon innym członkom</span>
          </label>
          <p className="hint">Zarząd zawsze widzi dane kontaktowe członków.</p>
          <label className="check">
            <input type="checkbox" checked={f.notify_email ?? true} onChange={set('notify_email')} />
            <span>
              Wysyłaj mi powiadomienia e-mail (zatwierdzenie konta, ważne ogłoszenia, przyjęcie do wydarzenia, przypomnienia o spotkaniach)
            </span>
          </label>
        </div>

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
              Usunięcie konta trwale kasuje Twój profil, obecności i zdjęcie z bazy aplikacji (RODO). Pliki już zapisane na Google Drive komisji
              (np. archiwalne listy obecności) usuwa zarząd na prośbę.
            </p>
            <button
              className="btn btn-danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Usunąć konto?',
                  message: 'Tej operacji nie można cofnąć. Twój profil i historia obecności zostaną trwale usunięte.',
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
