import { Link } from 'react-router-dom';
import { Hourglass, LogOut, Pencil, XCircle } from 'lucide-react';
import { api, isDemo } from '../api';
import { useAuth } from '../auth';
import { Avatar, gear } from '../components/ui';
import { DemoRibbon, RotateLock } from '../components/Layout';
import EditProfile from './EditProfile';

export default function Pending({ editing }) {
  const { profile } = useAuth();
  const rejected = profile.role === 'rejected';
  const alumni = profile.role === 'alumni';

  return (
    <>
      {isDemo && <DemoRibbon />}
      <div className="content" style={{ maxWidth: 640 }}>
        {editing ? (
          <EditProfile />
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            <div className="hero-card center">
              <img src={gear} className="gear-bg" alt="" />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Avatar profile={profile} size={84} />
                <h1>Cześć, {profile.full_name.split(' ')[0]}!</h1>
              </div>
            </div>
            <div className={`alert ${rejected ? 'alert-danger' : 'alert-warning'}`}>
              {rejected ? <XCircle size={20} /> : <Hourglass size={20} />}
              <div>
                {rejected ? (
                  <>
                    <b>Zgłoszenie zostało odrzucone.</b>
                    <div>Jeśli to pomyłka, skontaktuj się z zarządem komisji.</div>
                  </>
                ) : alumni ? (
                  <>
                    <b>Twoje członkostwo jest zakończone.</b>
                    <div>Dziękujemy za wspólną pracę! W razie powrotu do komisji napisz do zarządu.</div>
                  </>
                ) : (
                  <>
                    <b>Twoje konto czeka na akceptację zarządu.</b>
                    <div>
                      Gdy ktoś z zarządu je zatwierdzi, po odświeżeniu strony zobaczysz pełną aplikację. W międzyczasie uzupełnij swój profil – ułatwi to
                      zarządowi rozpoznanie Cię.
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="row row-wrap">
              <Link to="/ja/edytuj" className="btn btn-primary">
                <Pencil size={17} /> Uzupełnij profil
              </Link>
              <button className="btn btn-ghost" onClick={() => window.location.reload()}>
                Odśwież status
              </button>
              <div className="spacer" />
              <button className="btn btn-ghost" onClick={() => api.signOut()}>
                <LogOut size={17} /> Wyloguj
              </button>
            </div>
          </div>
        )}
      </div>
      <RotateLock />
    </>
  );
}
