import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft, Pencil, Mail, Phone, AtSign, Globe, GraduationCap, Building2, CalendarCheck, QrCode, LogOut, Share2,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, CustomRoleBadges, Empty, RoleBadge, Spinner, gear, Linkify, useToast } from '../components/ui';
import { profileUrl } from '../lib/qr';
import { fmtDate } from '../lib/format';
import FeedbackModal from '../components/FeedbackModal';
import { Bug } from 'lucide-react';

export default function Profile() {
  const { id } = useParams();
  const { profile: me, perms } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(undefined);
  const [stats, setStats] = useState(null);
  const [qr, setQr] = useState('');
  const [feedback, setFeedback] = useState(false);
  const isMe = id === me.id;

  useEffect(() => {
    setP(undefined);
    (isMe ? api.getMyProfile() : api.getProfile(id)).then(setP).catch(() => setP(null));
  }, [id, isMe]);

  useEffect(() => {
    if (!p) return;
    QRCode.toDataURL(profileUrl(p.id), { margin: 1, width: 320, color: { dark: '#0d2436', light: '#ffffff' } }).then(setQr);
    if (isMe || perms.scan) {
      Promise.all([api.listMeetings(), isMe ? api.listMyAttendance() : api.listAllAttendance()])
        .then(([meetings, att]) => {
          const past = meetings.filter((m) => new Date(m.starts_at) < new Date());
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

  const showEmail = isMe || p.show_email || perms.board;
  const showPhone = p.phone && (isMe || p.show_phone || perms.board);

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

  return (
    <>
      {!isMe && (
        <Link to="/czlonkowie" className="row small muted" style={{ marginBottom: 14, gap: 4 }}>
          <ArrowLeft size={16} /> Członkowie
        </Link>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="profile-cover">
            <img src={gear} alt="" />
          </div>
          <div className="profile-main">
            <div className="row" style={{ alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <Avatar profile={p} size={104} />
              <div className="spacer" />
              <div className="row" style={{ paddingBottom: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={share}>
                  <Share2 size={15} /> Udostępnij
                </button>
                {(isMe || perms.board) && (
                  <Link to={isMe ? '/ja/edytuj' : `/ja/edytuj?u=${p.id}`} className="btn btn-secondary btn-sm">
                    <Pencil size={15} /> Edytuj
                  </Link>
                )}
              </div>
            </div>
            <h1 style={{ marginTop: 14 }}>{p.full_name}</h1>
            <div className="row row-wrap" style={{ marginTop: 8, gap: 6 }}>
              <RoleBadge role={p.role} />
              <CustomRoleBadges profile={p} showExpiry={isMe || perms.board} />
            </div>
            {p.bio && (
              <p className="pre" style={{ marginTop: 14, color: 'var(--navy-800)' }}>
                <Linkify text={p.bio} />
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 6 }}>Informacje</h3>
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
            {showEmail && (
              <div className="info-row">
                <Mail size={18} /> <a href={`mailto:${p.email}`}>{p.email}</a>
              </div>
            )}
            {showPhone && (
              <div className="info-row">
                <Phone size={18} /> <a href={`tel:${p.phone}`}>{p.phone}</a>
              </div>
            )}
            {p.instagram && (
              <div className="info-row">
                <AtSign size={18} />
                <a href={`https://instagram.com/${p.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">
                  @{p.instagram.replace(/^@/, '')}
                </a>
              </div>
            )}
            {p.facebook && (
              <div className="info-row">
                <Globe size={18} />
                <a href={p.facebook.startsWith('http') ? p.facebook : `https://facebook.com/${p.facebook}`} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
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

        {isMe && (
          <div className="stack hide-desktop" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => setFeedback(true)}>
              <Bug size={17} /> Zgłoś problem lub pomysł
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => api.signOut()}>
              <LogOut size={17} /> Wyloguj się
            </button>
          </div>
        )}
      </div>
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </>
  );
}
