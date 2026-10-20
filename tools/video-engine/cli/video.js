'use strict';
// One click: check → voice → music & effects → preview → MP4 + cover → verification → copy to ~/Downloads.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const Core = require('../engine/core.js');
const { runCheck } = require('./check.js');
const { writePreview } = require('./preview.js');
const { ensureVoice, ensureMix } = require('../lib/audio.js');
const { buildHtml } = require('../lib/build-html.js');
const { renderVideo } = require('../lib/capture.js');
const { ffmpegPath } = require('../lib/ffmpeg.js');

function coverTime(project, timeline) {
  const ref = project.config.cover;
  if (ref) return Core.resolveRef(ref, timeline);
  const w = Core.sceneWindows(timeline);
  const first = Object.keys(w).map(Number).sort((a, b) => a - b)[0];
  return Math.max(0.5, w[first].end - 0.4);
}

function verify(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const info = r.stderr || '';
  const video = /Video: h264[^\n]*1080x1920/.test(info);
  const audio = /Audio: aac/.test(info);
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  if (!video) throw new Error('vérification : piste vidéo H.264 1080×1920 absente');
  if (!audio) throw new Error('vérification : piste audio absente');
  return seconds;
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const t0 = Date.now();

  let r = runCheck(slug);
  if (r.errors.length) process.exit(1);
  if (ensureVoice(r.project)) {
    r = runCheck(slug);
    if (r.errors.length) process.exit(1);
  }
  ensureMix(r.project, r.timeline);
  r = runCheck(slug, { quiet: true });
  if (r.errors.length) process.exit(1);
  const { project, timeline } = r;
  writePreview(project, timeline);

  const build = path.join(project.dir, 'build');
  const htmlFile = path.join(build, 'capture.html');
  fs.writeFileSync(htmlFile, buildHtml(project, timeline, { capture: true }));
  const outFile = path.join(build, 'video.mp4');
  const coverFile = path.join(build, 'cover.jpg');
  const ffmpeg = ffmpegPath();

  console.log(`\n▸ rendu image par image (${timeline.duration.toFixed(1)} s · 30 i/s)`);
  const { frames } = await renderVideo({
    htmlFile, audioFile: project.mixFile, outFile, coverFile, coverT: coverTime(project, timeline), ffmpeg,
    onProgress: (i, n, el) => {
      const eta = i > 1 ? Math.round((el / i) * (n - i)) : 0;
      process.stdout.write(`\r  ▸ images ${i}/${n} (${Math.round((100 * i) / n)} %) · reste ~${eta} s   `);
    },
  });
  process.stdout.write('\n');
  const seconds = verify(ffmpeg, outFile);
  const mb = (fs.statSync(outFile).size / 1e6).toFixed(1);
  console.log(`  ✔ vidéo : ${outFile} (${seconds.toFixed(1)} s, ${frames} images, ${mb} Mo, H.264 + AAC)`);
  console.log(`  ✔ couverture : ${coverFile}`);

  const caption = path.join(project.dir, 'caption.txt');
  if (!fs.existsSync(caption)) console.log('  ⚠  caption.txt absent (légende TikTok/WhatsApp)');

  if (!args.includes('--no-downloads')) {
    const dest = path.join(os.homedir(), 'Downloads', 'stanzy-videos', project.slug);
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(outFile, path.join(dest, `${project.slug}.mp4`));
    fs.copyFileSync(coverFile, path.join(dest, 'cover.jpg'));
    if (fs.existsSync(caption)) fs.copyFileSync(caption, path.join(dest, 'caption.txt'));
    console.log(`  ✔ copié dans : ${dest}`);
    if (!args.includes('--no-open')) execFileSync('open', [dest]);
  }
  console.log(`\n  Terminé en ${Math.round((Date.now() - t0) / 1000)} s.`);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
