import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { initials } from '../lib/format';
import { ROLE_LABELS, activeAssignments } from '../lib/perms';
import gear from '../assets/gear.svg';

export { gear };

const AVATAR_COLORS = ['#45b0e5', '#2394d0', '#5aa9d6', '#3d8fc4', '#6cc0e8', '#1f84bd', '#4aa0cf'];

export function Avatar({ profile, size = 40 }) {
  const name = profile?.full_name || '?';
  if (profile?.avatar_url) {
    return <img className="avatar" src={profile.avatar_url} alt={name} style={{ width: size, height: size }} />;
  }
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${AVATAR_COLORS[idx]}, ${AVATAR_COLORS[(idx + 2) % AVATAR_COLORS.length]})`,
      }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}

export function RoleBadge({ role }) {
  return <span className={`badge badge-${role === 'alumni' ? 'member' : role}`}>{ROLE_LABELS[role] || role}</span>;
}

export function CustomRoleBadges({ profile, showExpiry = false }) {
  return activeAssignments(profile).map((a) => (
    <span
      key={a.id}
      className="badge"
      style={{ background: hexA(a.role.color, 0.14), color: darken(a.role.color) }}
      title={a.expires_at ? `do ${new Date(a.expires_at).toLocaleDateString('pl-PL')}` : 'bezterminowo'}
    >
      <span className="color-dot" style={{ background: a.role.color, width: 8, height: 8 }} />
      {a.role.name}
      {showExpiry && a.expires_at && (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>· do {new Date(a.expires_at).toLocaleDateString('pl-PL')}</span>
      )}
    </span>
  ));
}

export function hexA(hex, a) {
  const h = (hex || '#45b0e5').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function darken(hex) {
  const h = (hex || '#45b0e5').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  const f = (v) => Math.round(v * 0.62);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function Logo({ size = 44 }) {
  return <img src={gear} className="brand-logo" style={{ width: size, height: size }} alt="" />;
}

export function Spinner({ center }) {
  if (center)
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  return <div className="spinner" />;
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={44} strokeWidth={1.5} />}
      <h3 style={{ color: 'var(--navy-800)' }}>{title}</h3>
      {children && <p className="small" style={{ marginTop: 6 }}>{children}</p>}
    </div>
  );
}

// Blokada przewijania tła, gdy otwarte jest okno (licznik – kilka okien naraz)
let lockCount = 0;
let savedScroll = 0;
function lockScroll() {
  if (lockCount++ > 0) return;
  savedScroll = window.scrollY;
  const b = document.body.style;
  b.position = 'fixed';
  b.top = `-${savedScroll}px`;
  b.left = '0';
  b.right = '0';
  b.width = '100%';
}
function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = '';
  window.scrollTo(0, savedScroll);
}

export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);
  // Okno dopasowuje się do WIDOCZNEGO obszaru (np. gdy na telefonie otwarta jest klawiatura)
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`);
      root.style.setProperty('--vvt', `${vv ? vv.offsetTop : 0}px`);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  // aktywne pole zawsze widoczne w przewijanej treści okna
  const onFocusCapture = (e) => {
    if (!e.target.matches?.('input, textarea, select')) return;
    const el = e.target;
    setTimeout(() => el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 320);
  };
  // Portal do <body>: okno zawsze przykrywa cały ekran, niezależnie od animacji rodzica
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" onFocusCapture={onFocusCapture}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------- toasty ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'info') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), type === 'error' ? 5000 : 3000);
  }, []);
  const api = useMemo(
    () =>
      Object.assign((m, t) => push(m, t), {
        success: (m) => push(m, 'success'),
        error: (m) => push(m instanceof Error ? m.message : String(m), 'error'),
      }),
    [push]
  );
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- potwierdzenie ----------
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setState({ ...(typeof opts === 'string' ? { message: opts } : opts), resolve })),
    []
  );
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.title || 'Na pewno?'}
          onClose={() => close(false)}
          width={420}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => close(false)}>
                Anuluj
              </button>
              <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {state.confirmText || 'Potwierdź'}
              </button>
            </>
          }
        >
          <p className="muted">{state.message}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

/** Zamienia linki w tekście na klikalne – bez dangerouslySetInnerHTML (ochrona przed XSS). */
export function Linkify({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s<]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
