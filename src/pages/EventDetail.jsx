import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, MapPin, Megaphone, Users, Settings, Plus, Check, X, Pin, PinOff, Trash2, Pencil, Clock, Info, UserPlus,
  LogOut, Download, CalendarClock, Mail, Phone, Lock, Unlock, Flag, Tags,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Linkify, Modal, Spinner, gear, useConfirm, useToast } from '../components/ui';
import AvailabilityPoll, { PollFields, defaultPollValue, pollPayload } from '../components/AvailabilityPoll';
import { EVENT_ROLE_LABELS, eventPerms, isMemberRole } from '../lib/perms';
import { fmtDateTime, relTime } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { EventForm, eventDates } from './Events';
import { MeetingForm, MeetingList } from './Meetings';

export default function EventDetail() {
  const { id } = useParams();
  const { profile, perms } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('wazne');
  const [apply, setApply] = useState(false);
  const [roleData, setRoleData] = useState({ roles: [], assignments: [] });

  const load = useCallback(async () => {
    try {
      const [e, m, rd] = await Promise.all([api.getEvent(id), api.listEventMembers(id), api.listEventRoles(id).catch(() => null)]);
      setEvent(e);
      setMembers(m);
      setRoleData(rd || { roles: [], assignments: [] });
    } catch (err) {
      toast.error(err);
      setEvent(null);
    }
  }, [id, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const mine = members.find((m) => m.user_id === profile.id);
  const ep = eventPerms(perms, mine, roleData, profile.id);
  const accepted = members.filter((m) => m.status === 'accepted');

  useEffect(() => {
    if (event && !ep.member && ['wazne', 'spotkania'].includes(tab)) setTab('zespol');
  }, [event, ep.member, tab]);

  if (event === undefined) return <Spinner center />;
  if (!event)
    return (
      <div className="card">
        <Empty title="Nie znaleziono wydarzenia">
          <Link to="/wydarzenia">Wróć do listy</Link>
        </Empty>
      </div>
    );

  const tabs = [
    ep.member && ['wazne', Megaphone, 'Ważne'],
    ['zespol', Users, 'Zespół'],
    ep.member && ['spotkania', CalendarDays, 'Spotkania'],
    ep.admin && ['role', Tags, 'Role'],
    ep.admin && ['ustawienia', Settings, 'Ustawienia'],
  ].filter(Boolean);
  const pendingApps = members.filter((m) => m.status === 'applied').length;

  return (
    <>
      <Link to="/wydarzenia" className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
        <ArrowLeft size={16} /> Wydarzenia
      </Link>

      <section className="event-hero" style={{ background: `linear-gradient(135deg, ${event.color}, ${event.color}bb)` }}>
        <img src={gear} className="gear-bg" alt="" />
        <div className="row row-wrap" style={{ gap: 6, position: 'relative', marginBottom: 10 }}>
          {ep.role && <span className="badge badge-event">{EVENT_ROLE_LABELS[ep.role]}</span>}
          {!ep.role && ep.admin && <span className="badge badge-event">Pełne uprawnienia (przewodniczący)</span>}
          {ep.myRoles.map((r) => (
            <span key={r.id} className="badge badge-event">
              {r.name}
            </span>
          ))}
          {mine?.status === 'applied' && <span className="badge badge-event">Twoje zgłoszenie czeka na decyzję</span>}
          {event.status === 'finished' && <span className="badge badge-event">Zakończone</span>}
        </div>
        <h1>{event.name}</h1>
        <div className="meta">
          <span className="row" style={{ gap: 5 }}>
            <CalendarDays size={15} /> {eventDates(event)}
          </span>
          {event.location && (
            <span className="row" style={{ gap: 5 }}>
              <MapPin size={15} /> {event.location}
            </span>
          )}
          <span className="row" style={{ gap: 5 }}>
            <Users size={15} /> {accepted.length} w zespole
          </span>
        </div>
        <div className="hero-actions">
          {!mine && event.status === 'active' && event.recruitment_open && (
            <button className="btn" onClick={() => setApply(true)}>
              <UserPlus size={17} /> Zgłoś się do zespołu
            </button>
          )}
          {mine && mine.role !== 'coordinator' && (
            <LeaveButton event={event} applied={mine.status !== 'accepted'} onDone={load} />
          )}
        </div>
      </section>

      {event.description && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <p className="pre" style={{ color: 'var(--navy-800)' }}>
            <Linkify text={event.description} />
          </p>
        </div>
      )}

      {!ep.member && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <Info size={18} />
          <div>
            Ogłoszenia, ankiety i spotkania tego wydarzenia widzi tylko jego zespół.{' '}
            {mine?.status === 'applied'
              ? 'Gdy sztab przyjmie Twoje zgłoszenie, wydarzenie pojawi się w „Twoich wydarzeniach”.'
              : event.recruitment_open && event.status === 'active'
                ? 'Zgłoś się, a po przyjęciu zostaniesz dodany(-a) automatycznie.'
                : 'Rekrutacja jest zamknięta.'}
          </div>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 16 }}>
        {tabs.map(([key, Icon, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
            {key === 'zespol' && ep.team && pendingApps > 0 && <span className="count">{pendingApps}</span>}
          </button>
        ))}
      </div>

      {tab === 'wazne' && ep.member && <EventAnnouncements event={event} ep={ep} />}
      {tab === 'zespol' && <Team event={event} members={members} ep={ep} reload={load} roleData={roleData} />}
      {tab === 'role' && ep.admin && <EventRoles event={event} members={members} roleData={roleData} reload={load} />}
      {tab === 'spotkania' && ep.member && <EventMeetings event={event} ep={ep} />}
      {tab === 'ustawienia' && ep.admin && <EventSettings event={event} reload={load} />}

      {apply && <ApplyModal event={event} onClose={() => setApply(false)} onDone={() => { setApply(false); load(); }} />}
    </>
  );
}

function LeaveButton({ event, applied, onDone }) {
  const { profile } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <button
      className="btn alt"
      onClick={async () => {
        if (!(await confirm({ message: applied ? 'Wycofać zgłoszenie?' : `Opuścić zespół wydarzenia „${event.name}”?`, danger: true, confirmText: applied ? 'Wycofaj' : 'Opuść' })))
          return;
        try {
          await api.removeEventMember(event.id, profile.id);
          toast.success(applied ? 'Wycofano zgłoszenie' : 'Opuszczono wydarzenie');
          onDone();
        } catch (e) {
          toast.error(e);
        }
      }}
    >
      <LogOut size={17} /> {applied ? 'Wycofaj zgłoszenie' : 'Opuść'}
    </button>
  );
}

function ApplyModal({ event, onClose, onDone }) {
  const toast = useToast();
  const [role, setRole] = useState('crew');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`Zgłoszenie: ${event.name}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.applyToEvent(event.id, role, note.trim());
                toast.success('Wysłano zgłoszenie – sztab wydarzenia je rozpatrzy');
                onDone();
              } catch (e) {
                toast.error(e);
                setBusy(false);
              }
            }}
          >
            Wyślij zgłoszenie
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Chcę dołączyć do</label>
          <div className="tabs">
            <button type="button" className={`tab ${role === 'crew' ? 'active' : ''}`} onClick={() => setRole('crew')}>
              Kadry
            </button>
            <button type="button" className={`tab ${role === 'staff' ? 'active' : ''}`} onClick={() => setRole('staff')}>
              Sztabu
            </button>
          </div>
          <span className="hint">
            {role === 'staff'
              ? 'Sztab organizuje wydarzenie (jak zarząd). O przyjęciu do sztabu decyduje koordynator główny.'
              : 'Kadra pomaga przy realizacji wydarzenia. Zgłoszenie rozpatruje sztab.'}
          </span>
        </div>
        <div className="field">
          <label>Notatka (opcjonalnie)</label>
          <textarea className="textarea" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="W czym możesz pomóc, kiedy masz czas, doświadczenie…" />
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
//  Ważne wydarzenia
// =====================================================================
function EventAnnouncements({ event, ep }) {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [composer, setComposer] = useState(null); // null | {} | announcement

  const load = useCallback(async () => {
    try {
      setItems(await api.listEventAnnouncements(event.id));
    } catch (e) {
      toast.error(e);
    }
  }, [event.id, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      load();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items) return <Spinner center />;
  const pending = items.filter((a) => a.status === 'pending');

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <p className="small muted" style={{ flex: 1 }}>
          {ep.post ? 'Publikujesz bez akceptacji. Wpisy pozostałych osób czekają na Twoją akceptację.' : 'Twoje wpisy pojawią się po akceptacji sztabu.'}
        </p>
        <button className="btn btn-primary" onClick={() => setComposer({})}>
          <Plus size={18} /> <span className="hide-mobile">Nowe ogłoszenie</span>
        </button>
      </div>
      {ep.post && pending.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <Clock size={18} /> {pending.length} {pending.length === 1 ? 'wpis czeka' : 'wpisy czekają'} na akceptację sztabu.
        </div>
      )}
      {items.length === 0 ? (
        <div className="card">
          <Empty icon={Megaphone} title="Brak ogłoszeń wydarzenia">
            Dodaj pierwsze ogłoszenie – możesz dołączyć ankietę dostępności.
          </Empty>
        </div>
      ) : (
        <div className="stack">
          {items.map((a) => (
            <article key={a.id} className={`card ann ${a.pinned && a.status === 'published' ? 'pinned' : ''}`}>
              <div className="ann-head">
                <Avatar profile={a.author} size={38} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b className="small">{a.author?.full_name || 'Usunięty użytkownik'}</b>
                  <div className="tiny muted" title={fmtDateTime(a.created_at)}>
                    {relTime(a.created_at)}
                  </div>
                </div>
                {a.pinned && a.status === 'published' && (
                  <span className="badge badge-board">
                    <Pin size={12} /> Przypięte
                  </span>
                )}
                {a.status === 'pending' && (
                  <span className="badge badge-pending">
                    <Clock size={12} /> Czeka na sztab
                  </span>
                )}
                {a.status === 'rejected' && <span className="badge badge-rejected">Odrzucone</span>}
              </div>
              <h3>{a.title}</h3>
              <div className="ann-body">
                <Linkify text={a.body} />
              </div>
              {a.poll && (
                <AvailabilityPoll poll={a.poll} me={profile} canManage={ep.post || a.author_id === profile.id} onDeleted={load} />
              )}
              {(ep.post || a.author_id === profile.id) && (
                <div className="ann-actions">
                  {ep.post && a.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => act(() => api.updateEventAnnouncement(a.id, { status: 'published' }), 'Opublikowano')}>
                        <Check size={16} /> Akceptuj
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => act(() => api.updateEventAnnouncement(a.id, { status: 'rejected' }), 'Odrzucono')}>
                        <X size={16} /> Odrzuć
                      </button>
                    </>
                  )}
                  {ep.post && a.status === 'published' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.updateEventAnnouncement(a.id, { pinned: !a.pinned }))}>
                      {a.pinned ? <PinOff size={16} /> : <Pin size={16} />} {a.pinned ? 'Odepnij' : 'Przypnij'}
                    </button>
                  )}
                  {(ep.post || a.status === 'pending') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setComposer(a)}>
                      <Pencil size={16} /> Edytuj
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      if (await confirm({ message: `Usunąć ogłoszenie „${a.title}”?`, danger: true, confirmText: 'Usuń' }))
                        act(() => api.deleteEventAnnouncement(a.id), 'Usunięto');
                    }}
                  >
                    <Trash2 size={16} /> Usuń
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {composer && (
        <AnnouncementComposer
          initial={composer.id ? composer : null}
          canNotify={ep.post}
          direct={ep.post}
          onClose={() => setComposer(null)}
          onSubmit={async ({ title, body, notify, poll }) => {
            if (composer.id) {
              await api.updateEventAnnouncement(composer.id, { title, body });
              if (poll && !composer.poll) await api.createPoll({ event_announcement_id: composer.id, ...poll });
              return 'Zapisano zmiany';
            }
            const a = await api.createEventAnnouncement({ event_id: event.id, title, body, notify });
            if (poll) await api.createPoll({ event_announcement_id: a.id, ...poll });
            return a.status === 'published' ? 'Opublikowano' : 'Wysłano do akceptacji sztabu';
          }}
          onDone={(msg) => {
            setComposer(null);
            toast.success(msg);
            load();
          }}
        />
      )}
    </>
  );
}

/** Formularz ogłoszenia z opcją powiadomienia e-mail i ankiety dostępności (używany w wydarzeniach i „Ważne”) */
export function AnnouncementComposer({ initial, canNotify, direct, onClose, onSubmit, onDone, notifyLabel }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [notify, setNotify] = useState(false);
  const [withPoll, setWithPoll] = useState(false);
  const [poll, setPoll] = useState(defaultPollValue);
  const [busy, setBusy] = useState(false);
  const hasPoll = !!initial?.poll;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const pollData = withPoll && !hasPoll ? pollPayload(poll) : null;
      const msg = await onSubmit({ title: title.trim(), body: body.trim(), notify: canNotify && notify, poll: pollData });
      onDone(msg);
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Edytuj ogłoszenie' : 'Nowe ogłoszenie'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" form="composer-form" disabled={busy || !title.trim()}>
            {busy ? 'Zapisywanie…' : initial ? 'Zapisz' : direct ? 'Opublikuj' : 'Wyślij do akceptacji'}
          </button>
        </>
      }
    >
      <form id="composer-form" className="stack" onSubmit={submit}>
        {!direct && !initial && (
          <div className="alert">
            <Info size={18} /> Ogłoszenie pojawi się po akceptacji.
          </div>
        )}
        <div className="field">
          <label>Tytuł</label>
          <input className="input" maxLength={140} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Treść</label>
          <textarea className="textarea" rows={5} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Linki zostaną automatycznie podlinkowane." />
        </div>
        {!hasPoll && (
          <label className="check">
            <input type="checkbox" checked={withPoll} onChange={(e) => setWithPoll(e.target.checked)} />
            <span className="row" style={{ gap: 6 }}>
              <CalendarClock size={16} /> Dodaj ankietę dostępności (każdy zaznaczy, kiedy może + notatka)
            </span>
          </label>
        )}
        {withPoll && !hasPoll && <PollFields value={poll} onChange={setPoll} />}
        {canNotify && !initial && (
          <label className="check">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span className="row" style={{ gap: 6 }}>
              <Mail size={16} /> {notifyLabel || 'Wyślij powiadomienie e-mail do zespołu'}
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}

// =====================================================================
//  Zespół
// =====================================================================
function Team({ event, members, ep, reload, roleData }) {
  const { profile, perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const apps = members.filter((m) => m.status === 'applied');
  const [priv, setPriv] = useState({});
  useEffect(() => {
    // e-mail i telefon widzi tylko zarząd komisji
    if (perms.board) api.listPrivate().then(setPriv).catch(() => {});
  }, [perms.board]);
  const rolesOf = (uid) =>
    roleData.assignments
      .filter((a) => a.user_id === uid && (!a.expires_at || new Date(a.expires_at) > new Date()))
      .map((a) => roleData.roles.find((r) => r.id === a.role_id))
      .filter(Boolean);
  const by = (role) => members.filter((m) => m.status === 'accepted' && m.role === role);

  const act = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  const exportCsv = () => {
    const rows = [['Imię i nazwisko', 'Rola w wydarzeniu', 'Role dodatkowe', ...(perms.board ? ['E-mail', 'Telefon'] : [])]];
    members
      .filter((m) => m.status === 'accepted')
      .forEach((m) =>
        rows.push([
          m.profile?.full_name,
          EVENT_ROLE_LABELS[m.role],
          rolesOf(m.user_id).map((r) => r.name).join(', '),
          ...(perms.board ? [priv[m.user_id]?.email || '', priv[m.user_id]?.phone || ''] : []),
        ])
      );
    downloadCsv(`zespol-${event.name.replace(/\s+/g, '-').toLowerCase()}.csv`, rows);
  };

  const Person = ({ m }) => {
    const canChangeRole = ep.admin && m.role !== 'coordinator';
    const canRemove = m.user_id !== profile.id && (m.role === 'coordinator' ? perms.chair : m.role === 'staff' ? ep.admin : ep.team);
    return (
      <div className="list-item" style={{ flexWrap: 'wrap', gap: 10 }}>
        <Link to={`/u/${m.user_id}`}>
          <Avatar profile={m.profile} size={40} />
        </Link>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <Link to={`/u/${m.user_id}`} style={{ color: 'inherit' }}>
            <b className="small">{m.profile?.full_name}</b>
          </Link>
          {m.profile?.headline && <div className="tiny muted truncate">{m.profile.headline}</div>}
          {rolesOf(m.user_id).length > 0 && (
            <div className="row row-wrap" style={{ gap: 4, marginTop: 3 }}>
              {rolesOf(m.user_id).map((r) => (
                <span key={r.id} className="badge" style={{ height: 20, fontSize: 11, background: r.color + '22', color: r.color }}>
                  {r.name}
                </span>
              ))}
            </div>
          )}
          {perms.board && priv[m.user_id] && (
            <div className="tiny muted row row-wrap" style={{ gap: '0 10px' }} title="Widoczne tylko dla zarządu">
              <a href={`mailto:${priv[m.user_id].email}`} className="row" style={{ gap: 3 }}>
                <Mail size={12} /> {priv[m.user_id].email}
              </a>
              {priv[m.user_id].phone && (
                <a href={`tel:${priv[m.user_id].phone}`} className="row" style={{ gap: 3 }}>
                  <Phone size={12} /> {priv[m.user_id].phone}
                </a>
              )}
            </div>
          )}
        </div>
        {canChangeRole && (
          <select className="select" style={{ width: 'auto', minHeight: 34, padding: '2px 10px' }} value={m.role}
            onChange={(e) => act(() => api.updateEventMember(event.id, m.user_id, { role: e.target.value }), 'Zmieniono rolę')}>
            <option value="staff">Sztab</option>
            <option value="crew">Kadra</option>
          </select>
        )}
        {canRemove && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ width: 32, height: 32 }}
            aria-label="Usuń z zespołu"
            onClick={async () => {
              if (await confirm({ message: `Usunąć ${m.profile?.full_name} z zespołu?`, danger: true, confirmText: 'Usuń' }))
                act(() => api.removeEventMember(event.id, m.user_id), 'Usunięto z zespołu');
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  };

  const Group = ({ title, list, hint }) => (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {hint && <div className="tiny muted">{hint}</div>}
        </div>
        <span className="badge">{list.length}</span>
      </div>
      {list.length ? list.map((m) => <Person key={m.user_id} m={m} />) : <p className="small muted" style={{ padding: '12px 20px' }}>Brak osób</p>}
    </div>
  );

  return (
    <>
      {(ep.team || ep.member) && (
        <div className="row row-wrap" style={{ marginBottom: 14 }}>
          {ep.team && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <UserPlus size={17} /> Dodaj osobę
            </button>
          )}
          {ep.member && (
            <button className="btn btn-ghost" onClick={exportCsv}>
              <Download size={16} /> Lista zespołu CSV
            </button>
          )}
        </div>
      )}

      {ep.team && apps.length > 0 && (
        <div className="card" style={{ marginBottom: 14, borderColor: '#fde7c2' }}>
          <div className="card-head">
            <h3>Zgłoszenia do rozpatrzenia</h3>
            <span className="badge badge-pending">{apps.length}</span>
          </div>
          {apps.map((m) => (
            <div key={m.user_id} className="list-item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Avatar profile={m.profile} size={40} />
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <b className="small">{m.profile?.full_name}</b>
                <div className="tiny muted">
                  chce do: <b>{m.role === 'staff' ? 'sztabu' : 'kadry'}</b> · {relTime(m.created_at)}
                </div>
                {m.note && <div className="small" style={{ marginTop: 4 }}>„{m.note}”</div>}
              </div>
              <div className="row row-wrap" style={{ gap: 6 }}>
                {ep.admin && m.role === 'staff' && (
                  <button className="btn btn-success btn-sm" onClick={() => act(() => api.updateEventMember(event.id, m.user_id, { status: 'accepted', role: 'staff' }), 'Przyjęto do sztabu')}>
                    <Check size={15} /> Do sztabu
                  </button>
                )}
                <button className={`btn btn-sm ${m.role === 'staff' && ep.admin ? 'btn-secondary' : 'btn-success'}`}
                  onClick={() => act(() => api.updateEventMember(event.id, m.user_id, { status: 'accepted', role: 'crew' }), 'Przyjęto do kadry')}>
                  <Check size={15} /> Do kadry
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => act(() => api.updateEventMember(event.id, m.user_id, { status: 'rejected' }), 'Odrzucono')}>
                  <X size={15} /> Odrzuć
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Group title="Koordynator główny" list={by('coordinator')} hint="Pełnia uprawnień w wydarzeniu (jak przewodniczący)" />
      <Group title="Sztab" list={by('staff')} hint="Organizatorzy – jak zarząd w tym wydarzeniu" />
      <Group title="Kadra" list={by('crew')} />

      {adding && <AddMemberModal event={event} members={members} ep={ep} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function AddMemberModal({ event, members, ep, onClose, onDone }) {
  const { perms } = useAuth();
  const toast = useToast();
  const [people, setPeople] = useState([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('crew');
  useEffect(() => {
    api.listProfiles().then((p) => setPeople(p.filter((x) => isMemberRole(x.role)))).catch(() => {});
  }, []);
  const taken = new Set(members.filter((m) => m.status === 'accepted').map((m) => m.user_id));
  const free = people.filter((p) => !taken.has(p.id) || role === 'coordinator');
  return (
    <Modal
      title="Dodaj osobę do zespołu"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={!userId}
            onClick={async () => {
              try {
                await api.addEventMember(event.id, userId, role);
                toast.success('Dodano do zespołu');
                onDone();
              } catch (e) {
                toast.error(e);
              }
            }}
          >
            Dodaj
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Rola</label>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="crew">Kadra</option>
            {ep.admin && <option value="staff">Sztab</option>}
            {perms.chair && <option value="coordinator">Koordynator główny</option>}
          </select>
          {role === 'coordinator' && <span className="hint">Obecny koordynator (jeśli jest) zostanie przeniesiony do sztabu.</span>}
        </div>
        <div className="field">
          <label>Osoba</label>
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— wybierz —</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
//  Spotkania wydarzenia
// =====================================================================
function EventMeetings({ event, ep }) {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState(null);
  const [form, setForm] = useState(false);
  const load = useCallback(() => api.listMeetings().then((m) => setMeetings(m.filter((x) => x.event_id === event.id))).catch(console.error), [event.id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!meetings) return <Spinner center />;
  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.starts_at) >= new Date(now.toDateString()));
  const past = meetings.filter((m) => new Date(m.starts_at) < new Date(now.toDateString())).reverse();
  return (
    <>
      {ep.meetings && (
        <div className="row" style={{ marginBottom: 14 }}>
          <p className="small muted" style={{ flex: 1 }}>Obecność na spotkaniach wydarzenia sprawdza sztab i osoby z rolą „obecność” (także skanerem QR).</p>
          <button className="btn btn-primary" onClick={() => setForm(true)}>
            <Plus size={18} /> Nowe spotkanie
          </button>
        </div>
      )}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Nadchodzące</h3>
          <span className="badge">{upcoming.length}</span>
        </div>
        {upcoming.length ? <MeetingList items={upcoming} /> : <Empty icon={CalendarDays} title="Brak zaplanowanych spotkań" />}
      </div>
      {past.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Minione</h3>
            <span className="badge">{past.length}</span>
          </div>
          <MeetingList items={past} />
        </div>
      )}
      {form && (
        <MeetingForm
          initial={{ event_id: event.id, title: `Spotkanie: ${event.name}`, starts_at: defaultStart() }}
          onClose={() => setForm(false)}
          onSaved={(m) => {
            setForm(false);
            navigate(`/spotkania/${m.id}`);
          }}
        />
      )}
    </>
  );
}
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

// =====================================================================
//  Ustawienia (koordynator / przewodniczący)
// =====================================================================
function EventSettings({ event, reload }) {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const save = async (patch, msg) => {
    try {
      await api.saveEvent({ id: event.id, ...patch });
      toast.success(msg);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <div className="stack">
      <div className="card card-pad row row-wrap" style={{ gap: 10 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3>Dane wydarzenia</h3>
          <p className="small muted">Nazwa, termin, miejsce, opis i kolor.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setEdit(true)}>
          <Pencil size={16} /> Edytuj
        </button>
      </div>
      <div className="card card-pad row row-wrap" style={{ gap: 10 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3>Rekrutacja</h3>
          <p className="small muted">{event.recruitment_open ? 'Członkowie komisji mogą się zgłaszać.' : 'Zgłoszenia są wyłączone.'}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => save({ recruitment_open: !event.recruitment_open }, event.recruitment_open ? 'Zamknięto rekrutację' : 'Otwarto rekrutację')}>
          {event.recruitment_open ? <Lock size={16} /> : <Unlock size={16} />} {event.recruitment_open ? 'Zamknij' : 'Otwórz'}
        </button>
      </div>
      <div className="card card-pad row row-wrap" style={{ gap: 10 }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3>Status</h3>
          <p className="small muted">{event.status === 'active' ? 'Wydarzenie jest aktywne.' : 'Wydarzenie jest zakończone (tylko do odczytu w archiwum).'}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => save({ status: event.status === 'active' ? 'finished' : 'active', ...(event.status === 'active' ? { recruitment_open: false } : {}) }, event.status === 'active' ? 'Zakończono wydarzenie' : 'Wznowiono wydarzenie')}>
          <Flag size={16} /> {event.status === 'active' ? 'Zakończ wydarzenie' : 'Wznów'}
        </button>
      </div>
      {perms.chair && (
        <div className="card card-pad row row-wrap" style={{ gap: 10, borderColor: '#f9cccc' }}>
          <div style={{ flex: '1 1 220px' }}>
            <h3 style={{ color: 'var(--danger)' }}>Usuń wydarzenie</h3>
            <p className="small muted">Usuwa zespół, ogłoszenia, ankiety i spotkania wydarzenia. Pliki na Google Drive zostają.</p>
          </div>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (!(await confirm({ title: 'Usunąć wydarzenie?', message: 'Tej operacji nie można cofnąć.', danger: true, confirmText: 'Usuń' }))) return;
              try {
                await api.deleteEvent(event.id);
                toast.success('Usunięto wydarzenie');
                navigate('/wydarzenia');
              } catch (e) {
                toast.error(e);
              }
            }}
          >
            <Trash2 size={16} /> Usuń
          </button>
        </div>
      )}
      {edit && <EventForm initial={event} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}

// =====================================================================
//  Role wydarzenia (tworzy koordynator główny – jak role tymczasowe w komisji)
// =====================================================================
const EV_COLORS = ['#45B0E5', '#2394D0', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#64748B'];
const EV_PERMS = [
  ['can_post', 'Publikuje w „Ważne” wydarzenia bez akceptacji i akceptuje wpisy innych'],
  ['can_manage_team', 'Rekrutacja: przyjmuje, dodaje i usuwa kadrę'],
  ['can_manage_meetings', 'Tworzy i edytuje spotkania wydarzenia'],
  ['can_scan', 'Sprawdza obecność na spotkaniach wydarzenia (skaner QR)'],
];

function EventRoles({ event, members, roleData, reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const [grant, setGrant] = useState(null);
  const team = members.filter((m) => m.status === 'accepted');
  const name = (uid) => team.find((m) => m.user_id === uid)?.profile;
  const act = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <p className="small muted" style={{ flex: 1 }}>
          Twórz własne funkcje w zespole (np. „Koordynator ds. kadry”, „Odpowiedzialny za scenę”) i sam decyduj, co mogą.
        </p>
        <button className="btn btn-primary" onClick={() => setEdit({ event_id: event.id, name: '', color: EV_COLORS[0], description: '', can_post: false, can_manage_team: false, can_manage_meetings: false, can_scan: false })}>
          <Plus size={17} /> <span className="hide-mobile">Nowa rola</span>
        </button>
      </div>
      {roleData.roles.length === 0 ? (
        <div className="card">
          <Empty icon={Tags} title="Brak ról w wydarzeniu">
            Utwórz pierwszą rolę i przypisz ją osobom z zespołu.
          </Empty>
        </div>
      ) : (
        <div className="stack">
          {roleData.roles.map((r) => {
            const asg = roleData.assignments.filter((a) => a.role_id === r.id);
            return (
              <div key={r.id} className="card card-pad" style={{ borderLeft: `4px solid ${r.color}` }}>
                <div className="row">
                  <h3 style={{ flex: 1 }}>{r.name}</h3>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 32, height: 32 }} onClick={() => setEdit(r)} aria-label="Edytuj">
                    <Pencil size={15} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ width: 32, height: 32 }}
                    aria-label="Usuń"
                    onClick={async () => {
                      if (await confirm({ message: `Usunąć rolę „${r.name}”? Zostanie odebrana wszystkim.`, danger: true, confirmText: 'Usuń' }))
                        act(() => api.deleteEventRole(r.id), 'Usunięto rolę');
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {r.description && <p className="small muted">{r.description}</p>}
                <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
                  {EV_PERMS.filter(([k]) => r[k]).map(([k, l]) => (
                    <span key={k} className="badge badge-board">{l.split(':')[0].split(' (')[0]}</span>
                  ))}
                  {!EV_PERMS.some(([k]) => r[k]) && <span className="badge">Funkcja bez dodatkowych uprawnień</span>}
                </div>
                <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
                  {asg.map((a) => (
                    <span key={a.id} className="badge" style={{ background: r.color + '1f', color: r.color, height: 28 }}>
                      <Avatar profile={name(a.user_id)} size={18} /> {name(a.user_id)?.full_name || 'osoba spoza zespołu'}
                      {a.expires_at && <span style={{ opacity: 0.75 }}> · do {new Date(a.expires_at).toLocaleDateString('pl-PL')}</span>}
                      <button className="tag-x" aria-label="Odbierz rolę" onClick={() => act(() => api.revokeEventRole(a.id))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => setGrant(r)}>
                    <UserPlus size={15} /> Przypisz
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {edit && (
        <EventRoleModal
          role={edit}
          onClose={() => setEdit(null)}
          onSave={async (r) => {
            await api.saveEventRole(r);
            setEdit(null);
            toast.success('Zapisano rolę');
            reload();
          }}
        />
      )}
      {grant && (
        <EventRoleGrant
          role={grant}
          team={team.filter((m) => !roleData.assignments.some((a) => a.role_id === grant.id && a.user_id === m.user_id))}
          onClose={() => setGrant(null)}
          onSave={async (userId, until) => {
            await api.assignEventRole(event.id, grant.id, userId, until);
            setGrant(null);
            toast.success('Przypisano rolę');
            reload();
          }}
        />
      )}
    </>
  );
}

function EventRoleModal({ role, onClose, onSave }) {
  const toast = useToast();
  const [r, setR] = useState(role);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <Modal
      title={role.id ? 'Edytuj rolę' : 'Nowa rola w wydarzeniu'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !r.name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const { id, event_id, name, color, description, can_post, can_manage_team, can_manage_meetings, can_scan } = r;
                await onSave({ id, event_id, name: name.trim(), color, description: description.trim(), can_post, can_manage_team, can_manage_meetings, can_scan });
              } catch (e) {
                toast.error(e);
                setBusy(false);
              }
            }}
          >
            Zapisz
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Nazwa funkcji</label>
          <input className="input" maxLength={60} value={r.name} onChange={set('name')} placeholder="np. Koordynator ds. kadry" />
        </div>
        <div className="field">
          <label>Opis (od czego jest)</label>
          <input className="input" value={r.description} onChange={set('description')} placeholder="np. rekrutacja i grafik wolontariuszy" />
        </div>
        <div className="field">
          <label>Kolor</label>
          <div className="swatches">
            {EV_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${r.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setR((x) => ({ ...x, color: c }))} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="label">Uprawnienia w wydarzeniu</div>
        {EV_PERMS.map(([k, l]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={!!r[k]} onChange={set(k)} />
            <span>{l}</span>
          </label>
        ))}
        <p className="hint">Rolę możesz nadać tylko osobom z zespołu wydarzenia. Po wygaśnięciu terminu uprawnienia znikają automatycznie.</p>
      </div>
    </Modal>
  );
}

function EventRoleGrant({ role, team, onClose, onSave }) {
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [until, setUntil] = useState('');
  return (
    <Modal
      title={`Przypisz: ${role.name}`}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={!userId}
            onClick={async () => {
              try {
                await onSave(userId, until ? new Date(until + 'T23:59:59').toISOString() : null);
              } catch (e) {
                toast.error(e);
              }
            }}
          >
            Przypisz
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Osoba z zespołu</label>
          <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— wybierz —</option>
            {team.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile?.full_name} ({EVENT_ROLE_LABELS[m.role]})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ważna do (opcjonalnie)</label>
          <input className="input" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
          <span className="hint">Puste = do końca wydarzenia / odebrania.</span>
        </div>
      </div>
    </Modal>
  );
}
