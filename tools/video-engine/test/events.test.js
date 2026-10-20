'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../engine/core.js');
const { soundEvents, mixHash } = require('../lib/events.js');
const { loadProject, resolveProjectDir } = require('../lib/project.js');

const project = loadProject(resolveProjectDir('demo'));
const timeline = Core.estimateTimeline(project.script);

test('every entrance, chapter tag and checklist tick becomes a timed sound event', () => {
  const events = soundEvents(project, timeline);
  const sorted = [...events].sort((a, b) => a.t - b.t);
  assert.deepEqual(events, sorted);
  assert.equal(events.filter((e) => e.sfx === 'chime').length, 1, 'the CTA rings once');
  assert.equal(events.filter((e) => e.sfx === 'tick').length, 4, '3 checklist items + 1 timeline step');
  assert.ok(events.some((e) => e.a === 'stamp'));
  assert.equal(events.filter((e) => e.a === 'left').length, Object.keys(project.config.tags).length + 1);
});

test('mix hash follows scenes and music settings', () => {
  const base = mixHash(project);
  assert.equal(base, mixHash(project));
  assert.notEqual(base, mixHash({ ...project, scenesJs: project.scenesJs + ' ' }));
  assert.notEqual(base, mixHash({ ...project, config: { ...project.config, music: { mood: 'calm' } } }));
});
