// Renders Stanzy's poses to public/stanzy/<pose>.svg from the content studio's mascot,
// so the site never redraws him. Run again whenever the mascot changes:
//   node scripts/render-stanzy.mjs [path/to/mascot.js]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] ?? resolve(root, '../stanzy_content_studio/video-engine/engine/mascot.js'));
const { mascotSVG } = createRequire(import.meta.url)(source);

// The poses the site uses: wave (hero, invitation band), pointr (Ce qu'on aborde), idle (FAQ avatar).
const POSES = ['wave', 'pointr', 'idle'];

const out = resolve(root, 'public/stanzy');
mkdirSync(out, { recursive: true });
for (const pose of POSES) {
  const svg = mascotSVG(pose, 0, false, null, undefined, { look: 'stanzy' });
  writeFileSync(resolve(out, `${pose}.svg`), `${svg.replace(/\n\s*/g, '')}\n`);
  console.log(`public/stanzy/${pose}.svg`);
}

// Waving: the mascot's wave cycle (1.8 Hz) as frames side by side, stepped by CSS inside the SVG,
// so an <img> plays it with no script. It ends on the still `wave` pose; reduced motion shows that pose.
const FRAMES = 12;
const PERIOD = 1 / 1.8;
const WIDTH = 240;
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\n\s*/g, '');
for (const [name, times] of [['wave-twice', 2], ['wave-once', 1]]) {
  let frames = '';
  for (let i = 0; i < FRAMES; i += 1) {
    const svg = mascotSVG('wave', (i / FRAMES) * PERIOD, false, null, undefined, { look: 'stanzy' });
    frames += `<g transform="translate(${i * WIDTH} 0)">${inner(svg)}</g>`;
  }
  const ms = Math.round(PERIOD * 1000);
  const css =
    `.s{animation:w ${ms}ms steps(${FRAMES}) 400ms ${times}}` +
    `@keyframes w{to{transform:translateX(-${FRAMES * WIDTH}px)}}` +
    '@media (prefers-reduced-motion:reduce){.s{animation:none}}';
  const svg = `<svg viewBox="0 0 ${WIDTH} 420" xmlns="http://www.w3.org/2000/svg"><style>${css}</style><g class="s">${frames}</g></svg>\n`;
  writeFileSync(resolve(out, `${name}.svg`), svg);
  console.log(`public/stanzy/${name}.svg`);
}
