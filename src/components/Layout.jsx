import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Megaphone, CalendarDays, Users, UserRound, QrCode, ShieldCheck, LogOut, Smartphone, PartyPopper, Bug, MessageSquareWarning, Sparkles } from 'lucide-react';
import { useState } from 'react';
import FeedbackModal from './FeedbackModal';
import { useAuth } from '../auth';
import { api, isDemo } from '../api';
import { Avatar, Logo } from './ui';
import { ROLE_LABELS } from '../lib/perms';
import ErrorBoundary from './ErrorBoundary';

function Brand() {
  return (
    <Link to="/" className="brand">
      <Logo />
      <div className="brand-text">
        <b>KULTURKA</b>
        <span>Komisja Kultury i Projektów</span>
      </div>
    </Link>
  );
}

export default function Layout() {
  const { profile, perms, counts } = useAuth();
  const loc = useLocation();
  const adminCount = counts.pendingMembers + counts.pendingAnnouncements;

  const main = [
    { to: '/', icon: Home, label: 'Start', end: true },
    { to: '/wazne', icon: Megaphone, label: 'Ważne', count: counts.unreadImportant },
    { to: '/spolecznosc', icon: Sparkles, label: 'Społeczność', short: 'Tablica' },
    { to: '/wydarzenia', icon: PartyPopper, label: 'Wydarzenia' },
    { to: '/spotkania', icon: CalendarDays, label: 'Spotkania' },
    { to: '/czlonkowie', icon: Users, label: 'Członkowie' },
  ];
  const [feedback, setFeedback] = useState(false);

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav className="nav">
          {main.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon size={20} />
              {n.label}
              {n.count > 0 && <span className="count">{n.count}</span>}
            </NavLink>
          ))}
          <NavLink to="/sprawy">
            <MessageSquareWarning size={20} />
            Kulturkowe sprawy
            {perms.board && counts.newCases > 0 && <span className="count">{counts.newCases}</span>}
          </NavLink>
          <div className="nav-label">Moje</div>
          <NavLink to="/moj-qr">
            <QrCode size={20} />
            Mój kod QR
          </NavLink>
          <NavLink to={`/u/${profile.id}`}>
            <UserRound size={20} />
            Mój profil
          </NavLink>
          <a href="#" onClick={(e) => { e.preventDefault(); setFeedback(true); }}>
            <Bug size={20} />
            Zgłoś problem
          </a>
          {perms.board && (
            <>
              <div className="nav-label">Zarząd</div>
              <NavLink to="/admin">
                <ShieldCheck size={20} />
                Panel zarządu
                {adminCount > 0 && <span className="count">{adminCount}</span>}
              </NavLink>
            </>
          )}
        </nav>
        <Link to={`/u/${profile.id}`} className="sidebar-user">
          <Avatar profile={profile} size={38} />
          <div className="meta">
            <b>{profile.full_name}</b>
            <span>{ROLE_LABELS[profile.role]}</span>
          </div>
          <button
            className="btn btn-icon"
            style={{ marginLeft: 'auto', background: 'transparent', color: '#fff', width: 32, height: 32 }}
            title="Wyloguj"
            onClick={(e) => {
              e.preventDefault();
              api.signOut();
            }}
          >
            <LogOut size={18} />
          </button>
        </Link>
      </aside>

      <div className="main">
        {isDemo && <DemoRibbon />}
        <header className="topbar">
          <Brand />
          <div className="spacer" />
          {perms.board && (
            <Link to="/admin" className="btn btn-icon" aria-label="Panel zarządu" style={{ position: 'relative' }}>
              <ShieldCheck size={19} />
              {adminCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: 'var(--danger)',
                    color: '#fff',
                    fontSize: 10,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {adminCount}
                </span>
              )}
            </Link>
          )}
          <Link to="/czlonkowie" className="btn btn-icon" aria-label="Członkowie">
            <Users size={19} />
          </Link>
          <Link to="/moj-qr" className="btn btn-icon" aria-label="Mój kod QR">
            <QrCode size={19} />
          </Link>
        </header>

        <main className="content" key={loc.pathname}>
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        <nav className="bottom-nav">
          {main.filter((n) => n.to !== '/czlonkowie').map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon size={22} />
              {n.short || n.label}
              {n.count > 0 && <span className="dot">{n.count}</span>}
            </NavLink>
          ))}
          <NavLink to={`/u/${profile.id}`}>
            <UserRound size={22} />
            Ja
          </NavLink>
        </nav>
      </div>
      <RotateLock />
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}

export function DemoRibbon() {
  return (
    <div className="demo-ribbon">
      Tryb DEMO – dane zapisują się tylko w tej przeglądarce.{' '}
      <button
        onClick={() => {
          api.resetDemo();
          window.location.hash = '#/';
        }}
      >
        Przywróć dane przykładowe
      </button>
    </div>
  );
}

export function RotateLock() {
  return (
    <div className="rotate-lock">
      <Smartphone size={56} />
      <b style={{ fontSize: 20 }}>Obróć telefon pionowo</b>
      <span style={{ opacity: 0.9 }}>Kulturka działa w orientacji pionowej</span>
    </div>
  );
}
