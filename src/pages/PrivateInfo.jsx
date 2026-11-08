import { useState } from 'react';
import { Lock, ShieldCheck, LogOut } from 'lucide-react';
import { api, isDemo } from '../api';
import { useAuth } from '../auth';
import { gear, useToast } from '../components/ui';
import { DemoRibbon, RotateLock } from '../components/Layout';

/** Formularz danych poufnych – widzi je tylko zarząd (zarząd, przewodniczący, administrator) */
export function PrivateInfoFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="stack">
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label>Telefon *</label>
          <input className="input" type="tel" required maxLength={30} value={value.phone || ''} onChange={set('phone')} autoComplete="tel" placeholder="np. 600 100 200" />
        </div>
        <div className="field">
          <label>Numer indeksu *</label>
          <input className="input" required inputMode="numeric" maxLength={20} value={value.student_id || ''} onChange={set('student_id')} placeholder="np. 270123" />
        </div>
      </div>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label>Data urodzenia</label>
          <input className="input" type="date" value={value.birth_date || ''} onChange={set('birth_date')} />
        </div>
        <div className="field">
          <label>Kontakt awaryjny</label>
          <input className="input" maxLength={200} value={value.emergency_contact || ''} onChange={set('emergency_contact')} placeholder="np. Mama – 600 000 000" />
        </div>
      </div>
      <div className="field">
        <label>Informacje dla zarządu</label>
        <textarea className="textarea" rows={3} maxLength={1000} value={value.info || ''} onChange={set('info')}
          placeholder="np. dieta lub alergie (na wyjazdy i wydarzenia), dostępność, inne ważne informacje" />
      </div>
    </div>
  );
}

export const privateComplete = (p) => !!(p && (p.phone || '').trim() && (p.student_id || '').trim());

/** Ekran po zalogowaniu: najpierw dane poufne, potem aplikacja */
export default function PrivateInfoOnboarding() {
  const { profile, refreshPrivate, privateInfo } = useAuth();
  const toast = useToast();
  const [v, setV] = useState(() => ({ phone: '', student_id: '', birth_date: '', emergency_contact: '', info: '', ...(privateInfo || {}) }));
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!privateComplete(v)) return toast.error('Podaj telefon i numer indeksu');
    setBusy(true);
    try {
      await api.saveMyPrivate({ ...v, phone: v.phone.trim(), student_id: v.student_id.trim() });
      await refreshPrivate();
      toast.success('Dziękujemy! Dane zapisane.');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };
  return (
    <>
      {isDemo && <DemoRibbon />}
      <div className="content" style={{ maxWidth: 640 }}>
        <div className="hero-card" style={{ marginBottom: 18 }}>
          <img src={gear} className="gear-bg" alt="" />
          <h1>Cześć, {profile.full_name.split(' ')[0]}! 👋</h1>
          <p>Zanim zaczniesz – uzupełnij dane kontaktowe dla zarządu komisji.</p>
        </div>
        <form className="card card-pad stack" onSubmit={submit}>
          <div className="alert">
            <Lock size={18} />
            <div className="small">
              <b>Te informacje widzi wyłącznie zarząd</b> (zarząd, przewodniczący, administrator). Nie pojawią się na Twoim profilu ani nigdzie
              publicznie. Twój e-mail też jest widoczny tylko dla zarządu. Dane możesz zmienić w każdej chwili w „Edytuj profil”.
            </div>
          </div>
          <PrivateInfoFields value={v} onChange={setV} />
          <div className="row row-wrap">
            <button type="button" className="btn btn-ghost" onClick={() => api.signOut()}>
              <LogOut size={16} /> Wyloguj
            </button>
            <div className="spacer" />
            <button className="btn btn-primary" disabled={busy}>
              <ShieldCheck size={17} /> {busy ? 'Zapisywanie…' : 'Zapisz i przejdź dalej'}
            </button>
          </div>
        </form>
      </div>
      <RotateLock />
    </>
  );
}
