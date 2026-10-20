'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadProject, resolveProjectDir, sourceHash } = require('../lib/project.js');

function tempProject() {
  const src = resolveProjectDir('demo');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stanzy-video-'));
  for (const f of ['script.json', 'scenes.js', 'config.json']) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'build'));
  fs.writeFileSync(path.join(dir, 'build', 'voice.wav'), '');
  return dir;
}

function record(dir, hash) {
  const timeline = { duration: 50, estimated: false, sourceHash: hash, phrases: [] };
  fs.writeFileSync(path.join(dir, 'build', 'timeline.json'), JSON.stringify(timeline));
}

test('a recorded voice is used only while script, voice and pronunciation are unchanged', () => {
  const dir = tempProject();
  const p = loadProject(dir);
  record(dir, p.sourceHash);
  const fresh = loadProject(dir);
  assert.equal(fresh.timeline.sourceHash, p.sourceHash);
  assert.equal(fresh.voiceStale, false);

  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  script[0].text = 'Le 4 novembre, Entrée express change encore.';
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(script));
  const stale = loadProject(dir);
  assert.equal(stale.timeline, null);
  assert.equal(stale.voiceStale, true);
  assert.equal(stale.voiceFile, null);
});

test('sourceHash changes with voice settings and per-video pronunciation', () => {
  const script = [{ id: 'a', scene: 1, text: 'Un deux trois quatre.' }];
  const base = sourceHash(script, { voice: { name: 'fr-CA-ThierryNeural' } });
  assert.notEqual(base, sourceHash(script, { voice: { name: 'fr-CA-ThierryNeural', rate: '+6%' } }));
  assert.notEqual(base, sourceHash(script, { voice: { name: 'fr-CA-ThierryNeural' }, pron: { CRS: 'x' } }));
  assert.equal(base, sourceHash(script, { voice: { name: 'fr-CA-ThierryNeural' }, tags: { 1: ['ignored'] } }));
});
