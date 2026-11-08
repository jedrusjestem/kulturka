import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Megaphone, QrCode, Users, ScanLine, ChevronRight, MapPin, ShieldCheck, TrendingUp, PartyPopper, MessageSquareWarning } from 'lucide-react';
import InstallHint from '../components/InstallHint';
import { EVENT_ROLE_LABELS } from '../lib/perms';
import { eventDates } from './Events';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, gear, CustomRoleBadges } from '../components/ui';
import { fmtTime, fmtWeekday, relTime, sameDay } from '../lib/format';
import { isMemberRole } from '../lib/perms';

export function DateChip({ date }) {
  const d = new Date(date);
  return (
    <div className={`date-chip ${sameDay(d, new Date()) ? 'today' : ''}`}>
      <b>{d.getDate()}</b>
      <span>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</span>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Dobrej nocy';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Cześć';
  return 'Dobry wieczór';
}

export default function HomePage() {
  const { profile, perms, counts } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.listMeetings(),
      api.listAnnouncements(),
      api.listProfiles(),
      api.listMyAttendance(),
      api.listEvents().catch(() => []),
      api.listMyEventMemberships().catch(() => []),
    ])
      .then(([meetings, anns, people, myAtt, events, myEv]) => setData({ meetings, anns, people, myAtt, events, myEv }))
      .catch(console.error);
  }, []);

  const now = Date.now();
  const upcoming = data?.meetings.filter((m) => new Date(m.ends_at || m.starts_at).getTime() > now - 3600e3).slice(0, 4) || [];
  const past = data?.meetings.filter((m) => new Date(m.starts_at).getTime() < now) || [];
  const attended = past.filter((m) => data.myAtt.some((a) => a.meeting_id === m.id && a.present)).length;
  const pct = past.length ? Math.round((attended / past.length) * 100) : null;
  const published = data?.anns.filter((a) => a.status === 'published').slice(0, 3) || [];
  const members = data?.people.filter((p) => isMemberRole(p.role)) || [];
  const today = upcoming.find((m) => sameDay(m.starts_at, new Date()));
  const myEvents = (data?.events || [])
    .map((e) => ({ e, m: data.myEv.find((x) => x.event_id === e.id && x.status === 'accepted') }))
    .filter((x) => x.m && x.e.status === 'active');

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="hero-card">
        <img src={gear} className="gear-bg" alt="" />
        <h1>
          {greeting()}, {profile.full_name.split(' ')[0]}!
        </h1>
        <p>
          {today
            ? `Dziś o ${fmtTime(today.starts_at)}: ${today.title}${today.location ? ` · ${today.location}` : ''}`
            : upcoming[0]
              ? `Najbliższe spotkanie: ${fmtWeekday(upcoming[0].starts_at)}, ${new Date(upcoming[0].starts_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })} o ${fmtTime(upcoming[0].starts_at)}`
              : 'Witaj w aplikacji Komisji Kultury i Projektów.'}
        </p>
        <div className="row row-wrap" style={{ marginTop: 10, position: 'relative' }}>
          <CustomRoleBadges profile={profile} />
        </div>
        <div className="hero-actions">
          <Link to="/moj-qr" className="btn">
            <QrCode size={18} /> Mój kod QR
          </Link>
          {today && perms.scan && (
            <Link to={`/spotkania/${today.id}/skaner`} className="btn alt">
              <ScanLine size={18} /> Sprawdź obecność
            </Link>
          )}
          {!today && (
            <Link to="/spotkania" className="btn alt">
              <CalendarDays size={18} /> Kalendarz
            </Link>
          )}
        </div>
      </section>

      <InstallHint />

      <Link to="/sprawy" className="card case-cta">
        <div className="stat-icon" style={{ background: 'var(--navy-900)', color: '#fff' }}>
          <MessageSquareWarning size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>Kulturkowe sprawy</b>
          <div className="small muted">
            {perms.board
              ? counts.newCases > 0
                ? `${counts.newCases} ${counts.newCases === 1 ? 'nowe zawiadomienie czeka' : 'nowe zawiadomienia czekają'} na zarząd`
                : 'Skrzynka zawiadomień od członków'
              : 'Masz problem albo pomysł? Zgłoś zarządowi – jawnie lub anonimowo.'}
          </div>
        </div>
        {perms.board && counts.newCases > 0 && <span className="badge badge-pending">{counts.newCases}</span>}
        <ChevronRight size={18} className="muted" />
      </Link>

      <section className="grid stats-grid">
        <div className="card stat">
          <div className="stat-icon">
            <TrendingUp size={22} />
          </div>
          <div>
            <b>{pct === null ? '—' : `${pct}%`}</b>
            <span>Moja frekwencja</span>
          </div>
        </div>
        <Link to="/czlonkowie" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="stat-icon">
            <Users size={22} />
          </div>
          <div>
            <b>{data ? members.length : '—'}</b>
            <span>Członków komisji</span>
          </div>
        </Link>
        {perms.board ? (
          <Link to="/admin" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <b>{counts.pendingMembers + counts.pendingAnnouncements}</b>
              <span>Do akceptacji</span>
            </div>
          </Link>
        ) : (
          <Link to="/wazne" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="stat-icon">
              <Megaphone size={22} />
            </div>
            <div>
              <b>{counts.unreadImportant}</b>
              <span>Nowych w „Ważne”</span>
            </div>
          </Link>
        )}
      </section>

      {myEvents.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Twoje wydarzenia</h2>
            <Link to="/wydarzenia" className="small row" style={{ gap: 2 }}>
              Wszystkie <ChevronRight size={16} />
            </Link>
          </div>
          <div className="list">
            {myEvents.map(({ e, m }) => (
              <Link key={e.id} to={`/wydarzenia/${e.id}`} className="list-item">
                <div className="stat-icon" style={{ background: e.color, color: '#fff', width: 42, height: 42 }}>
                  <PartyPopper size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b className="truncate" style={{ display: 'block' }}>
                    {e.name}
                  </b>
                  <div className="small muted truncate">
                    {EVENT_ROLE_LABELS[m.role]} · {eventDates(e)}
                  </div>
                </div>
                <ChevronRight size={18} className="muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Nadchodzące spotkania</h2>
            <Link to="/spotkania" className="small row" style={{ gap: 2 }}>
              Kalendarz <ChevronRight size={16} />
            </Link>
          </div>
          {!data ? (
            <div className="card-pad stack">
              <div className="skeleton" style={{ height: 52 }} />
              <div className="skeleton" style={{ height: 52 }} />
            </div>
          ) : upcoming.length === 0 ? (
            <Empty icon={CalendarDays} title="Brak zaplanowanych spotkań" />
          ) : (
            <div className="list">
              {upcoming.map((m) => (
                <Link key={m.id} to={`/spotkania/${m.id}`} className="list-item">
                  <DateChip date={m.starts_at} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b className="truncate" style={{ display: 'block' }}>
                      {m.title}
                    </b>
                    <div className="small muted row" style={{ gap: 6 }}>
                      <span className="nowrap">
                        {fmtWeekday(m.starts_at)}, {fmtTime(m.starts_at)}
                      </span>
                      {m.location && (
                        <span className="truncate row" style={{ gap: 3 }}>
                          <MapPin size={13} /> {m.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="muted" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Ważne</h2>
            <Link to="/wazne" className="small row" style={{ gap: 2 }}>
              Wszystkie <ChevronRight size={16} />
            </Link>
          </div>
          {!data ? (
            <div className="card-pad stack">
              <div className="skeleton" style={{ height: 52 }} />
              <div className="skeleton" style={{ height: 52 }} />
            </div>
          ) : published.length === 0 ? (
            <Empty icon={Megaphone} title="Brak ogłoszeń" />
          ) : (
            <div className="list">
              {published.map((a) => (
                <Link key={a.id} to="/wazne" className="list-item" style={{ alignItems: 'flex-start' }}>
                  <Avatar profile={a.author} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b className="truncate" style={{ display: 'block' }}>
                      {a.pinned && '📌 '}
                      {a.title}
                    </b>
                    <div className="small muted truncate">{a.body}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>
                      {a.author?.full_name} · {relTime(a.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
