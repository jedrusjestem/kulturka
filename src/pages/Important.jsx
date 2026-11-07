import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus, Pin, PinOff, Check, X, Trash2, Clock, Info, Pencil } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Linkify, Spinner, useConfirm, useToast } from '../components/ui';
import AvailabilityPoll from '../components/AvailabilityPoll';
import { AnnouncementComposer } from './EventDetail';
import { fmtDateTime, relTime } from '../lib/format';

export default function Important() {
  const { profile, perms, markImportantSeen, refreshCounts } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState('published');
  const [composer, setComposer] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listAnnouncements());
    } catch (e) {
      toast.error(e);
    }
  }, [toast]);

  useEffect(() => {
    load();
    markImportantSeen();
  }, [load, markImportantSeen]);

  const act = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      await load();
      refreshCounts();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items) return <Spinner center />;

  const published = items.filter((a) => a.status === 'published');
  const pending = items.filter((a) => a.status === 'pending');
  const mine = items.filter((a) => a.author_id === profile.id && a.status !== 'published');
  const list = tab === 'published' ? published : tab === 'pending' ? pending : mine;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ważne</h1>
          <p>Ogłoszenia zarządu i zatwierdzone wiadomości od członków.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setComposer(true)}>
          <Plus size={18} /> Nowe ogłoszenie
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={`tab ${tab === 'published' ? 'active' : ''}`} onClick={() => setTab('published')}>
          Opublikowane
        </button>
        {perms.board ? (
          <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
            Do akceptacji {pending.length > 0 && <span className="count">{pending.length}</span>}
          </button>
        ) : (
          <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
            Moje zgłoszenia {mine.length > 0 && <span className="count">{mine.length}</span>}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={Megaphone} title={tab === 'published' ? 'Jeszcze nic tu nie ma' : 'Brak zgłoszeń'}>
            {tab === 'pending' ? 'Wszystkie propozycje członków zostały rozpatrzone 🎉' : null}
          </Empty>
        </div>
      ) : (
        <div className="stack">
          {list.map((a) => (
            <article key={a.id} className={`card ann ${a.pinned && a.status === 'published' ? 'pinned' : ''}`}>
              <div className="ann-head">
                <Link to={a.author ? `/u/${a.author.id}` : '#'}>
                  <Avatar profile={a.author} size={38} />
                </Link>
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
                    <Clock size={12} /> Czeka na akceptację
                  </span>
                )}
                {a.status === 'rejected' && <span className="badge badge-rejected">Odrzucone</span>}
              </div>
              <h3>{a.title}</h3>
              <div className="ann-body">
                <Linkify text={a.body} />
              </div>
              {a.poll && a.status !== 'rejected' && (
                <AvailabilityPoll poll={a.poll} me={profile} canManage={perms.board || a.author_id === profile.id} onDeleted={load} />
              )}
              {(perms.board || a.author_id === profile.id) && (
                <div className="ann-actions">
                  {perms.board && a.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => act(() => api.updateAnnouncement(a.id, { status: 'published' }), 'Opublikowano')}>
                        <Check size={16} /> Akceptuj i opublikuj
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => act(() => api.updateAnnouncement(a.id, { status: 'rejected' }), 'Odrzucono')}>
                        <X size={16} /> Odrzuć
                      </button>
                    </>
                  )}
                  {perms.board && a.status === 'published' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.updateAnnouncement(a.id, { pinned: !a.pinned }))}>
                      {a.pinned ? <PinOff size={16} /> : <Pin size={16} />} {a.pinned ? 'Odepnij' : 'Przypnij'}
                    </button>
                  )}
                  {(perms.board ||
                    (a.author_id === profile.id && (a.status === 'pending' || (a.status === 'published' && perms.editOwn)))) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>
                      <Pencil size={16} /> Edytuj
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      if (await confirm({ message: `Usunąć ogłoszenie „${a.title}”?`, danger: true, confirmText: 'Usuń' }))
                        act(() => api.deleteAnnouncement(a.id), 'Usunięto');
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

      {editing && (
        <AnnouncementComposer
          initial={editing}
          direct
          onClose={() => setEditing(null)}
          onSubmit={async ({ title, body, poll }) => {
            await api.updateAnnouncement(editing.id, { title, body });
            if (poll && !editing.poll) await api.createPoll({ announcement_id: editing.id, ...poll });
            return 'Zapisano zmiany';
          }}
          onDone={(msg) => {
            setEditing(null);
            toast.success(msg);
            load();
          }}
        />
      )}

      {composer && (
        <AnnouncementComposer
          direct={perms.postImportant}
          canNotify={perms.postImportant}
          notifyLabel="Wyślij powiadomienie e-mail do wszystkich członków"
          onClose={() => setComposer(false)}
          onSubmit={async ({ title, body, notify, poll }) => {
            const a = await api.createAnnouncement({ title, body, notify });
            if (poll) await api.createPoll({ announcement_id: a.id, ...poll });
            if (a.status !== 'published' && !perms.board) setTab('mine');
            return a.status === 'published' ? 'Opublikowano ogłoszenie' : 'Wysłano do akceptacji zarządu';
          }}
          onDone={(msg) => {
            setComposer(false);
            toast.success(msg);
            load();
            refreshCounts();
          }}
        />
      )}
    </>
  );
}
