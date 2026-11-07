import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PartyPopper, Plus, MapPin, CalendarDays, Users, Clock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, Modal, Spinner, gear, useToast } from '../components/ui';
import { EVENT_ROLE_LABELS, isMemberRole } from '../lib/perms';
import { fmtDate, toLocalInput } from '../lib/format';

export const EVENT_COLORS = ['#8B5CF6', '#45B0E5', '#2394D0', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#0D2436'];

export function eventDates(e) {
  if (!e.starts_at) return 'Termin do ustalenia';
  const a = fmtDate(e.starts_at);
  if (!e.ends_at) return a;
  const b = fmtDate(e.ends_at);
  return a === b ? a : `${a} – ${b}`;
}

export function EventCard({ e, membership, count }) {
  return (
    <Link to={`/wydarzenia/${e.id}`} className="card event-card">
      <div className="event-cover" style={{ background: `linear-gradient(135deg, ${e.color}, ${e.color}cc)` }}>
        <img src={gear} alt="" />
        <div className="row row-wrap" style={{ gap: 6, position: 'relative' }}>
          {membership?.status === 'accepted' && <span className="badge badge-event">{EVENT_ROLE_LABELS[membership.role]}</span>}
          {membership?.status === 'applied' && <span className="badge badge-event">Zgłoszenie oczekuje</span>}
          {e.status === 'finished' && <span className="badge badge-event">Zakończone</span>}
          {e.status === 'active' && e.recruitment_open && !membership && <span className="badge badge-event">Rekrutacja otwarta</span>}
        </div>
      </div>
      <div className="card-pad" style={{ paddingTop: 14 }}>
        <h3 style={{ fontSize: 17 }}>{e.name}</h3>
        <div className="small muted stack" style={{ gap: 2, marginTop: 6 }}>
          <span className="row" style={{ gap: 6 }}>
            <CalendarDays size={14} /> {eventDates(e)}
          </span>
          {e.location && (
            <span className="row truncate" style={{ gap: 6 }}>
              <MapPin size={14} /> {e.location}
            </span>
          )}
          <span className="row" style={{ gap: 6 }}>
            <Users size={14} /> {count} {count === 1 ? 'osoba' : 'osób'} w zespole
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Events() {
  const { perms } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(false);

  const load = () =>
    Promise.all([api.listEvents(), api.listMyEventMemberships(), api.listAllEventMembers()])
      .then(([events, mine, all]) => setData({ events, mine, all }))
      .catch(console.error);
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    if (!data) return null;
    const my = (id) => data.mine.find((m) => m.event_id === id && m.status !== 'rejected');
    const count = (id) => data.all.filter((m) => m.event_id === id && m.status === 'accepted').length;
    const decorate = (e) => ({ e, membership: my(e.id), count: count(e.id) });
    const list = data.events.map(decorate);
    return {
      mine: list.filter((x) => x.membership?.status === 'accepted' && x.e.status === 'active'),
      applied: list.filter((x) => x.membership?.status === 'applied'),
      open: list.filter((x) => !x.membership && x.e.status === 'active'),
      finished: list.filter((x) => x.e.status === 'finished'),
    };
  }, [data]);

  if (!groups) return <Spinner center />;

  const Section = ({ title, items, empty }) => (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>
      {items.length === 0 ? (
        empty ? <div className="card">{empty}</div> : null
      ) : (
        <div className="grid grid-3">
          {items.map((x) => (
            <EventCard key={x.e.id} {...x} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Wydarzenia</h1>
          <p>Twoje wydarzenia, rekrutacje do sztabu i kadry oraz ich własne ogłoszenia i spotkania.</p>
        </div>
        {perms.chair && (
          <button className="btn btn-primary" onClick={() => setForm(true)}>
            <Plus size={18} /> Nowe wydarzenie
          </button>
        )}
      </div>

      <Section
        title="Twoje wydarzenia"
        items={groups.mine}
        empty={
          <Empty icon={PartyPopper} title="Nie należysz jeszcze do żadnego wydarzenia">
            Zgłoś się do sztabu lub kadry poniżej – po przyjęciu wydarzenie pojawi się tutaj automatycznie.
          </Empty>
        }
      />
      {groups.applied.length > 0 && <Section title="Twoje zgłoszenia" items={groups.applied} />}
      <Section
        title="Pozostałe wydarzenia"
        items={groups.open}
        empty={<Empty icon={Clock} title="Brak innych aktywnych wydarzeń" />}
      />
      {groups.finished.length > 0 && <Section title="Zakończone" items={groups.finished} />}

      {form && (
        <EventForm
          onClose={() => setForm(false)}
          onSaved={(e) => {
            setForm(false);
            navigate(`/wydarzenia/${e.id}`);
          }}
        />
      )}
    </>
  );
}

export function EventForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const { perms } = useAuth();
  const [people, setPeople] = useState([]);
  const [f, setF] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    location: initial?.location || '',
    starts_at: toLocalInput(initial?.starts_at),
    ends_at: toLocalInput(initial?.ends_at),
    color: initial?.color || EVENT_COLORS[0],
    recruitment_open: initial?.recruitment_open ?? true,
    coordinator: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    if (!initial && perms.chair) api.listProfiles().then((p) => setPeople(p.filter((x) => isMemberRole(x.role)))).catch(() => {});
  }, [initial, perms.chair]);

  const submit = async (e) => {
    e.preventDefault();
    if (f.ends_at && f.starts_at && f.ends_at < f.starts_at) return toast.error('Koniec nie może być przed początkiem');
    setBusy(true);
    try {
      const ev = await api.saveEvent({
        ...(initial?.id ? { id: initial.id } : {}),
        name: f.name.trim(),
        description: f.description.trim(),
        location: f.location.trim(),
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
        color: f.color,
        recruitment_open: f.recruitment_open,
      });
      if (!initial && f.coordinator) await api.addEventMember(ev.id, f.coordinator, 'coordinator');
      toast.success(initial ? 'Zapisano zmiany' : 'Utworzono wydarzenie');
      onSaved(ev);
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" form="event-form" disabled={busy || !f.name.trim()}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <form id="event-form" className="stack" onSubmit={submit}>
        <div className="field">
          <label>Nazwa</label>
          <input className="input" required maxLength={120} value={f.name} onChange={set('name')} placeholder="np. Noc Kultury 2027" />
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Początek</label>
            <input className="input" type="datetime-local" value={f.starts_at} onChange={set('starts_at')} />
          </div>
          <div className="field">
            <label>Koniec</label>
            <input className="input" type="datetime-local" value={f.ends_at} onChange={set('ends_at')} />
          </div>
        </div>
        <div className="field">
          <label>Miejsce</label>
          <input className="input" value={f.location} onChange={set('location')} />
        </div>
        <div className="field">
          <label>Opis</label>
          <textarea className="textarea" rows={4} maxLength={5000} value={f.description} onChange={set('description')} />
        </div>
        <div className="field">
          <label>Kolor</label>
          <div className="swatches">
            {EVENT_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }}
                onClick={() => setF((x) => ({ ...x, color: c }))} aria-label={c} />
            ))}
          </div>
        </div>
        {!initial && perms.chair && (
          <div className="field">
            <label>Koordynator główny</label>
            <select className="select" value={f.coordinator} onChange={set('coordinator')}>
              <option value="">— wybierz później —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <span className="hint">Koordynator ma w tym wydarzeniu uprawnienia przewodniczącego – bez akceptacji zarządu.</span>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={f.recruitment_open} onChange={set('recruitment_open')} />
          <span>Rekrutacja otwarta – członkowie mogą zgłaszać się do sztabu i kadry</span>
        </label>
      </form>
    </Modal>
  );
}
