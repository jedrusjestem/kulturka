import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Image as ImageIcon, Send, Trash2, X, Plus, Eye, MoreHorizontal, Pencil, Type } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Linkify, Modal, useConfirm, useToast } from './ui';
import { relTime } from '../lib/format';

/** Zmniejsza zdjęcie (dłuższy bok max 1280 px) – oszczędza miejsce w darmowym planie */
export function resizeLong(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Nie udało się przetworzyć zdjęcia'))), 'image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Nieobsługiwany plik graficzny'));
    img.src = URL.createObjectURL(file);
  });
}

// =====================================================================
//  Nowy post
// =====================================================================
export function PostComposer({ onPosted }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [img, setImg] = useState(null); // { blob, preview }
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const blob = await resizeLong(file);
      setImg({ blob, preview: URL.createObjectURL(blob) });
    } catch (err) {
      toast.error(err);
    }
  };
  const submit = async () => {
    if (!body.trim() && !img) return;
    setBusy(true);
    try {
      const image_url = img ? await api.uploadCommunityImage(img.blob) : '';
      await api.createPost({ body: body.trim(), image_url });
      setBody('');
      setImg(null);
      onPosted?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card composer">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <Avatar profile={profile} size={40} />
        <textarea
          className="composer-input"
          rows={body ? 3 : 1}
          maxLength={3000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Co słychać, ${profile.full_name.split(' ')[0]}?`}
        />
      </div>
      {img && (
        <div className="composer-preview">
          <img src={img.preview} alt="" />
          <button className="btn btn-icon btn-sm" onClick={() => setImg(null)} aria-label="Usuń zdjęcie">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={16} /> Zdjęcie
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" disabled={busy || (!body.trim() && !img)} onClick={submit}>
          <Send size={15} /> {busy ? 'Publikowanie…' : 'Opublikuj'}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
//  Post
// =====================================================================
export function PostCard({ post, onChanged }) {
  const { profile, perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [likes, setLikes] = useState(post.like_ids || []);
  const [count, setCount] = useState(post.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [likers, setLikers] = useState(null);
  const liked = likes.includes(profile.id);
  const mine = post.author_id === profile.id;

  useEffect(() => {
    setLikes(post.like_ids || []);
    setCount(post.comment_count || 0);
    setBody(post.body);
  }, [post]);

  const toggleLike = async () => {
    const next = !liked;
    setLikes((l) => (next ? [...l, profile.id] : l.filter((x) => x !== profile.id)));
    try {
      await api.setLike(post.id, next);
    } catch (e) {
      setLikes(post.like_ids || []);
      toast.error(e);
    }
  };

  return (
    <article className="card post">
      <div className="post-head">
        <Link to={`/u/${post.author_id}`}>
          <Avatar profile={post.author} size={42} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/u/${post.author_id}`} className="post-author">
            {post.author?.full_name || 'Usunięte konto'}
          </Link>
          <div className="tiny muted truncate">
            {post.author?.headline ? `${post.author.headline} · ` : ''}
            {relTime(post.created_at)}
            {post.updated_at && post.updated_at > post.created_at && new Date(post.updated_at) - new Date(post.created_at) > 60000 ? ' · edytowano' : ''}
          </div>
        </div>
        {(mine || perms.board) && (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 32, height: 32, border: 0 }} onClick={() => setMenu((m) => !m)} aria-label="Opcje">
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <div className="post-menu" onMouseLeave={() => setMenu(false)}>
                {mine && (
                  <button onClick={() => { setEditing(true); setMenu(false); }}>
                    <Pencil size={15} /> Edytuj
                  </button>
                )}
                <button
                  className="danger"
                  onClick={async () => {
                    setMenu(false);
                    if (!(await confirm({ message: mine ? 'Usunąć post?' : 'Usunąć post tej osoby (moderacja)?', danger: true, confirmText: 'Usuń' }))) return;
                    try {
                      await api.deletePost(post.id);
                      onChanged?.();
                    } catch (e) {
                      toast.error(e);
                    }
                  }}
                >
                  <Trash2 size={15} /> Usuń
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="stack" style={{ gap: 8, marginTop: 4 }}>
          <textarea className="textarea" rows={3} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setBody(post.body); }}>
              Anuluj
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!body.trim() && !post.image_url}
              onClick={async () => {
                try {
                  await api.updatePost(post.id, body.trim());
                  setEditing(false);
                  onChanged?.();
                } catch (e) {
                  toast.error(e);
                }
              }}
            >
              Zapisz
            </button>
          </div>
        </div>
      ) : (
        body && (
          <div className="post-body">
            <Linkify text={body} />
          </div>
        )
      )}
      {post.image_url && (
        <div className="post-image" onDoubleClick={() => !liked && toggleLike()}>
          <img src={post.image_url} alt="" loading="lazy" />
        </div>
      )}

      <div className="post-stats">
        {likes.length > 0 && (
          <button className="link-btn" onClick={async () => setLikers(await api.listLikers(post.id))}>
            <span className="like-dot">
              <Heart size={10} fill="#fff" />
            </span>{' '}
            {likes.length}
          </button>
        )}
        <span className="spacer" />
        {count > 0 && (
          <button className="link-btn" onClick={() => setShowComments((s) => !s)}>
            {count} {count === 1 ? 'komentarz' : count < 5 ? 'komentarze' : 'komentarzy'}
          </button>
        )}
      </div>
      <div className="post-actions">
        <button className={liked ? 'liked' : ''} onClick={toggleLike}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> Lubię to
        </button>
        <button onClick={() => setShowComments((s) => !s)}>
          <MessageCircle size={18} /> Komentarz
        </button>
      </div>
      {showComments && <Comments post={post} onCount={setCount} />}

      {likers && (
        <Modal title="Polubienia" onClose={() => setLikers(null)} width={400}>
          <div className="stack" style={{ gap: 10 }}>
            {likers.map((l) => (
              <Link key={l.user_id} to={`/u/${l.user_id}`} className="row" style={{ color: 'inherit' }} onClick={() => setLikers(null)}>
                <Avatar profile={l.profile} size={34} />
                <b className="small">{l.profile?.full_name}</b>
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </article>
  );
}

function Comments({ post, onCount }) {
  const { profile, perms } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const c = await api.listComments(post.id);
      setItems(c);
      onCount(c.length);
    } catch (e) {
      toast.error(e);
    }
  }, [post.id, toast, onCount]);
  useEffect(() => {
    load();
  }, [load]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.addComment(post.id, text.trim());
      setText('');
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="comments">
      {(items || []).map((c) => (
        <div key={c.id} className="comment">
          <Link to={`/u/${c.author_id}`}>
            <Avatar profile={c.author} size={30} />
          </Link>
          <div className="comment-bubble">
            <Link to={`/u/${c.author_id}`} className="post-author small">
              {c.author?.full_name}
            </Link>
            <div className="small pre">
              <Linkify text={c.body} />
            </div>
            <div className="tiny muted row" style={{ gap: 8 }}>
              {relTime(c.created_at)}
              {(c.author_id === profile.id || post.author_id === profile.id || perms.board) && (
                <button
                  className="link-btn tiny"
                  onClick={async () => {
                    try {
                      await api.deleteComment(c.id);
                      load();
                    } catch (e) {
                      toast.error(e);
                    }
                  }}
                >
                  Usuń
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <form className="comment" onSubmit={send}>
        <Avatar profile={profile} size={30} />
        <div className="row" style={{ flex: 1, gap: 6 }}>
          <input className="input comment-input" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Napisz komentarz…" />
          <button className="btn btn-primary btn-icon btn-sm" disabled={busy || !text.trim()} aria-label="Wyślij">
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}

// =====================================================================
//  Story (24 h)
// =====================================================================
const STORY_COLORS = ['#45B0E5', '#0D2436', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

export function StoriesBar() {
  const { profile } = useAuth();
  const [stories, setStories] = useState([]);
  const [open, setOpen] = useState(null); // index grupy autora
  const [create, setCreate] = useState(false);
  const load = useCallback(() => api.listStories().then(setStories).catch(console.error), []);
  useEffect(() => {
    load();
  }, [load]);

  // grupujemy po autorze; własne na początku, potem nieobejrzane
  const groups = [];
  stories.forEach((s) => {
    let g = groups.find((x) => x.author_id === s.author_id);
    if (!g) groups.push((g = { author_id: s.author_id, author: s.author, items: [] }));
    g.items.push(s);
  });
  groups.sort((a, b) => (b.author_id === profile.id) - (a.author_id === profile.id) || a.items.every((i) => i.seen) - b.items.every((i) => i.seen));
  const mineGroup = groups.find((g) => g.author_id === profile.id);

  return (
    <>
      <div className="stories">
        <button className="story-bubble" onClick={() => setCreate(true)}>
          <div className="story-ring add">
            <Avatar profile={profile} size={58} />
            <span className="story-plus">
              <Plus size={14} />
            </span>
          </div>
          <span>Twoje story</span>
        </button>
        {groups.map((g, i) => (
          <button key={g.author_id} className="story-bubble" onClick={() => setOpen(i)}>
            <div className={`story-ring ${g.items.every((x) => x.seen) ? 'seen' : ''}`}>
              <Avatar profile={g.author} size={58} />
            </div>
            <span className="truncate">{g.author_id === profile.id ? 'Ty' : g.author?.full_name?.split(' ')[0]}</span>
          </button>
        ))}
        {!groups.length && <span className="small muted" style={{ alignSelf: 'center' }}>Brak story – wrzuć pierwsze! Znika po 24 h.</span>}
      </div>
      {open !== null && groups[open] && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
      {create && (
        <StoryComposer
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            load();
          }}
          hasMine={!!mineGroup}
        />
      )}
    </>
  );
}

function StoryViewer({ groups, start, onClose }) {
  const { profile, perms } = useAuth();
  const toast = useToast();
  const [gi, setGi] = useState(start);
  const [ii, setIi] = useState(() => Math.max(0, groups[start].items.findIndex((x) => !x.seen)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState(null);
  const g = groups[gi];
  const s = g?.items[ii];
  const DURATION = 6000;

  const next = useCallback(() => {
    setProgress(0);
    if (ii < g.items.length - 1) setIi(ii + 1);
    else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setIi(0);
    } else onClose();
  }, [ii, gi, g, groups.length, onClose]);
  const prev = () => {
    setProgress(0);
    if (ii > 0) setIi(ii - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setIi(0);
    }
  };

  useEffect(() => {
    if (s && s.author_id !== profile.id) api.markStorySeen(s.id).catch(() => {});
    setViewers(null);
  }, [s, profile.id]);
  useEffect(() => {
    if (paused || viewers) return;
    const t0 = Date.now() - (progress / 100) * DURATION;
    const iv = setInterval(() => {
      const p = ((Date.now() - t0) / DURATION) * 100;
      if (p >= 100) {
        clearInterval(iv);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, paused, viewers, next]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  if (!s) return null;
  const mine = s.author_id === profile.id;

  return createPortal(
    <div className="story-viewer">
      <div className="story-frame" style={{ background: s.image_url ? '#000' : s.bg_color }}>
        <div className="story-progress">
          {g.items.map((x, i) => (
            <div key={x.id}>
              <div style={{ width: i < ii ? '100%' : i === ii ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="story-top">
          <Avatar profile={g.author} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="small">{g.author?.full_name}</b>
            <div className="tiny" style={{ opacity: 0.8 }}>
              {relTime(s.created_at)}
            </div>
          </div>
          {(mine || perms.board) && (
            <button
              className="story-btn"
              aria-label="Usuń story"
              onClick={async () => {
                try {
                  await api.deleteStory(s.id);
                  toast.success('Usunięto story');
                  onClose();
                } catch (e) {
                  toast.error(e);
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="story-btn" onClick={onClose} aria-label="Zamknij">
            <X size={22} />
          </button>
        </div>
        {s.image_url && <img className="story-img" src={s.image_url} alt="" />}
        {s.body && <div className={`story-text ${s.image_url ? 'on-image' : ''}`}>{s.body}</div>}
        <button className="story-tap left" onClick={prev} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="Poprzednie" />
        <button className="story-tap right" onClick={next} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} aria-label="Następne" />
        {mine && (
          <button className="story-viewers-btn" onClick={async () => setViewers(await api.listStoryViewers(s.id))}>
            <Eye size={16} /> Kto widział
          </button>
        )}
        {viewers && (
          <div className="story-viewers" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}>
              <b style={{ flex: 1 }}>Wyświetlenia ({viewers.length})</b>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewers(null)} aria-label="Zamknij">
                <X size={16} />
              </button>
            </div>
            {viewers.length === 0 && <p className="small muted">Nikt jeszcze nie oglądał.</p>}
            {viewers.map((v) => (
              <div key={v.profile?.id} className="row small" style={{ marginBottom: 6 }}>
                <Avatar profile={v.profile} size={28} /> {v.profile?.full_name}
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                  {relTime(v.viewed_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function StoryComposer({ onClose, onDone }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [color, setColor] = useState(STORY_COLORS[0]);
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const blob = await resizeLong(file, 1080);
      setImg({ blob, preview: URL.createObjectURL(blob) });
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <Modal
      title="Nowe story (24 h)"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || (!body.trim() && !img)}
            onClick={async () => {
              setBusy(true);
              try {
                const image_url = img ? await api.uploadCommunityImage(img.blob) : '';
                await api.createStory({ body: body.trim(), bg_color: color, image_url });
                toast.success('Dodano story – zniknie za 24 h');
                onDone();
              } catch (e) {
                toast.error(e);
                setBusy(false);
              }
            }}
          >
            {busy ? 'Dodawanie…' : 'Udostępnij'}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="story-preview" style={{ background: img ? '#000' : color }}>
          {img && <img src={img.preview} alt="" />}
          <textarea
            className={`story-preview-text ${img ? 'on-image' : ''}`}
            maxLength={300}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={img ? 'Dodaj podpis…' : 'Napisz coś…'}
          />
        </div>
        <div className="row row-wrap">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={16} /> {img ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
          </button>
          {img && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImg(null)}>
              <Type size={16} /> Tylko tekst
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>
        {!img && (
          <div className="swatches">
            {STORY_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
