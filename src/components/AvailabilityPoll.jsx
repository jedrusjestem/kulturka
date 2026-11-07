import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, Trash2, Users, UserRound, Trophy, StickyNote } from 'lucide-react';
import { api } from '../api';
import { Avatar, useConfirm, useToast } from './ui';

const pad = (n) => String(n).padStart(2, '0');
const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const dayLabel = (d) => {
  const x = new Date(d + 'T12:00:00');
  return {
    wd: x.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', ''),
    dm: x.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' }),
  };
};

/** Ankieta dostępności w stylu Crab Fit: zaznacz przeciągając, zobacz mapę dostępności grupy. */
export default function AvailabilityPoll({ poll, me, canManage, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [responses, setResponses] = useState(null);
  const [mine, setMine] = useState(new Set());
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('me');
  const [focus, setFocus] = useState(null); // slot podglądany w widoku grupy
  const drag = useRef(null);

  const times = useMemo(() => {
    const out = [];
    for (let m = poll.start_minute; m < poll.end_minute; m += poll.slot_minutes) out.push(m);
    return out;
  }, [poll]);
  const dates = poll.dates;
  const key = (d, m) => `${d} ${hm(m)}`;

  const load = useCallback(async () => {
    try {
      const r = await api.listPollResponses(poll.id);
      setResponses(r);
      const my = r.find((x) => x.user_id === me.id);
      setMine(new Set(my?.slots || []));
      setNote(my?.note || '');
      setDirty(false);
    } catch (e) {
      toast.error(e);
      setResponses([]);
    }
  }, [poll.id, me.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- malowanie (mysz + dotyk): prostokąt od pola startowego do bieżącego, jak w Crab Fit ----------
  const pos = (slot) => {
    if (!slot) return null;
    const di = dates.indexOf(slot.slice(0, 10));
    const [h, mi] = slot.slice(11).split(':').map(Number);
    const ti = times.indexOf(h * 60 + mi);
    return di < 0 || ti < 0 ? null : { di, ti };
  };
  const paintTo = (slot) => {
    const d = drag.current;
    const p = pos(slot);
    if (!d || !p || (d.last && d.last.di === p.di && d.last.ti === p.ti)) return;
    d.last = p;
    const n = new Set(d.base);
    const [d0, d1] = [Math.min(d.start.di, p.di), Math.max(d.start.di, p.di)];
    const [t0, t1] = [Math.min(d.start.ti, p.ti), Math.max(d.start.ti, p.ti)];
    for (let i = d0; i <= d1; i++)
      for (let j = t0; j <= t1; j++) {
        const k = key(dates[i], times[j]);
        if (d.add) n.add(k);
        else n.delete(k);
      }
    setMine(n);
    setDirty(true);
  };
  const slotAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-slot]')?.getAttribute('data-slot');
  const onDown = (e) => {
    const slot = e.target.closest?.('[data-slot]')?.getAttribute('data-slot');
    const p = pos(slot);
    if (!p) return;
    e.preventDefault();
    drag.current = { add: !mine.has(slot), start: p, base: new Set(mine), last: null };
    paintTo(slot);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    paintTo(slotAt(e.clientX, e.clientY));
  };
  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // ---------- dane grupy ----------
  const others = responses || [];
  const total = others.length + (others.some((r) => r.user_id === me.id) ? 0 : dirty || mine.size ? 1 : 0);
  const countMap = useMemo(() => {
    const m = {};
    (responses || []).forEach((r) => {
      const slots = r.user_id === me.id ? [...mine] : r.slots;
      slots.forEach((s) => (m[s] = (m[s] || 0) + 1));
    });
    if (!(responses || []).some((r) => r.user_id === me.id)) [...mine].forEach((s) => (m[s] = (m[s] || 0) + 1));
    return m;
  }, [responses, mine, me.id]);
  const max = Math.max(1, ...Object.values(countMap));
  const best = useMemo(
    () =>
      Object.entries(countMap)
        .filter(([s]) => dates.includes(s.slice(0, 10)))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3),
    [countMap, dates]
  );
  const whoAt = (slot) => {
    const all = (responses || []).map((r) => ({ ...r, slots: r.user_id === me.id ? [...mine] : r.slots }));
    return {
      yes: all.filter((r) => r.slots.includes(slot)),
      no: all.filter((r) => !r.slots.includes(slot)),
    };
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveMyAvailability(poll.id, [...mine].sort(), note.trim());
      toast.success('Zapisano Twoją dostępność');
      await load();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const fmtSlot = (s) => {
    const { wd, dm } = dayLabel(s.slice(0, 10));
    const [h, mi] = s.slice(11).split(':').map(Number);
    return `${wd} ${dm}, ${s.slice(11)}–${hm(h * 60 + mi + poll.slot_minutes)}`;
  };

  // render-funkcje (nie komponenty) – komórki nie są przemontowywane w trakcie przeciągania palcem
  const renderGrid = (mode) => (
    <div className="avail-scroll">
      <div
        className={`avail-grid ${mode === 'me' ? 'paint' : ''}`}
        style={{ gridTemplateColumns: `46px repeat(${dates.length}, minmax(42px, 1fr))` }}
        onPointerDown={mode === 'me' ? onDown : undefined}
        onPointerMove={mode === 'me' ? onMove : undefined}
      >
        <div />
        {dates.map((d) => {
          const l = dayLabel(d);
          return (
            <div key={d} className="avail-day">
              <b>{l.wd}</b>
              <span>{l.dm}</span>
            </div>
          );
        })}
        {times.map((m) => renderRow(m, mode))}
      </div>
    </div>
  );

  const renderRow = (m, mode) => [
      <div key={`t${m}`} className="avail-time">{m % 60 === 0 ? hm(m) : ''}</div>,
      ...dates.map((d) => {
        const s = key(d, m);
        if (mode === 'me') {
          return <div key={s} data-slot={s} className={`avail-cell ${mine.has(s) ? 'on' : ''} ${m % 60 === 0 ? 'hour' : ''}`} />;
        }
        const c = countMap[s] || 0;
        return (
          <button
            type="button"
            key={s}
            className={`avail-cell heat ${m % 60 === 0 ? 'hour' : ''} ${focus === s ? 'focus' : ''}`}
            style={{ background: c ? `rgba(35, 148, 208, ${0.15 + (0.85 * c) / max})` : undefined }}
            onClick={() => setFocus(focus === s ? null : s)}
            title={`${c}/${total} dostępnych`}
          />
        );
      }),
  ];

  const focusInfo = focus ? whoAt(focus) : null;

  return (
    <div className="avail">
      <div className="row" style={{ marginBottom: 10 }}>
        <CalendarClock size={18} color="var(--sky-600)" />
        <b style={{ flex: 1 }}>Ankieta dostępności</b>
        <span className="badge">
          <Users size={12} /> {others.length} odp.
        </span>
        {canManage && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ width: 30, height: 30 }}
            aria-label="Usuń ankietę"
            onClick={async () => {
              if (!(await confirm({ message: 'Usunąć ankietę wraz z odpowiedziami?', danger: true, confirmText: 'Usuń' }))) return;
              try {
                await api.deletePoll(poll.id);
                onDeleted?.();
              } catch (e) {
                toast.error(e);
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={`tab ${view === 'me' ? 'active' : ''}`} onClick={() => setView('me')}>
          <UserRound size={15} /> Moja
        </button>
        <button type="button" className={`tab ${view === 'group' ? 'active' : ''}`} onClick={() => setView('group')}>
          <Users size={15} /> Grupa
        </button>
      </div>

      {!responses ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : view === 'me' ? (
        <>
          <p className="tiny muted" style={{ marginBottom: 8 }}>
            Przeciągnij palcem lub myszką po polach, kiedy możesz (zaznacza się prostokąt). Przeciągnięcie zaczęte na zaznaczonym polu odznacza.
          </p>
          {renderGrid('me')}
          <div className="field" style={{ marginTop: 12 }}>
            <label className="row" style={{ gap: 6 }}>
              <StickyNote size={14} /> Notatka (opcjonalnie)
            </label>
            <input
              className="input"
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              placeholder="np. „w czwartek raczej tak, potwierdzę do środy”"
            />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="tiny muted" style={{ flex: 1 }}>
              Zaznaczono {mine.size} {mine.size === 1 ? 'pole' : 'pól'}
            </span>
            <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}>
              <Check size={15} /> {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>
        </>
      ) : (
        <>
          {renderGrid('group')}
          <div className="row tiny muted" style={{ gap: 6, marginTop: 8 }}>
            <span>0</span>
            <div className="avail-legend" />
            <span>{max} os.</span>
            <span style={{ marginLeft: 'auto' }}>Dotknij pola, aby zobaczyć kto może</span>
          </div>
          {focusInfo && (
            <div className="avail-focus">
              <b className="small">{fmtSlot(focus)}</b>
              <div className="small" style={{ marginTop: 6 }}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Mogą ({focusInfo.yes.length}): </span>
                {focusInfo.yes.map((r) => r.profile?.full_name || 'Ty').join(', ') || '—'}
              </div>
              <div className="small muted">
                <span style={{ fontWeight: 600 }}>Nie mogą ({focusInfo.no.length}): </span>
                {focusInfo.no.map((r) => r.profile?.full_name).join(', ') || '—'}
              </div>
            </div>
          )}
          {best.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="label row" style={{ gap: 6, marginBottom: 6 }}>
                <Trophy size={14} /> Najlepsze terminy
              </div>
              {best.map(([s, c]) => (
                <button type="button" key={s} className="avail-best" onClick={() => setFocus(s)}>
                  <span>{fmtSlot(s)}</span>
                  <b>
                    {c}/{others.length || 1}
                  </b>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {others.length > 0 && (
        <div className="avail-people">
          {others.map((r) => (
            <div key={r.user_id} className="row small" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Avatar profile={r.profile} size={24} />
              <div style={{ minWidth: 0 }}>
                <b>{r.profile?.full_name || 'Ty'}</b> <span className="muted tiny">· {r.slots.length} pól</span>
                {r.note && <div className="muted tiny">„{r.note}”</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
/** Pola tworzenia ankiety w formularzu ogłoszenia */
export function PollFields({ value, onChange }) {
  const v = value;
  // aktualizacja funkcyjna – szybkie kolejne kliknięcia nie nadpisują się
  const set = (patch) => onChange((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const rangeDays = useMemo(() => {
    if (!v.from || !v.to) return [];
    const out = [];
    const a = new Date(v.from + 'T12:00:00');
    const b = new Date(v.to + 'T12:00:00');
    for (let d = new Date(a); d <= b && out.length < 31; d.setDate(d.getDate() + 1)) {
      out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    return out;
  }, [v.from, v.to]);
  const excluded = new Set(v.excluded || []);
  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="stack" style={{ gap: 10, padding: 12, borderRadius: 14, background: 'var(--sky-50)', border: '1px solid var(--sky-100)' }}>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <div className="field">
          <label>Od dnia</label>
          <input className="input" type="date" value={v.from} onChange={(e) => set({ from: e.target.value, to: v.to < e.target.value ? e.target.value : v.to })} />
        </div>
        <div className="field">
          <label>Do dnia</label>
          <input className="input" type="date" value={v.to} min={v.from} onChange={(e) => set({ to: e.target.value })} />
        </div>
      </div>
      {rangeDays.length > 1 && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            Dni w ankiecie (odznacz niepotrzebne)
          </div>
          <div className="row row-wrap" style={{ gap: 6 }}>
            {rangeDays.map((d) => {
              const l = dayLabel(d);
              const on = !excluded.has(d);
              return (
                <button
                  type="button"
                  key={d}
                  className={`badge ${on ? 'badge-board' : ''}`}
                  style={{ cursor: 'pointer', border: 0, height: 30, opacity: on ? 1 : 0.5 }}
                  onClick={() =>
                    set((prev) => {
                      const n = new Set(prev.excluded || []);
                      n.has(d) ? n.delete(d) : n.add(d);
                      return { excluded: [...n] };
                    })
                  }
                >
                  {l.wd} {l.dm}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-3" style={{ gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="field">
          <label>Od godz.</label>
          <select className="select" value={v.startH} onChange={(e) => set({ startH: +e.target.value, endH: Math.max(v.endH, +e.target.value + 1) })}>
            {hours.slice(0, 24).map((h) => (
              <option key={h} value={h}>
                {pad(h)}:00
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Do godz.</label>
          <select className="select" value={v.endH} onChange={(e) => set({ endH: +e.target.value })}>
            {hours.slice(v.startH + 1).map((h) => (
              <option key={h} value={h}>
                {pad(h)}:00
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Co</label>
          <select className="select" value={v.slot} onChange={(e) => set({ slot: +e.target.value })}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 godz.</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function defaultPollValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const e = new Date(d);
  e.setDate(e.getDate() + 6);
  const f = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return { from: f(d), to: f(e), excluded: [], startH: 16, endH: 21, slot: 30 };
}

/** Zamienia wartości formularza na rekord ankiety */
export function pollPayload(v) {
  const dates = [];
  const a = new Date(v.from + 'T12:00:00');
  const b = new Date(v.to + 'T12:00:00');
  const ex = new Set(v.excluded || []);
  for (let d = new Date(a); d <= b && dates.length < 31; d.setDate(d.getDate() + 1)) {
    const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (!ex.has(s)) dates.push(s);
  }
  if (!dates.length) throw new Error('Wybierz co najmniej jeden dzień ankiety');
  return { dates, start_minute: v.startH * 60, end_minute: v.endH * 60, slot_minutes: v.slot };
}
