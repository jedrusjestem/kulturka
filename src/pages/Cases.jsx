import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox, Send, ListChecks, Shield, EyeOff, Eye, MessageSquareWarning, Users, HeartHandshake, Building2, PartyPopper, Swords,
  HelpCircle, Megaphone, Search, Copy, Check, Trash2, Info, KeyRound, Clock, CircleCheck, CircleDot, CircleX, Flame,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Modal, Spinner, useConfirm, useToast } from '../components/ui';
import { fmtDateTime, normalize, relTime } from '../lib/format';

export const CASE_CATEGORIES = [
  { key: 'general', label: 'Ogólne', icon: Megaphone, color: '#45B0E5', hint: 'Sprawy dotyczące działania komisji' },
  { key: 'hr', label: 'HR', icon: Users, color: '#8B5CF6', hint: 'Członkowie, rekrutacja, zaangażowanie' },
  { key: 'integration', label: 'Integracje', icon: HeartHandshake, color: '#EC4899', hint: 'Atmosfera, wyjścia, wspólne inicjatywy' },
  { key: 'zrp', label: 'ZRP', icon: Building2, color: '#2394D0', hint: 'Sprawy związane z ZRP' },
  { key: 'events', label: 'Wydarzenia', icon: PartyPopper, color: '#F59E0B', hint: 'Organizacja i przebieg wydarzeń' },
  { key: 'conflicts', label: 'Konflikty', icon: Swords, color: '#EF4444', hint: 'Nieporozumienia, trudne sytuacje' },
  { key: 'other', label: 'Inne', icon: HelpCircle, color: '#64748B', hint: 'Napisz, czego dotyczy' },
];
const CAT = Object.fromEntries(CASE_CATEGORIES.map((c) => [c.key, c]));
export const CASE_STATUS = {
  new: { label: 'Nowa', cls: 'badge-pending', icon: CircleDot },
  in_progress: { label: 'W trakcie', cls: 'badge-board', icon: Clock },
  resolved: { label: 'Rozwiązana', cls: 'badge-success', icon: CircleCheck },
  rejected: { label: 'Zamknięta', cls: '', icon: CircleX },
};
const PRIORITY = { low: 'Niski', normal: 'Normalny', high: 'Wysoki' };
const TOKENS_KEY = (uid) => `kulturka-case-tokens-${uid}`;
const readTokens = (uid) => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY(uid)) || '[]');
  } catch {
    return [];
  }
};
const addToken = (uid, t) => localStorage.setItem(TOKENS_KEY(uid), JSON.stringify([...new Set([...readTokens(uid), t])]));

function CategoryBadge({ c }) {
  const cat = CAT[c.category] || CAT.other;
  return (
    <span className="badge" style={{ background: cat.color + '1f', color: cat.color }}>
      <cat.icon size={12} /> {c.category === 'other' && c.category_other ? `Inne: ${c.category_other}` : cat.label}
    </span>
  );
}
function StatusBadge({ s }) {
  const st = CASE_STATUS[s] || CASE_STATUS.new;
  return (
    <span className={`badge ${st.cls}`}>
      <st.icon size={12} /> {st.label}
    </span>
  );
}

export default function Cases() {
  const { perms, counts, refreshCounts } = useAuth();
  const [tab, setTab] = useState(perms.board ? 'inbox' : 'new');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kulturkowe sprawy</h1>
          <p>
            {perms.board
              ? 'Zawiadomienia od członków – sprawdzaj, przydzielaj i rozwiązuj problemy w komisji.'
              : 'Masz sprawę, problem albo pomysł? Wyślij zawiadomienie do zarządu – jawnie lub anonimowo.'}
          </p>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {perms.board && (
          <button className={`tab ${tab === 'inbox' ? 'active' : ''}`} onClick={() => setTab('inbox')}>
            <Inbox size={16} /> Skrzynka {counts.newCases > 0 && <span className="count">{counts.newCases}</span>}
          </button>
        )}
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
          <Send size={16} /> Wyślij zawiadomienie
        </button>
        <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          <ListChecks size={16} /> Moje zgłoszenia
        </button>
      </div>
      {tab === 'inbox' && perms.board && <BoardInbox onChange={refreshCounts} />}
      {tab === 'new' && <SubmitCase onDone={() => setTab('mine')} />}
      {tab === 'mine' && <MyCases />}
    </>
  );
}

// =====================================================================
//  Wysyłanie zawiadomienia (każdy członek)
// =====================================================================
function SubmitCase({ onDone }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [other, setOther] = useState('');
  const [desc, setDesc] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!category) return toast.error('Wybierz, czego dotyczy sprawa');
    if (category === 'other' && other.trim().length < 3) return toast.error('Napisz krótko, czego dotyczy sprawa');
    if (desc.trim().length < 10) return toast.error('Opisz sytuację (co najmniej 10 znaków)');
    setBusy(true);
    try {
      const r = await api.submitCase({ category, category_other: other.trim(), description: desc.trim(), anonymous });
      addToken(profile.id, r.tracking_token);
      setSent(r);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="card card-pad center stack" style={{ alignItems: 'center', maxWidth: 560, margin: '0 auto' }}>
        <div className="stat-icon" style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--success-bg)', color: 'var(--success)' }}>
          <CircleCheck size={32} />
        </div>
        <h2>Zawiadomienie wysłane</h2>
        <p className="muted small">
          {sent.anonymous
            ? 'Wysłano anonimowo – w bazie nie zapisaliśmy, kim jesteś. Status i odpowiedź zarządu zobaczysz w „Moje zgłoszenia” na tym urządzeniu.'
            : 'Zarząd zobaczy, że to Ty zgłaszasz, i może Ci odpowiedzieć. O zmianie statusu dostaniesz powiadomienie.'}
        </p>
        {sent.anonymous && <TokenBox token={sent.tracking_token} />}
        <div className="row">
          <button className="btn btn-primary" onClick={onDone}>
            Moje zgłoszenia
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSent(null);
              setCategory('');
              setOther('');
              setDesc('');
              setAnonymous(false);
            }}
          >
            Wyślij kolejne
          </button>
        </div>
      </div>
    );

  return (
    <form className="stack" style={{ gap: 18, maxWidth: 760 }} onSubmit={submit}>
      <div className="card card-pad stack">
        <h3>1. Czego dotyczy sprawa?</h3>
        <div className="case-cats">
          {CASE_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`case-cat ${category === c.key ? 'on' : ''}`}
              style={{ '--c': c.color }}
              onClick={() => setCategory(c.key)}
            >
              <c.icon size={20} />
              <b>{c.label}</b>
              <span>{c.hint}</span>
            </button>
          ))}
        </div>
        {category === 'other' && (
          <div className="field">
            <label>Czego mniej więcej dotyczy sprawa?</label>
            <input className="input" maxLength={120} value={other} onChange={(e) => setOther(e.target.value)} placeholder="np. sprzęt, finanse, sala na próby…" autoFocus />
          </div>
        )}
      </div>

      <div className="card card-pad stack">
        <h3>2. Opis sytuacji</h3>
        <textarea className="textarea" rows={6} maxLength={5000} value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="Co się dzieje? Od kiedy? Kogo dotyczy? Czego oczekujesz od zarządu?" />
        <span className="hint">{desc.trim().length}/5000 znaków · minimum 10</span>
      </div>

      <div className="card card-pad stack">
        <h3>3. Jak chcesz to zgłosić?</h3>
        <div className="case-vis">
          <button type="button" className={`case-cat ${!anonymous ? 'on' : ''}`} style={{ '--c': '#2394D0' }} onClick={() => setAnonymous(false)}>
            <Eye size={20} />
            <b>Jawnie</b>
            <span>Zarząd zobaczy, kto zgłasza, i może się z Tobą skontaktować. Dostaniesz powiadomienie o odpowiedzi.</span>
          </button>
          <button type="button" className={`case-cat ${anonymous ? 'on' : ''}`} style={{ '--c': '#0D2436' }} onClick={() => setAnonymous(true)}>
            <EyeOff size={20} />
            <b>Anonimowo</b>
            <span>Nie zapisujemy, kim jesteś – nawet w bazie. Status i odpowiedź sprawdzisz w „Moje zgłoszenia”.</span>
          </button>
        </div>
        {anonymous && (
          <div className="alert" style={{ fontSize: 13.5 }}>
            <Shield size={18} />
            <div>
              Pamiętaj, że w małej komisji szczegóły w opisie (imiona, daty, miejsca) mogą zdradzić, kto pisze. Po wysłaniu dostaniesz prywatny kod
              sprawy – zachowaj go, jeśli chcesz sprawdzać status na innym urządzeniu.
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={busy} style={{ minWidth: 200 }}>
          <Send size={17} /> {busy ? 'Wysyłanie…' : anonymous ? 'Wyślij anonimowo' : 'Wyślij zawiadomienie'}
        </button>
      </div>
    </form>
  );
}

function TokenBox({ token }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="case-token">
      <div className="tiny muted row" style={{ gap: 4 }}>
        <KeyRound size={12} /> Prywatny kod sprawy (nikomu go nie wysyłaj)
      </div>
      <code>{token}</code>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* brak schowka */
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Skopiowano' : 'Kopiuj'}
      </button>
    </div>
  );
}

// =====================================================================
//  Moje zgłoszenia
// =====================================================================
function MyCases() {
  const { profile } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [code, setCode] = useState('');
  const load = useCallback(async () => {
    try {
      setItems(await api.myCases(readTokens(profile.id)));
    } catch (e) {
      toast.error(e);
      setItems([]);
    }
  }, [profile.id, toast]);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <Spinner center />;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      {items.length === 0 ? (
        <div className="card">
          <Empty icon={MessageSquareWarning} title="Nie masz jeszcze zgłoszeń">
            Zawiadomienia anonimowe widać tylko na urządzeniu, z którego je wysłano (albo po wpisaniu kodu sprawy poniżej).
          </Empty>
        </div>
      ) : (
        items.map((c) => (
          <div key={c.id} className="card card-pad">
            <div className="row row-wrap" style={{ gap: 6 }}>
              <CategoryBadge c={c} />
              <StatusBadge s={c.status} />
              {c.anonymous ? (
                <span className="badge">
                  <EyeOff size={12} /> Anonimowe
                </span>
              ) : (
                <span className="badge">
                  <Eye size={12} /> Jawne
                </span>
              )}
              <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                {relTime(c.created_at)}
              </span>
            </div>
            {c.response ? (
              <div className="case-response">
                <div className="tiny" style={{ fontWeight: 700, color: 'var(--sky-700)' }}>
                  Odpowiedź zarządu
                </div>
                <p className="small pre">{c.response}</p>
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 10 }}>
                {c.status === 'new' ? 'Zarząd jeszcze nie odpowiedział.' : 'Zarząd zajmuje się sprawą.'}
              </p>
            )}
          </div>
        ))
      )}
      <form
        className="card card-pad row row-wrap"
        style={{ gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = code.trim().toLowerCase();
          if (!/^[0-9a-f]{24,64}$/.test(t)) return toast.error('To nie wygląda na kod sprawy');
          addToken(profile.id, t);
          setCode('');
          load();
        }}
      >
        <div style={{ flex: '1 1 220px' }}>
          <b className="small">Masz kod sprawy z innego urządzenia?</b>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Wklej kod sprawy" style={{ marginTop: 6 }} />
        </div>
        <button className="btn btn-secondary" style={{ alignSelf: 'flex-end' }}>
          Dodaj
        </button>
      </form>
    </div>
  );
}

// =====================================================================
//  Skrzynka zarządu
// =====================================================================
function BoardInbox({ onChange }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [board, setBoard] = useState([]);
  const [status, setStatus] = useState('open');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const [cases, people] = await Promise.all([api.listCases(), api.listProfiles()]);
      setItems(cases);
      setBoard(people.filter((p) => ['board', 'chair', 'admin'].includes(p.role)));
      onChange?.();
    } catch (e) {
      toast.error(e);
      setItems([]);
    }
  }, [toast, onChange]);
  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    if (!items) return [];
    const nq = normalize(q.trim());
    return items
      .filter((c) => (status === 'open' ? ['new', 'in_progress'].includes(c.status) : status === 'closed' ? ['resolved', 'rejected'].includes(c.status) : status === 'all' || c.status === status))
      .filter((c) => !cat || c.category === cat)
      .filter((c) => !nq || normalize(`${c.description} ${c.category_other} ${c.reporter?.full_name || ''}`).includes(nq))
      .sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || b.created_at.localeCompare(a.created_at));
  }, [items, status, cat, q]);

  if (!items) return <Spinner center />;
  const n = (s) => items.filter((c) => c.status === s).length;
  const resolved30 = items.filter((c) => c.status === 'resolved' && c.resolved_at && Date.now() - new Date(c.resolved_at) < 30 * 864e5).length;

  return (
    <>
      <section className="grid stats-grid" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <CircleDot size={22} />
          </div>
          <div>
            <b>{n('new')}</b>
            <span>Nowe</span>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-icon">
            <Clock size={22} />
          </div>
          <div>
            <b>{n('in_progress')}</b>
            <span>W trakcie</span>
          </div>
        </div>
        <div className="card stat">
          <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CircleCheck size={22} />
          </div>
          <div>
            <b>{resolved30}</b>
            <span>Rozwiązane (30 dni)</span>
          </div>
        </div>
      </section>

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 14 }}>
        <div className="tabs">
          {[
            ['open', 'Otwarte'],
            ['new', 'Nowe'],
            ['in_progress', 'W trakcie'],
            ['closed', 'Zamknięte'],
            ['all', 'Wszystkie'],
          ].map(([k, l]) => (
            <button key={k} className={`tab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>
              {l}
            </button>
          ))}
        </div>
        <select className="select" style={{ width: 'auto', flex: '0 1 200px' }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Wszystkie kategorie</option>
          {CASE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="input-icon" style={{ flex: '1 1 200px' }}>
          <Search size={17} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w treści…" />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={Inbox} title={status === 'open' ? 'Brak otwartych spraw 🎉' : 'Brak spraw'} />
        </div>
      ) : (
        <div className="card list">
          {list.map((c) => (
            <button key={c.id} className="list-item case-row" onClick={() => setOpen(c)}>
              {c.anonymous ? (
                <div className="avatar" style={{ width: 40, height: 40, background: 'var(--navy-900)' }}>
                  <EyeOff size={18} />
                </div>
              ) : (
                <Avatar profile={c.reporter} size={40} />
              )}
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="row row-wrap" style={{ gap: 6 }}>
                  <CategoryBadge c={c} />
                  <StatusBadge s={c.status} />
                  {c.priority === 'high' && (
                    <span className="badge badge-rejected">
                      <Flame size={12} /> Pilne
                    </span>
                  )}
                </div>
                <div className="small truncate" style={{ marginTop: 6 }}>
                  {c.description}
                </div>
                <div className="tiny muted">
                  {c.anonymous ? 'Anonimowo' : c.reporter?.full_name || 'Usunięte konto'} · {relTime(c.created_at)}
                  {c.assignee && ` · prowadzi: ${c.assignee.full_name}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <CaseModal
          c={open}
          board={board}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </>
  );
}

function CaseModal({ c, board, onClose, onSaved }) {
  const { perms, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ status: c.status, priority: c.priority, assigned_to: c.assigned_to || '', board_note: c.board_note || '', response: c.response || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      await api.updateCase(c.id, { ...f, assigned_to: f.assigned_to || null });
      toast.success('Zapisano sprawę');
      onSaved();
    } catch (e) {
      toast.error(e);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Kulturkowa sprawa"
      onClose={onClose}
      width={620}
      footer={
        <>
          {perms.chair && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto' }}
              onClick={async () => {
                if (!(await confirm({ message: 'Usunąć sprawę na stałe?', danger: true, confirmText: 'Usuń' }))) return;
                try {
                  await api.deleteCase(c.id);
                  onSaved();
                } catch (e) {
                  toast.error(e);
                }
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="row row-wrap" style={{ gap: 6 }}>
          <CategoryBadge c={c} />
          <StatusBadge s={c.status} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          {c.anonymous ? (
            <div className="avatar" style={{ width: 36, height: 36, background: 'var(--navy-900)' }}>
              <EyeOff size={16} />
            </div>
          ) : (
            <Avatar profile={c.reporter} size={36} />
          )}
          <div className="small">
            <b>{c.anonymous ? 'Zgłoszenie anonimowe' : c.reporter?.full_name || 'Usunięte konto'}</b>
            <div className="tiny muted">{fmtDateTime(c.created_at)}</div>
          </div>
        </div>
        <div className="case-desc pre">{c.description}</div>

        <div className="grid grid-3" style={{ gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="field">
            <label>Status</label>
            <select className="select" value={f.status} onChange={set('status')}>
              {Object.entries(CASE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priorytet</label>
            <select className="select" value={f.priority} onChange={set('priority')}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Prowadzi</label>
            <select className="select" value={f.assigned_to} onChange={set('assigned_to')}>
              <option value="">— nikt —</option>
              {board.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === profile.id ? `${p.full_name} (ja)` : p.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="row" style={{ gap: 6 }}>
            <Shield size={14} /> Notatka wewnętrzna (widzi tylko zarząd)
          </label>
          <textarea className="textarea" rows={3} maxLength={5000} value={f.board_note} onChange={set('board_note')}
            placeholder="Ustalenia, kroki, z kim rozmawiać…" />
        </div>
        <div className="field">
          <label className="row" style={{ gap: 6 }}>
            <Send size={14} /> Odpowiedź dla zgłaszającego
          </label>
          <textarea className="textarea" rows={3} maxLength={3000} value={f.response} onChange={set('response')}
            placeholder="Zobaczy ją w „Moje zgłoszenia” (także przy zgłoszeniu anonimowym)." />
          {!c.anonymous && <span className="hint">Zgłaszający dostanie powiadomienie e-mail o odpowiedzi i zmianie statusu.</span>}
        </div>
        <div className="alert" style={{ fontSize: 13 }}>
          <Info size={16} /> Treści zgłoszenia nie można edytować – zostaje w oryginalnej formie.
        </div>
      </div>
    </Modal>
  );
}
