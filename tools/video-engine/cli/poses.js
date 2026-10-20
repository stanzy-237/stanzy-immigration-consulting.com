'use strict';
// Writes a self-contained sheet of every character in every pose, for visual review.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ENGINE_ROOT, VIDEOS_ROOT } = require('../lib/project.js');
const { mascotSVG, POSE_NAMES, LOOK_NAMES } = require('../engine/mascot.js');

const out = path.join(VIDEOS_ROOT, '_mascot', 'poses.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
const font = fs.readFileSync(path.join(ENGINE_ROOT, 'engine', 'fonts', 'inter.woff2')).toString('base64');
const HOLD = { awa: 'phone', junior: 'beignet' };

const rows = LOOK_NAMES.map((look) => `
  <section><h2>${look}</h2><div class="row">${POSE_NAMES.map((p) => `
    <figure>${mascotSVG(p, 0.4, false, null, 1, { look, hold: p === 'idle' ? HOLD[look] : null })}<figcaption>${p}</figcaption></figure>`).join('')}
  </div></section>`).join('');

fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Personnages</title>
<style>
@font-face{font-family:Inter;font-weight:400 800;src:url(data:font/woff2;base64,${font})}
body{margin:0;width:1920px;font-family:Inter;background:#f7f8fc;color:#0d1f4e}
section{padding:10px 30px 0}h2{margin:6px 0;font-size:24px;text-transform:capitalize}
.row{display:grid;grid-template-columns:repeat(${POSE_NAMES.length},1fr);gap:10px}
figure{margin:0;background:#fff;border:1px solid #e8edf5;border-radius:14px;text-align:center;padding:6px 0}
figure svg{width:130px;height:228px;overflow:visible}
figcaption{font-weight:700;font-size:16px}
</style>${rows}`);
console.log(`  ▸ planche des personnages : ${out}`);
if (!process.argv.includes('--no-open')) execFileSync('open', [out]);
