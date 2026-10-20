'use strict';
// Sound plan: on-screen events that get a sound effect, explicit cues, music mute ranges.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../engine/core.js');
const { parseHtml, classList } = require('./html.js');
const { ENGINE_ROOT } = require('./project.js');

function soundEvents(project, timeline) {
  const windows = Core.sceneWindows(timeline);
  const events = [];
  for (const el of parseHtml(project.scenesHtml)) {
    let scene = null;
    for (let p = el.parent; p; p = p.parent) if (p.attrs['data-scene'] !== undefined) scene = Number(p.attrs['data-scene']);
    if (scene === null) continue;
    const classes = classList(el);
    if (el.attrs['data-in'] !== undefined) {
      const spec = Core.resolveSpec(Core.parseElementAttrs(el.attrs), scene, timeline, windows);
      const sfx = el.attrs['data-sfx'] || (classes.includes('cta') ? 'chime' : undefined);
      events.push(sfx ? { t: spec.tIn, a: spec.a, sfx } : { t: spec.tIn, a: spec.a });
    }
    for (const c of Core.parseElementAttrs(Object.assign({}, el.attrs, { 'data-a': 'pop' })).cls) {
      if (c.cls === 'on') events.push({ t: Core.resolveRef(c.ref, timeline), sfx: 'tick' });
    }
  }
  const cfg = project.config || {};
  for (const s of Object.keys(cfg.tags || {})) {
    const first = timeline.phrases.find((p) => p.scene === Number(s));
    if (first) events.push({ t: first.start, a: 'left' });
  }
  for (const [ref, name] of cfg.sfx || []) events.push({ t: Core.resolveRef(ref, timeline), sfx: name });
  return events.sort((a, b) => a.t - b.t);
}

function soundPlan(project, timeline) {
  const mute = Core.resolveRanges(project.config.music && project.config.music.mute, timeline);
  return { events: soundEvents(project, timeline), mute };
}

// Everything the mix depends on beyond the voice.
function mixHash(project) {
  const h = crypto.createHash('sha1');
  h.update(project.sourceHash);
  h.update(project.scenesJs);
  const c = project.config;
  h.update(JSON.stringify({ music: c.music || null, tags: c.tags || null, sfx: c.sfx || null }));
  h.update(fs.readFileSync(path.join(ENGINE_ROOT, 'python', 'music.py')));
  h.update(fs.readFileSync(path.join(ENGINE_ROOT, 'engine', 'sfx.json')));
  return h.digest('hex').slice(0, 16);
}

module.exports = { soundEvents, soundPlan, mixHash };
