// Generuje ikony PWA (PNG) z favicon.svg
import sharp from 'sharp';
const src = 'public/favicon.svg';
for (const s of [192, 512]) await sharp(src).resize(s, s).png().toFile(`public/icon-${s}.png`);
// maskable – z marginesem bezpieczeństwa
const pad = await sharp(src).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#7DC9EE' } })
  .composite([{ input: pad, gravity: 'center' }]).png().toFile('public/icon-maskable-512.png');
await sharp(src).resize(180, 180).flatten({ background: '#7DC9EE' }).png().toFile('public/apple-touch-icon.png');
console.log('icons ok');
