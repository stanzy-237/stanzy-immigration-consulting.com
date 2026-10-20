'use strict';
// Audio steps shared by `voice` and `video`: each runs only when its output is out of date.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ENGINE_ROOT, TTS_CACHE } = require('./project.js');
const { soundPlan, mixHash } = require('./events.js');

const PYTHON = process.env.STANZY_PYTHON || 'python3';

function runPython(script, args) {
  const r = spawnSync(PYTHON, [path.join(ENGINE_ROOT, 'python', script), ...args], {
    stdio: 'inherit', cwd: path.join(ENGINE_ROOT, 'python'),
  });
  if (r.status !== 0) throw new Error(`${script} a échoué (pip3 install --user -r tools/video-engine/python/requirements.txt ?)`);
}

function ensureVoice(project, { force } = {}) {
  if (project.voiceFile && !force) return false;
  const cast = project.config.cast;
  const voice = cast
    ? Object.entries(cast).map(([id, c]) => `${id}: ${c.voice.name || 'enregistrement'}`).join(' · ')
    : (project.config.voice && project.config.voice.name) || 'fr-CA-ThierryNeural';
  console.log(`\n▸ voix ${project.slug} (${voice})`);
  runPython('tts_edge.py', ['--project', project.dir, '--hash', project.sourceHash, '--cache', TTS_CACHE]);
  return true;
}

function ensureMix(project, timeline) {
  const hash = mixHash(project);
  if (project.mixRecordedHash === hash && fs.existsSync(project.mixFile)) return false;
  const eventsFile = path.join(project.dir, 'build', 'events.json');
  fs.writeFileSync(eventsFile, JSON.stringify(soundPlan(project, timeline)));
  const mood = (project.config.music && project.config.music.mood) || 'upbeat';
  console.log(`\n▸ musique & effets ${project.slug} (ambiance « ${mood} »)`);
  runPython('music.py', ['--project', project.dir, '--events', eventsFile, '--hash', hash]);
  return true;
}

module.exports = { ensureVoice, ensureMix };
