// Popularne serwisy społecznościowe: wpisz nazwę użytkownika albo wklej link.
// Na profilu pokazują się tylko uzupełnione.
const clean = (v) => String(v || '').trim().replace(/^@/, '');
const isUrl = (v) => /^https?:\/\//i.test(String(v || '').trim());

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', color: '#E1306C', short: 'IG', placeholder: 'nazwa', url: (v) => `https://instagram.com/${clean(v)}` },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', short: 'f', placeholder: 'nazwa lub link', url: (v) => `https://facebook.com/${clean(v)}` },
  { key: 'tiktok', label: 'TikTok', color: '#111111', short: 'TT', placeholder: 'nazwa', url: (v) => `https://www.tiktok.com/@${clean(v)}` },
  { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', short: 'in', placeholder: 'nazwa z linku /in/…', url: (v) => `https://www.linkedin.com/in/${clean(v)}` },
  { key: 'x', label: 'X (Twitter)', color: '#000000', short: 'X', placeholder: 'nazwa', url: (v) => `https://x.com/${clean(v)}` },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', short: 'YT', placeholder: 'nazwa kanału', url: (v) => `https://www.youtube.com/@${clean(v)}` },
  { key: 'spotify', label: 'Spotify', color: '#1DB954', short: 'S', placeholder: 'link do profilu', url: (v) => `https://open.spotify.com/user/${clean(v)}` },
  { key: 'snapchat', label: 'Snapchat', color: '#E6C800', short: 'SC', placeholder: 'nazwa', url: (v) => `https://www.snapchat.com/add/${clean(v)}` },
  { key: 'discord', label: 'Discord', color: '#5865F2', short: 'DC', placeholder: 'nazwa użytkownika', url: null },
  { key: 'github', label: 'GitHub', color: '#24292F', short: 'GH', placeholder: 'nazwa', url: (v) => `https://github.com/${clean(v)}` },
  { key: 'behance', label: 'Behance', color: '#1769FF', short: 'Be', placeholder: 'nazwa', url: (v) => `https://www.behance.net/${clean(v)}` },
  { key: 'twitch', label: 'Twitch', color: '#9146FF', short: 'TW', placeholder: 'nazwa', url: (v) => `https://www.twitch.tv/${clean(v)}` },
  { key: 'website', label: 'Strona / portfolio', color: '#2394D0', short: 'www', placeholder: 'https://…', url: (v) => (isUrl(v) ? v.trim() : `https://${clean(v)}`) },
];

/** Link do profilu (null dla serwisów bez publicznych linków, np. Discord) */
export function socialHref(platform, value) {
  if (!value) return null;
  if (isUrl(value)) return value.trim();
  return platform.url ? platform.url(value) : null;
}

export function socialLabel(platform, value) {
  if (platform.key === 'website') return String(value).replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (isUrl(value)) return platform.label;
  return platform.key === 'discord' ? clean(value) : `@${clean(value)}`;
}

/** Uzupełnione linki w kolejności listy */
export function filledSocials(socials) {
  const s = socials || {};
  return SOCIALS.filter((p) => String(s[p.key] || '').trim());
}
