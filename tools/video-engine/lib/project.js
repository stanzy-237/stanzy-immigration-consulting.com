'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENGINE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ENGINE_ROOT, '..', '..');
const VIDEOS_ROOT = path.join(REPO_ROOT, 'content', 'videos');
const EXAMPLES_ROOT = path.join(ENGINE_ROOT, 'examples');
const TTS_CACHE = path.join(VIDEOS_ROOT, '_cache', 'tts');
const GLOBAL_PRON = path.join(ENGINE_ROOT, 'engine', 'pron', 'fr.json');
const PRON_CODE = path.join(ENGINE_ROOT, 'python', 'pron_fr.py');
const TTS_CODE = path.join(ENGINE_ROOT, 'python', 'tts_edge.py');

// Everything the voice depends on. A timeline recorded from different inputs is stale.
function sourceHash(script, config) {
  const h = crypto.createHash('sha1');
  const castVoices = config && config.cast
    ? Object.fromEntries(Object.entries(config.cast).map(([id, c]) => [id, c.voice || null]))
    : null;
  h.update(JSON.stringify({ script, voice: (config && config.voice) || null, pron: (config && config.pron) || null, castVoices, pacing: (config && config.pacing) || null }));
  for (const f of [GLOBAL_PRON, PRON_CODE, TTS_CODE]) h.update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 16);
}

function resolveProjectDir(slugOrPath) {
  if (!slugOrPath) throw new Error('Usage : npm run <commande> -- <slug>  (dossier dans content/videos/ ou examples/)');
  const candidates = [
    path.resolve(slugOrPath),
    path.join(VIDEOS_ROOT, slugOrPath),
    path.join(EXAMPLES_ROOT, slugOrPath),
  ];
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'script.json')));
  if (!dir) throw new Error(`Projet "${slugOrPath}" introuvable (cherché dans content/videos/ et examples/)`);
  return dir;
}

function extractScenesHtml(js) {
  const m = /innerHTML\s*=\s*`([\s\S]*)`\s*;?\s*$/.exec(js.trim());
  if (!m) throw new Error("scenes.js doit contenir document.getElementById('scenes').innerHTML = `…`;");
  return m[1];
}

function loadProject(dir) {
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const parse = (f) => {
    try {
      return JSON.parse(read(f));
    } catch (e) {
      throw new Error(`${f} : JSON invalide — ${e.message}`);
    }
  };
  const scenesJs = read('scenes.js');
  const script = parse('script.json');
  const config = parse('config.json');
  const hash = sourceHash(script, config);
  const timelinePath = path.join(dir, 'build', 'timeline.json');
  const voicePath = path.join(dir, 'build', 'voice.wav');
  const recorded = fs.existsSync(timelinePath) ? JSON.parse(fs.readFileSync(timelinePath, 'utf8')) : null;
  const fresh = !!(recorded && recorded.sourceHash === hash && fs.existsSync(voicePath));
  const mixMeta = path.join(dir, 'build', 'mix.json');
  const mixRecorded = fs.existsSync(mixMeta) ? JSON.parse(fs.readFileSync(mixMeta, 'utf8')) : null;
  return {
    mixRecordedHash: mixRecorded ? mixRecorded.hash : null,
    mixFile: path.join(dir, 'build', 'mix.wav'),
    dir,
    slug: path.basename(dir),
    script,
    config,
    scenesJs,
    scenesHtml: extractScenesHtml(scenesJs),
    sourceHash: hash,
    timeline: fresh ? recorded : null,
    voiceFile: fresh ? voicePath : null,
    voiceStale: !!recorded && !fresh,
  };
}

module.exports = {
  ENGINE_ROOT, REPO_ROOT, VIDEOS_ROOT, EXAMPLES_ROOT, TTS_CACHE,
  resolveProjectDir, loadProject, extractScenesHtml, sourceHash,
};
