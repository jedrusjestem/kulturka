import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, MapPin, FileText, Sheet, Pencil, Trash2, ScanLine, Check, X, Search, Download, RefreshCw, CloudOff, Cloud, Users,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Spinner, useConfirm, useToast } from '../components/ui';
import { MeetingForm } from './Meetings';
import { DateChip } from './Home';
import { fmtDate, fmtTime, fmtWeekday, normalize, relTime } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { isActiveRole } from '../lib/perms';

export async function requestSync() {
  try {
    const s = await api.getSettings();
    if (!s.apps_script_url) return false;
    await fetch(`${s.apps_script_url}?action=sync`, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { perms, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [m, setM] = useState(undefined);
  const [att, setAtt] = useState([]);
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meeting, a, p] = await Promise.all([api.getMeeting(id), api.listAttendance(id), perms.scan ? api.listProfiles() : []]);
      setM(meeting);
      setAtt(a);
      setPeople(p.filter((x) => isActiveRole(x.role)));
    } catch (e) {
      toast.error(e);
      setM(null);
    }
  }, [id, perms.scan, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const attMap = useMemo(() => Object.fromEntries(att.map((a) => [a.user_id, a])), [att]);
  const filtered = people.filter((p) => !q || normalize(p.full_name).includes(normalize(q)));
  const presentCount = people.filter((p) => attMap[p.id]?.present).length;

  if (m === undefined) return <Spinner center />;
  if (!m)
    return (
      <div className="card">
        <Empty title="Nie znaleziono spotkania">
          <Link to="/spotkania">Wróć do kalendarza</Link>
        </Empty>
      </div>
    );

  const mark = async (userId, present) => {
    const prev = att;
    setAtt((list) => {
      const rest = list.filter((a) => a.user_id !== userId);
      return present === null ? rest : [...rest, { meeting_id: id, user_id: userId, present, method: 'manual' }];
    });
    try {
      await api.setAttendance(id, userId, present);
    } catch (e) {
      setAtt(prev);
      toast.error(e);
    }
  };

  const exportCsv = () => {
    const rows = [['Imię i nazwisko', 'E-mail', 'Obecność', 'Sposób', 'Godzina']];
    people.forEach((p) => {
      const a = attMap[p.id];
      rows.push([p.full_name, p.email, a ? (a.present ? 'obecny' : 'nieobecny') : '—', a?.method === 'qr' ? 'QR' : a ? 'ręcznie' : '', a ? fmtTime(a.marked_at) : '']);
    });
    downloadCsv(`obecnosc-${fmtDate(m.starts_at).replace(/\s/g, '-')}.csv`, rows);
  };

  const mine = attMap[profile.id];
  const isPast = new Date(m.starts_at) < new Date();

  return (
    <>
      <Link to="/spotkania" className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
        <ArrowLeft size={16} /> Spotkania
      </Link>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <DateChip date={m.starts_at} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22 }}>{m.title}</h1>
            <div className="muted row row-wrap" style={{ gap: '4px 14px', marginTop: 6 }}>
              <span className="row" style={{ gap: 5, textTransform: 'capitalize' }}>
                <Clock size={15} /> {fmtWeekday(m.starts_at)}, {fmtTime(m.starts_at)}
                {m.ends_at && `–${fmtTime(m.ends_at)}`}
              </span>
              {m.location && (
                <span className="row" style={{ gap: 5 }}>
                  <MapPin size={15} /> {m.location}
                </span>
              )}
            </div>
          </div>
          {perms.manageMeetings && (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 34, height: 34 }} onClick={() => setEdit(true)} aria-label="Edytuj">
                <Pencil size={17} />
              </button>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                style={{ width: 34, height: 34 }}
                aria-label="Usuń"
                onClick={async () => {
                  if (await confirm({ message: `Usunąć spotkanie „${m.title}” wraz z obecnościami? Pliki na Google Drive zostaną.`, danger: true, confirmText: 'Usuń' })) {
                    try {
                      await api.deleteMeeting(m.id);
                      toast.success('Usunięto spotkanie');
                      navigate('/spotkania');
                    } catch (e) {
                      toast.error(e);
                    }
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}
        </div>
        {m.description && (
          <p className="pre" style={{ marginTop: 14, color: 'var(--navy-800)' }}>
            {m.description}
          </p>
        )}
        <div className="row row-wrap" style={{ marginTop: 16 }}>
          {m.agenda_url ? (
            <a className="btn btn-secondary" href={m.agenda_url} target="_blank" rel="noopener noreferrer">
              <FileText size={17} /> Agenda (Google Docs)
            </a>
          ) : (
            <span className="badge">
              <FileText size={13} /> {m.auto_agenda ? 'Agenda zostanie utworzona automatycznie' : 'Brak agendy'}
            </span>
          )}
          {perms.scan && m.sheet_url && (
            <a className="btn btn-ghost" href={m.sheet_url} target="_blank" rel="noopener noreferrer">
              <Sheet size={17} /> Lista obecności (Arkusz)
            </a>
          )}
        </div>
        {perms.scan && (
          <div className="row row-wrap small muted" style={{ marginTop: 14, gap: 8, paddingTop: 14, borderTop: '1px solid var(--gray-100)' }}>
            <span className="row" style={{ gap: 6, flex: '1 1 220px', alignItems: 'flex-start' }}>
              {m.dirty ? <CloudOff size={15} style={{ flexShrink: 0, marginTop: 2 }} /> : <Cloud size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />}
              {m.dirty
                ? 'Zmiany czekają na synchronizację z Google (automatycznie co kilka minut)'
                : `Zsynchronizowano z Google ${m.synced_at ? relTime(m.synced_at) : ''}`}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const ok = await requestSync();
                toast(ok ? 'Wysłano żądanie synchronizacji' : 'Synchronizacja Google nie jest jeszcze skonfigurowana');
                setTimeout(load, 6000);
              }}
            >
              <RefreshCw size={14} /> Synchronizuj teraz
            </button>
          </div>
        )}
      </div>

      {!perms.scan ? (
        <div className={`alert ${mine?.present ? 'alert-success' : ''}`}>
          {mine?.present ? <Check size={18} /> : <Users size={18} />}
          {mine?.present
            ? `Twoja obecność została odnotowana${mine.method === 'qr' ? ' (kod QR)' : ''}.`
            : isPast
              ? 'Nie odnotowano Twojej obecności na tym spotkaniu.'
              : 'Na spotkaniu pokaż zarządowi swój kod QR (zakładka „Mój kod QR”).'}
        </div>
      ) : (
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2>Obecność</h2>
              <div className="small muted">
                {presentCount} z {people.length} obecnych
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
                <Download size={15} /> CSV
              </button>
              <Link to={`/spotkania/${m.id}/skaner`} className="btn btn-primary btn-sm">
                <ScanLine size={16} /> Skanuj QR
              </Link>
            </div>
          </div>
          <div style={{ padding: '12px 16px 4px' }}>
            <div className="qr-progress" style={{ marginTop: 0, marginBottom: 12 }}>
              <div style={{ width: `${people.length ? (presentCount / people.length) * 100 : 0}%` }} />
            </div>
            <div className="input-icon">
              <Search size={17} />
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj osoby…" />
            </div>
          </div>
          <div>
            {filtered.map((p) => {
              const a = attMap[p.id];
              return (
                <div key={p.id} className="att-row">
                  <Avatar profile={p} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="truncate small" style={{ display: 'block' }}>
                      {p.full_name}
                    </b>
                    <span className="tiny muted">
                      {a ? (a.present ? `obecny · ${a.method === 'qr' ? 'QR' : 'ręcznie'}` : 'nieobecny') : 'nie sprawdzono'}
                    </span>
                  </div>
                  <div className="att-toggle">
                    <button className={a?.present === true ? 'on-present' : ''} onClick={() => mark(p.id, a?.present === true ? null : true)}
                      aria-label="Obecny" title="Obecny">
                      <Check size={18} />
                    </button>
                    <button className={a?.present === false ? 'on-absent' : ''} onClick={() => mark(p.id, a?.present === false ? null : false)}
                      aria-label="Nieobecny" title="Nieobecny">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <Empty title="Brak osób" />}
          </div>
        </div>
      )}

      {edit && (
        <MeetingForm
          initial={m}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            load();
          }}
        />
      )}
    </>
  );
}
