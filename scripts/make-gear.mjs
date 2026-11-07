// Generuje SVG zębatki inspirowanej logo SS PWr (zębatka z "ludzikami").
import { writeFileSync } from 'node:fs';
const N = 10, cx = 100, cy = 100;
const rOuter = 70, rInner = 58, rHole = 30, rRing = 22;
let d = '';
for (let i = 0; i < N; i++) {
  const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
  const step = (Math.PI * 2) / N;
  const pts = [
    [a0 - step * 0.5, rInner], [a0 - step * 0.2, rInner],
    [a0 - step * 0.16, rOuter], [a0 + step * 0.16, rOuter],
    [a0 + step * 0.2, rInner],
  ];
  pts.forEach(([a, r], j) => {
    const x = (cx + r * Math.cos(a)).toFixed(2), y = (cy + r * Math.sin(a)).toFixed(2);
    d += (i === 0 && j === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
  });
}
d += 'Z ';
// otwór (odwrotny kierunek → evenodd)
d += `M ${cx + rHole} ${cy} A ${rHole} ${rHole} 0 1 0 ${cx - rHole} ${cy} A ${rHole} ${rHole} 0 1 0 ${cx + rHole} ${cy} Z`;
const heads = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2 - Math.PI / 2;
  return `<circle cx="${(cx + 84 * Math.cos(a)).toFixed(2)}" cy="${(cy + 84 * Math.sin(a)).toFixed(2)}" r="7"/>`;
}).join('');
const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="${fill}"><path fill-rule="evenodd" d="${d}"/><circle cx="100" cy="100" r="${rRing}" fill="none" stroke="${fill}" stroke-width="5"/>${heads}</svg>`;
writeFileSync('src/assets/gear.svg', svg('#ffffff'));
writeFileSync('public/gear.svg', svg('#ffffff'));
// favicon: zębatka na niebieskim tle
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="#7DC9EE"/><g fill="#ffffff" transform="translate(18 18) scale(0.82)">${svg('#ffffff').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`);
console.log('ok');
