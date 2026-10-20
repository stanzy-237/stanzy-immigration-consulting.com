'use strict';
// Frame-by-frame capture: headless Chrome (DevTools protocol over Node's built-in WebSocket)
// calls render(t) for every frame and pipes JPEG frames into ffmpeg (H.264 + AAC).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CHROME = process.env.STANZY_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 30;

async function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stanzy-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1080,1920',
    '--allow-file-access-from-files', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const browserWs = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome ne répond pas (STANZY_CHROME ?)')), 15000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', () => reject(new Error('Chrome s\'est arrêté au démarrage')));
  });
  const port = new URL(browserWs).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const cdp = await connect(page.webSocketDebuggerUrl);
  const close = async () => {
    try { cdp.ws.close(); } catch { /* already closed */ }
    const exited = new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
    proc.kill('SIGKILL');
    await exited;
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch { /* temp profile leftovers are harmless; the OS cleans its temp dir */ }
  };
  return { cdp, close };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(`${msg.error.message} ${msg.error.data || ''}`)) : res(msg.result);
      } else if (msg.method && listeners.has(msg.method)) {
        for (const fn of listeners.get(msg.method)) fn(msg.params);
      }
    };
    ws.onerror = () => reject(new Error('connexion DevTools impossible'));
    ws.onopen = () => resolve({
      ws,
      send: (method, params = {}) => new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { res, rej });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
      once: (method) => new Promise((res) => {
        const arr = listeners.get(method) || [];
        const fn = (p) => { listeners.set(method, arr.filter((x) => x !== fn)); res(p); };
        arr.push(fn);
        listeners.set(method, arr);
      }),
    });
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page : ${r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text}`);
  return r.result.value;
}

async function frameJpeg(cdp, t, quality) {
  await evaluate(cdp, `render(${t.toFixed(5)}); new Promise(r => requestAnimationFrame(() => r(1)))`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
  return Buffer.from(shot.data, 'base64');
}

// Render the capture page to an MP4 with the given audio, plus a cover JPEG at coverT.
async function renderVideo({ htmlFile, audioFile, outFile, coverFile, coverT, ffmpeg, onProgress }) {
  const { cdp, close } = await launchChrome();
  try {
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `file://${htmlFile}` });
    await loaded;
    const duration = await evaluate(cdp, 'document.fonts.ready.then(() => { StanzyEngine.init(); return StanzyEngine.duration; })');
    const frames = Math.ceil(duration * FPS);

    fs.writeFileSync(coverFile, await frameJpeg(cdp, coverT, 92));

    const enc = spawn(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audioFile,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outFile,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let encErr = '';
    enc.stderr.on('data', (d) => { encErr += d; });
    const done = new Promise((res, rej) => enc.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg : ${encErr.trim()}`)))));

    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      const jpg = await frameJpeg(cdp, i / FPS, 95);
      if (!enc.stdin.write(jpg)) await new Promise((r) => enc.stdin.once('drain', r));
      if (onProgress && (i % 15 === 0 || i === frames - 1)) onProgress(i + 1, frames, (Date.now() - started) / 1000);
    }
    enc.stdin.end();
    await done;
    return { frames, duration };
  } finally {
    await close();
  }
}

module.exports = { renderVideo, FPS };
