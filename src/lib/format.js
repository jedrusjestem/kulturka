const TZ = 'Europe/Warsaw';

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
export const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: TZ });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtWeekday = (d) => new Date(d).toLocaleDateString('pl-PL', { weekday: 'long', timeZone: TZ });
export const fmtDateTime = (d) => `${fmtDate(d)}, ${fmtTime(d)}`;

export function relTime(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return 'przed chwilą';
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return fmtDate(d);
}

/** "2026-11-07T18:00" (czas lokalny) dla <input type="datetime-local"> */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function normalize(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}
