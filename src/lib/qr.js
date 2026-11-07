// Rotujący kod obecności: KKP1.<user_id>.<okno_30s>.<hmac10>
// Ten sam algorytm jest zaimplementowany w SQL (public.scan_attendance).

export const QR_WINDOW_SECONDS = 30;

export function currentWindow(date = Date.now()) {
  return Math.floor(date / 1000 / QR_WINDOW_SECONDS);
}

export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeAttendancePayload(userId, secret, date = Date.now()) {
  const w = currentWindow(date);
  const code = (await hmacHex(secret, String(w))).slice(0, 10);
  return `KKP1.${userId}.${w}.${code}`;
}

export function parsePayload(text) {
  const parts = String(text || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'KKP1') return null;
  return { userId: parts[1], window: Number(parts[2]), code: parts[3] };
}

/** Link do publicznej (dla członków) strony profilu – statyczny kod "wizytówka". */
export function profileUrl(userId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/u/${userId}`;
}
