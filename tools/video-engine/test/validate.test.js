'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProject } = require('../lib/validate.js');
const { loadProject, resolveProjectDir } = require('../lib/project.js');

const box = (top) => `style="left:70px;top:${top}px;width:500px;height:120px"`;

function project(over = {}) {
  return Object.assign({
    script: [
      { id: 'a', scene: 1, text: 'Voici Stanzy votre conseiller en immigration.' },
      { id: 'b', scene: 1, text: 'Il vous aide pas à pas.' },
      { id: 'c', scene: 2, text: 'Écrivez-nous dès aujourd hui sur WhatsApp.' },
    ],
    config: { title: 'Test', draft: true, voice: { name: 'fr-CA-ThierryNeural' }, poses: { a: 'wave' }, tags: { 1: ['Le problème'] } },
    scenesHtml: `
      <div class="scene" data-scene="1">
        <div class="card" data-in="a@1" data-a="drop" ${box(360)}>Un</div>
        <div class="chip" data-in="b" ${box(520)}>Deux</div>
      </div>
      <div class="scene" data-scene="2">
        <div class="logo" data-in="c" ${box(360)}></div>
        <div class="cta" data-in="c@2" ${box(520)}>WhatsApp</div>
        <div class="url" data-in="c@4" ${box(680)}>www.stanzy-immigration-consulting.com</div>
      </div>`,
  }, over);
}

const errorsOf = (p) => validateProject(p).errors;
const has = (errs, re) => assert.ok(errs.some((e) => re.test(e)), `attendu ${re}, obtenu :\n${errs.join('\n')}`);

test('a well-formed project has no errors', () => {
  assert.deepEqual(errorsOf(project()), []);
});

test('the bundled demo example passes', () => {
  assert.deepEqual(errorsOf(loadProject(resolveProjectDir('demo'))), []);
});

test('script rules: ordered ids, scene order, 4–12 words', () => {
  const p = project();
  p.script = [
    { id: 'a', scene: 1, text: 'Trop court.' },
    { id: 'c', scene: 3, text: 'Une phrase correcte de six mots.' },
  ];
  const errs = errorsOf(p);
  has(errs, /attendu 4 à 12/);
  has(errs, /attendu "b"/);
  has(errs, /scène 3 après la scène 1/);
});

test('duration outside 45–60 s: error on the real voice, warning on the estimate or a draft', () => {
  const p = project();
  p.config = Object.assign({}, p.config, { draft: false });
  assert.ok(validateProject(p).warnings.some((w) => /Durée.*à confirmer/.test(w)));
  const Core = require('../engine/core.js');
  p.timeline = Object.assign(Core.estimateTimeline(p.script), { estimated: false });
  has(errorsOf(p), /Durée/);
  assert.ok(validateProject(project()).warnings.some((w) => /Durée/.test(w)));
});

test('config: unknown pose, unknown phrase, unknown scene tag', () => {
  const p = project();
  p.config = Object.assign({}, p.config, { poses: { a: 'dance', z: 'idle' }, tags: { 9: ['X'] } });
  const errs = errorsOf(p);
  has(errs, /pose "dance" inconnue/);
  has(errs, /phrase "z" inexistante/);
  has(errs, /scène 9 inexistante/);
});

test('scenes: unresolved refs, cross-scene data-in, transform, safe zone, element count', () => {
  const p = project({
    scenesHtml: `
      <div class="scene" data-scene="1">
        <div data-in="a@40" ${box(360)}>x</div>
        <div data-in="c" ${box(520)}>y</div>
        <div data-in="b" style="left:70px;top:600px;width:500px;height:120px;transform:rotate(3deg)">z</div>
        <div data-in="b@2" style="left:20px;top:700px;width:950px;height:120px">w</div>
      </div>
      <div class="scene" data-scene="2">
        <div class="logo cta" data-in="c" ${box(360)}>www.stanzy-immigration-consulting.com</div>
      </div>`,
  });
  const errs = errorsOf(p);
  has(errs, /n'existe pas/);
  has(errs, /vise la phrase "c" de la scène 2/);
  has(errs, /pas de "transform"/);
  has(errs, /hors zone sûre/);
  has(errs, /scène 2 : 1 élément\(s\) animé\(s\)/);
});

test('scenes: missing position, external image, unbalanced HTML', () => {
  const p = project();
  p.scenesHtml = p.scenesHtml.replace(`data-a="drop" ${box(360)}`, 'data-a="drop"')
    .replace('>Deux<', '><img src="https://x.test/a.png">Deux<');
  const errs = errorsOf(p);
  has(errs, /style doit définir left, top, width, height/);
  has(errs, /<img> interdit/);
  has(errorsOf(project({ scenesHtml: '<div class="scene" data-scene="1"><div>' })), /HTML déséquilibré/);
});

test('final scene must carry logo, CTA and URL', () => {
  const p = project();
  p.scenesHtml = p.scenesHtml.replace('class="cta"', 'class="chip"').replace('www.stanzy-immigration-consulting.com', 'ailleurs');
  const errs = errorsOf(p);
  has(errs, /bouton d'appel à l'action/);
  has(errs, /il manque l'URL/);
});

function dialogue(over = {}) {
  const cast = {
    awa: { look: 'awa', x: 190, voice: { name: 'fr-FR-DeniseNeural' } },
    stanzy: { look: 'stanzy', x: 495, voice: { name: 'fr-CA-ThierryNeural' }, in: 'b' },
  };
  return project(Object.assign({
    script: [
      { id: 'a', scene: 1, who: 'awa', text: 'Ekié !' },
      { id: 'b', scene: 1, who: 'stanzy', text: 'Bonjour la famille.', react: { awa: 'both' } },
      { id: 'c', scene: 2, who: 'stanzy', text: 'Écrivez-nous dès aujourd hui sur WhatsApp.' },
    ],
    config: { title: 'Débat', draft: true, cast, sfx: [['a', 'dun']], music: { mood: 'afro', mute: [['b', 'b$']] } },
  }, over));
}

test('dialogue: short lines allowed, cast checked, persistent scene 0 allowed', () => {
  const p = dialogue();
  p.scenesHtml = '<div class="scene" data-scene="0"><div class="pill" data-in="c" style="left:60px;top:892px;width:300px;height:72px">x</div></div>'
    + p.scenesHtml.replace('style="left:70px;top:520px', 'data-sfx="notif" style="left:70px;top:520px');
  assert.deepEqual(errorsOf(p), []);
});

test('dialogue: unknown speaker, broken cont, bad reaction, unknown sound', () => {
  const p = dialogue();
  p.script = [
    { id: 'a', scene: 1, who: 'paul', text: 'Ekié !' },
    { id: 'b', scene: 1, who: 'stanzy', cont: true, text: 'Bonjour la famille.', react: { awa: 'dance' } },
    { id: 'c', scene: 2, who: 'stanzy', text: 'Écrivez-nous dès aujourd hui sur WhatsApp.' },
  ];
  p.config = Object.assign({}, p.config, { sfx: [['a', 'explosion']] });
  const errs = errorsOf(p);
  has(errs, /"who" doit être un personnage/);
  has(errs, /"cont" doit suivre une phrase du même personnage/);
  has(errs, /pose "dance" inconnue/);
  has(errs, /effet "explosion" inconnu/);
});

test('dialogue: cast position and voice are required', () => {
  const p = dialogue();
  p.config = Object.assign({}, p.config, { cast: { awa: { look: 'awa', x: 1000 }, stanzy: { look: 'robot', x: 495, voice: { name: 'x' } } } });
  const errs = errorsOf(p);
  has(errs, /cast.awa : "x"/);
  has(errs, /cast.awa : "voice.name"/);
  has(errs, /look "robot" inconnu/);
});
