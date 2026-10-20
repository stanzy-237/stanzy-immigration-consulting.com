'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../engine/core.js');
const { loadProject, resolveProjectDir } = require('../lib/project.js');
const { parseHtml } = require('../lib/html.js');

const script = [
  { id: 'a', scene: 1, text: 'Voici Stanzy votre conseiller en immigration.' },
  { id: 'b', scene: 1, text: 'Il vous aide pas à pas.' },
  { id: 'c', scene: 2, text: 'Écrivez-nous dès aujourd hui sur WhatsApp.' },
];
const timeline = Core.estimateTimeline(script);

test('parseRef reads phrase, word index, end marker and offset', () => {
  assert.deepEqual(Core.parseRef('b'), { id: 'b', word: null, end: false, offset: 0 });
  assert.deepEqual(Core.parseRef('b@3'), { id: 'b', word: 3, end: false, offset: 0 });
  assert.deepEqual(Core.parseRef('b$'), { id: 'b', word: null, end: true, offset: 0 });
  assert.deepEqual(Core.parseRef('b@3+0.2'), { id: 'b', word: 3, end: false, offset: 0.2 });
  assert.deepEqual(Core.parseRef('c$-0.5'), { id: 'c', word: null, end: true, offset: -0.5 });
  assert.deepEqual(Core.parseRef('ab@2'), { id: 'ab', word: 2, end: false, offset: 0 });
  for (const bad of ['B', 'b@', 'b@x', 'ba', 'abc', '', 'b+']) assert.throws(() => Core.parseRef(bad), /invalide/);
});

test('resolveRef maps references onto the timeline', () => {
  const b = timeline.phrases[1];
  assert.equal(Core.resolveRef('b', timeline), b.start);
  assert.equal(Core.resolveRef('b@3', timeline), b.words[3].start);
  assert.equal(Core.resolveRef('b$', timeline), b.end);
  assert.equal(Core.resolveRef('b@3+0.2', timeline), b.words[3].start + 0.2);
  assert.throws(() => Core.resolveRef('z', timeline), /introuvable/);
  assert.throws(() => Core.resolveRef('b@40', timeline), /n'existe pas/);
});

test('estimateTimeline speaks at ~2.6 words/s with ordered, contiguous words', () => {
  for (const p of timeline.phrases) {
    const n = Core.splitWords(p.text).length;
    assert.equal(p.words.length, n);
    assert.ok(Math.abs((p.end - p.start) - n / 2.6) < 0.01);
    for (let i = 1; i < p.words.length; i++) assert.equal(p.words[i].start, p.words[i - 1].end);
  }
  const [a, b, c] = timeline.phrases;
  assert.ok(b.start - a.end < c.start - b.end, 'a scene change adds extra silence');
  assert.ok(timeline.duration > c.end);
});

test('sceneWindows chains scenes without gaps', () => {
  const w = Core.sceneWindows(timeline);
  assert.equal(w[1].start, 0);
  assert.equal(w[1].end, w[2].start);
  assert.equal(w[2].end, timeline.duration);
});

function el(attrs, scene = 1) {
  return Core.resolveSpec(Core.parseElementAttrs(attrs), scene, timeline, Core.sceneWindows(timeline));
}

test('stateAt: hidden before entrance, settled after, gone at scene end', () => {
  const e = el({ 'data-in': 'a@2', 'data-a': 'pop' });
  assert.equal(Core.stateAt(e, e.tIn - 0.01).visible, false);
  const mid = Core.stateAt(e, e.tIn + 0.1);
  assert.ok(mid.visible && mid.o < 1 && mid.s < 1);
  const settled = Core.stateAt(e, e.tIn + 1);
  assert.equal(settled.o, 1);
  assert.ok(Math.abs(settled.s - 1) < 1e-9);
  assert.equal(Core.stateAt(e, e.tOut).visible, false);
});

test('stateAt: keyframes, counter, draw and timed classes', () => {
  const e = el({ 'data-in': 'a', 'data-count': '150', 'data-draw': '', 'data-kf': '[["b",{"x":-300,"s":0.5}]]', 'data-cls': 'b@1:on' });
  const late = Core.stateAt(e, Core.resolveRef('b', timeline) + 1);
  assert.ok(Math.abs(late.x + 300) < 1e-6);
  assert.ok(Math.abs(late.s - 0.5) < 1e-6);
  assert.equal(late.count, 150);
  assert.equal(late.draw, 1);
  assert.deepEqual(late.classes, ['on']);
  assert.deepEqual(Core.stateAt(e, e.tIn).classes, []);
});

test('parseElementAttrs rejects unknown animations and malformed DSL', () => {
  assert.throws(() => Core.parseElementAttrs({ 'data-in': 'a', 'data-a': 'spin' }), /data-a inconnu/);
  assert.throws(() => Core.parseElementAttrs({ 'data-in': 'a', 'data-kf': '[oops' }), /JSON/);
  assert.throws(() => Core.parseElementAttrs({ 'data-in': 'a', 'data-cls': 'on' }), /ref:classe/);
  assert.throws(() => Core.parseElementAttrs({ 'data-in': 'a', 'data-count': 'beaucoup' }), /nombre/);
});

test('phrase ids run a…z then aa…az', () => {
  assert.equal(Core.phraseId(0), 'a');
  assert.equal(Core.phraseId(25), 'z');
  assert.equal(Core.phraseId(26), 'aa');
  assert.equal(Core.phraseId(51), 'az');
});

test('estimateTimeline: cont shares the breath, pause adds silence, scene 0 spans the video', () => {
  const s = [
    { id: 'a', scene: 1, text: 'Un deux trois quatre.' },
    { id: 'b', scene: 1, cont: true, text: 'Cinq six sept huit.' },
    { id: 'c', scene: 1, pause: 1, text: 'Neuf dix onze douze.' },
  ];
  const t = Core.estimateTimeline(s, { gap: 0.3 });
  assert.ok(Math.abs(t.phrases[1].start - t.phrases[0].end) < 1e-9);
  assert.ok(Math.abs(t.phrases[2].start - t.phrases[1].end - 1.3) < 1e-6);
  assert.deepEqual(Core.sceneWindows(t)[0], { start: 0, end: t.duration, firstPhraseStart: 0 });
});

test('formatNumberFr groups thousands with a narrow space', () => {
  assert.equal(Core.formatNumberFr(55500), '55 500');
  assert.equal(Core.formatNumberFr(435), '435');
});

test('determinism: every element state of the demo is identical across two passes', () => {
  const project = loadProject(resolveProjectDir('demo'));
  const tl = Core.estimateTimeline(project.script);
  const windows = Core.sceneWindows(tl);
  const specs = [];
  for (const node of parseHtml(project.scenesHtml)) {
    let scene = null;
    for (let p = node.parent; p; p = p.parent) if (p.attrs['data-scene']) scene = Number(p.attrs['data-scene']);
    if (scene && (node.attrs['data-in'] !== undefined || node.attrs['data-cls'] !== undefined)) {
      specs.push(Core.resolveSpec(Core.parseElementAttrs(node.attrs), scene, tl, windows));
    }
  }
  const frames = () => {
    const out = [];
    for (let f = 0; f < tl.duration * 30; f += 7) out.push(specs.map((s) => Core.stateAt(s, f / 30)));
    return JSON.stringify(out);
  };
  assert.equal(frames(), frames());
});
