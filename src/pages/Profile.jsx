import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft, Pencil, Mail, Phone, AtSign, Globe, GraduationCap, Building2, CalendarCheck, QrCode, LogOut, Share2, Bug,
  MessageSquareWarning, Lock, Link2, Hash, IdCard, Cake, LifeBuoy, StickyNote, Sparkles, Info,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, CustomRoleBadges, Empty, RoleBadge, Spinner, gear, Linkify, useToast } from '../components/ui';
import { profileUrl } from '../lib/qr';
import { fmtDate } from '../lib/format';
import FeedbackModal from '../components/FeedbackModal';
import { coverBg } from './EditProfile';
import { Feed } from './Community';
import { filledSocials, socialHref, socialLabel } from '../lib/socials';

export default function Profile() {
  const { id } = useParams();
  const { profile: me, perms } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(undefined);
  const [priv, setPriv] = useState(null);
  const [stats, setStats] = useState(null);
  const [qr, setQr] = useState('');
  const [tab, setTab] = useState('posts');
  const [feedback, setFeedback] = useState(false);
  const isMe = id === me.id;

  useEffect(() => {
    setP(undefined);
    setPriv(null);
    setTab('posts');
    (isMe ? api.getMyProfile() : api.getProfile(id)).then(setP).catch(() => setP(null));
    if (isMe) api.getMyPrivate().then(setPriv).catch(() => {});
    else if (perms.board) api.listPrivate().then((m) => setPriv(m[id] || null)).catch(() => {});
  }, [id, isMe, perms.board]);

  useEffect(() => {
    if (!p) return;
    QRCode.toDataURL(profileUrl(p.id), { margin: 1, width: 320, color: { dark: '#0d2436', light: '#ffffff' } }).then(setQr);
    if (isMe || perms.scan) {
      Promise.all([api.listMeetings(), isMe ? api.listMyAttendance() : api.listAllAttendance()])
        .then(([meetings, att]) => {
          const past = meetings.filter((m) => new Date(m.starts_at) < new Date() && !m.event_id);
          const present = past.filter((m) => att.some((a) => a.meeting_id === m.id && a.user_id === p.id && a.present)).length;
          setStats({ past: past.length, present });
        })
        .catch(() => {});
    }
  }, [p, isMe, perms.scan]);

  if (p === undefined) return <Spinner center />;
  if (!p)
    return (
      <div className="card">
        <Empty title="Nie znaleziono profilu">
          <Link to="/czlonkowie">Wróć do listy członków</Link>
        </Empty>
      </div>
    );

  const share = async () => {
    const url = profileUrl(p.id);
    try {
      if (navigator.share) await navigator.share({ title: p.full_name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Skopiowano link do profilu');
      }
    } catch {
      /* anulowano */
    }
  };
  const socials = { ...(p.socials || {}) };
  if (!socials.instagram && p.instagram) socials.instagram = p.instagram;
  if (!socials.facebook && p.facebook) socials.facebook = p.facebook;
  if (!socials.website && p.website) socials.website = p.website;
  const links = filledSocials(socials);
  const hasInfo = p.faculty || p.study_field || p.study_year || p.approved_at || stats;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {!isMe && (
        <Link to="/czlonkowie" className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
          <ArrowLeft size={16} /> Członkowie
        </Link>
      )}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div className="profile-cover" style={{ background: coverBg(p.cover_color) }}>
          <img src={gear} alt="" />
        </div>
        <div className="profile-main">
          <div className="row" style={{ alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <Avatar profile={p} size={104} />
            <div className="spacer" />
            <div className="row" style={{ paddingBottom: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={share}>
                <Share2 size={15} /> <span className="hide-mobile">Udostępnij</span>
              </button>
              {(isMe || perms.board) && (
                <Link to={isMe ? '/ja/edytuj' : `/ja/edytuj?u=${p.id}`} className="btn btn-secondary btn-sm">
                  <Pencil size={15} /> {isMe ? 'Edytuj profil' : 'Edytuj'}
                </Link>
              )}
            </div>
          </div>
          <h1 style={{ marginTop: 14 }}>{p.full_name}</h1>
          {p.headline && <p className="muted" style={{ marginTop: 2 }}>{p.headline}</p>}
          <div className="row row-wrap" style={{ marginTop: 8, gap: 6 }}>
            <RoleBadge role={p.role} />
            <CustomRoleBadges profile={p} showExpiry={isMe || perms.board} />
          </div>
          {p.bio && (
            <p className="pre" style={{ marginTop: 14, color: 'var(--navy-800)' }}>
              <Linkify text={p.bio} />
            </p>
          )}
          {links.length > 0 && (
            <div className="social-links">
              {links.map((pl) => {
                const href = socialHref(pl, socials[pl.key]);
                const inner = (
                  <>
                    <span className="social-dot sm" style={{ background: pl.color }}>
                      {pl.short}
                    </span>
                    {socialLabel(pl, socials[pl.key])}
                  </>
                );
                return href ? (
                  <a key={pl.key} className="social-chip" href={href} target="_blank" rel="noopener noreferrer" title={pl.label}>
                    {inner}
                  </a>
                ) : (
                  <span key={pl.key} className="social-chip" title={pl.label}>
                    {inner}
                  </span>
                );
              })}
            </div>
          )}
          {p.interests?.length > 0 && (
            <div className="row row-wrap" style={{ gap: 6, marginTop: 12 }}>
              {p.interests.map((t) => (
                <span key={t} className="badge badge-board">
                  <Hash size={11} />
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* dane poufne – tylko właściciel i zarząd */}
      {priv && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--sky-200)', background: 'var(--sky-50)' }}>
          <h3 className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Lock size={17} /> Dane poufne {isMe ? '(widzisz Ty i zarząd)' : '(widzi tylko zarząd)'}
          </h3>
          <div className="info-row">
            <Mail size={18} /> <a href={`mailto:${priv.email}`}>{priv.email}</a>
          </div>
          {priv.phone && (
            <div className="info-row">
              <Phone size={18} /> <a href={`tel:${priv.phone}`}>{priv.phone}</a>
            </div>
          )}
          {priv.student_id && (
            <div className="info-row">
              <IdCard size={18} /> Nr indeksu: {priv.student_id}
            </div>
          )}
          {priv.birth_date && (
            <div className="info-row">
              <Cake size={18} /> {fmtDate(priv.birth_date)}
            </div>
          )}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>
          <Sparkles size={15} /> Posty
        </button>
        <button className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
          <Info size={15} /> Informacje
        </button>
      </div>

      {tab === 'posts' ? (
        <Feed authorId={p.id} composer={isMe} />
      ) : (
        <div className="grid grid-2">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 6 }}>Informacje</h3>
            {!hasInfo && <p className="small muted">{isMe ? 'Uzupełnij profil w „Edytuj profil”.' : 'Ta osoba nie udostępnia dodatkowych informacji.'}</p>}
            {p.faculty && (
              <div className="info-row">
                <Building2 size={18} /> {p.faculty}
              </div>
            )}
            {(p.study_field || p.study_year) && (
              <div className="info-row">
                <GraduationCap size={18} /> {[p.study_field, p.study_year].filter(Boolean).join(', ')}
              </div>
            )}
            {stats && (
              <div className="info-row">
                <CalendarCheck size={18} /> Frekwencja: <b>{stats.past ? Math.round((stats.present / stats.past) * 100) : 0}%</b>
                <span className="muted">
                  ({stats.present}/{stats.past} spotkań)
                </span>
              </div>
            )}
            {p.approved_at && (
              <div className="info-row muted small">
                <CalendarCheck size={18} /> W komisji od {fmtDate(p.approved_at)}
              </div>
            )}
          </div>
          <div className="card qr-card">
            <h3>Wizytówka QR</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>
              Zeskanuj, aby otworzyć ten profil.
            </p>
            {qr && (
              <div className="qr-wrap" style={{ padding: 12 }}>
                <img src={qr} alt="Kod QR profilu" style={{ width: 170, height: 170 }} />
              </div>
            )}
            {isMe && (
              <div style={{ marginTop: 16 }}>
                <Link to="/moj-qr" className="btn btn-primary">
                  <QrCode size={17} /> Kod obecności
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {isMe && (
        <div className="stack hide-desktop" style={{ gap: 10, marginTop: 18 }}>
          <Link to="/moj-qr" className="btn btn-secondary btn-block">
            <QrCode size={17} /> Mój kod obecności
          </Link>
          <Link to="/sprawy" className="btn btn-secondary btn-block">
            <MessageSquareWarning size={17} /> Kulturkowe sprawy – zawiadom zarząd
          </Link>
          <button className="btn btn-ghost btn-block" onClick={() => setFeedback(true)}>
            <Bug size={17} /> Zgłoś problem z aplikacją
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => api.signOut()}>
            <LogOut size={17} /> Wyloguj się
          </button>
        </div>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}
