import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, MapPin, Clock, FileText, List, CalendarRange } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, Modal, Spinner, useToast } from '../components/ui';
import { DateChip } from './Home';
import { fmtTime, fmtWeekday, sameDay, toLocalInput } from '../lib/format';

const DOW = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // poniedziałek = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function Meetings() {
  const { perms } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(() => new Date());
  const [view, setView] = useState('calendar');
  const [form, setForm] = useState(null);

  const load = () => api.listMeetings().then(setMeetings).catch(console.error);
  useEffect(() => {
    load();
  }, []);

  const days = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const byDay = (d) => (meetings || []).filter((m) => sameDay(m.starts_at, d));
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const shift = (n) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const today = new Date();

  if (!meetings) return <Spinner center />;
  const dayList = byDay(selected);
  const upcoming = meetings.filter((m) => new Date(m.starts_at) >= new Date(today.toDateString()));
  const past = meetings.filter((m) => new Date(m.starts_at) < new Date(today.toDateString())).reverse();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Spotkania</h1>
          <p>Kalendarz spotkań, agendy i listy obecności.</p>
        </div>
        <div className="row">
          <div className="tabs">
            <button className={`tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
              <CalendarRange size={16} /> Kalendarz
            </button>
            <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
              <List size={16} /> Lista
            </button>
          </div>
          {perms.manageMeetings && (
            <button className="btn btn-primary" onClick={() => setForm({ starts: selected })}>
              <Plus size={18} /> <span className="hide-mobile">Nowe spotkanie</span>
            </button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="card cal">
            <div className="cal-head">
              <h2>{monthName}</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCursor({ y: today.getFullYear(), m: today.getMonth() });
                  setSelected(today);
                }}
              >
                Dziś
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc">
                <ChevronLeft size={18} />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => shift(1)} aria-label="Następny miesiąc">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="cal-grid">
              {DOW.map((d) => (
                <div key={d} className="cal-dow">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const evs = byDay(d);
                const cls = [
                  'cal-day',
                  d.getMonth() !== cursor.m && 'other',
                  sameDay(d, today) && 'today',
                  sameDay(d, selected) && 'selected',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button key={d.toISOString()} className={cls} onClick={() => setSelected(d)}
                    onDoubleClick={() => perms.manageMeetings && setForm({ starts: d })}>
                    <span className="cal-num">{d.getDate()}</span>
                    {evs.slice(0, 2).map((m) => (
                      <span key={m.id} className={`cal-ev ${new Date(m.starts_at) < today ? 'past' : ''}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/spotkania/${m.id}`); }}>
                        {fmtTime(m.starts_at)} {m.title}
                      </span>
                    ))}
                    {evs.length > 2 && <span className="tiny muted">+{evs.length - 2} więcej</span>}
                    {evs.length > 0 && (
                      <span className="cal-dots">
                        {evs.slice(0, 3).map((m) => (
                          <i key={m.id} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 style={{ textTransform: 'capitalize' }}>
                {fmtWeekday(selected)}, {selected.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
              </h2>
            </div>
            {dayList.length === 0 ? (
              <Empty icon={CalendarDays} title="Brak spotkań tego dnia">
                {perms.manageMeetings ? 'Kliknij „Nowe spotkanie”, aby coś zaplanować.' : null}
              </Empty>
            ) : (
              <MeetingList items={dayList} />
            )}
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <h2>Nadchodzące</h2>
              <span className="badge">{upcoming.length}</span>
            </div>
            {upcoming.length ? <MeetingList items={upcoming} /> : <Empty icon={CalendarDays} title="Brak zaplanowanych spotkań" />}
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Minione</h2>
              <span className="badge">{past.length}</span>
            </div>
            {past.length ? <MeetingList items={past} /> : <Empty icon={CalendarDays} title="Brak minionych spotkań" />}
          </div>
        </div>
      )}

      {form && (
        <MeetingForm
          initial={{ starts_at: defaultStart(form.starts) }}
          onClose={() => setForm(null)}
          onSaved={(m) => {
            setForm(null);
            load();
            navigate(`/spotkania/${m.id}`);
          }}
        />
      )}
    </>
  );
}

function defaultStart(d) {
  const x = new Date(d || Date.now());
  x.setHours(18, 0, 0, 0);
  return x.toISOString();
}

export function MeetingList({ items }) {
  return (
    <div className="list">
      {items.map((m) => (
        <Link key={m.id} to={`/spotkania/${m.id}`} className="list-item">
          <DateChip date={m.starts_at} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <b className="truncate" style={{ display: 'block' }}>
              {m.title}
            </b>
            <div className="small muted row row-wrap" style={{ gap: '2px 10px' }}>
              <span className="row" style={{ gap: 4 }}>
                <Clock size={13} /> {fmtTime(m.starts_at)}
                {m.ends_at && `–${fmtTime(m.ends_at)}`}
              </span>
              {m.location && (
                <span className="row truncate" style={{ gap: 4 }}>
                  <MapPin size={13} /> {m.location}
                </span>
              )}
              {m.agenda_url && (
                <span className="row" style={{ gap: 4, color: 'var(--sky-700)' }}>
                  <FileText size={13} /> Agenda
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={18} className="muted" />
        </Link>
      ))}
    </div>
  );
}

export function MeetingForm({ initial = {}, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: initial.title || 'Spotkanie komisji',
    starts_at: toLocalInput(initial.starts_at),
    ends_at: toLocalInput(initial.ends_at || (initial.starts_at && new Date(new Date(initial.starts_at).getTime() + 90 * 60e3))),
    location: initial.location || '',
    description: initial.description || '',
    agenda_url: initial.agenda_url || '',
    auto_agenda: initial.auto_agenda ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.agenda_url && !/^https:\/\/(docs|drive)\.google\.com\//.test(f.agenda_url.trim()))
      return toast.error('Link do agendy powinien prowadzić do Google Docs / Drive');
    if (f.ends_at && f.ends_at < f.starts_at) return toast.error('Koniec spotkania nie może być przed początkiem');
    setBusy(true);
    try {
      const m = await api.saveMeeting({
        ...(initial.id ? { id: initial.id } : {}),
        title: f.title.trim(),
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
        location: f.location.trim(),
        description: f.description.trim(),
        agenda_url: f.agenda_url.trim(),
        auto_agenda: f.auto_agenda,
      });
      toast.success(initial.id ? 'Zapisano zmiany' : 'Dodano spotkanie');
      onSaved(m);
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial.id ? 'Edytuj spotkanie' : 'Nowe spotkanie'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" form="meeting-form" disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <form id="meeting-form" className="stack" onSubmit={submit}>
        <div className="field">
          <label>Tytuł</label>
          <input className="input" required maxLength={140} value={f.title} onChange={set('title')} />
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Początek</label>
            <input className="input" type="datetime-local" required value={f.starts_at} onChange={set('starts_at')} />
          </div>
          <div className="field">
            <label>Koniec</label>
            <input className="input" type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
          </div>
        </div>
        <div className="field">
          <label>Miejsce</label>
          <input className="input" value={f.location} onChange={set('location')} placeholder="np. C-13, sala 0.31 albo link do Teams" />
        </div>
        <div className="field">
          <label>Opis</label>
          <textarea className="textarea" rows={3} value={f.description} onChange={set('description')} />
        </div>
        <div className="field">
          <label>Agenda (Google Docs)</label>
          <input className="input" type="url" value={f.agenda_url} onChange={set('agenda_url')}
            placeholder="https://docs.google.com/document/d/…" />
          <span className="hint">Wklej link do istniejącego dokumentu albo zostaw puste.</span>
        </div>
        {!f.agenda_url && (
          <label className="check">
            <input type="checkbox" checked={f.auto_agenda} onChange={set('auto_agenda')} />
            <span className="small">Utwórz agendę automatycznie w folderze komisji na Google Drive</span>
          </label>
        )}
      </form>
    </Modal>
  );
}
