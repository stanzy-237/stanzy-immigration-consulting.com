'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../engine/core.js');
const { parseHtml, classList, parseStyle } = require('./html.js');

const SFX = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'engine', 'sfx.json'), 'utf8')));
const ZONES = {
  // narrator layout: one mascot bottom-right, subtitles under the content
  solo: { left: 60, right: 900, top: 330, bottom: 1280, mascot: { left: 700, right: 920, top: 880, bottom: 1265 } },
  // debate layout: cards on top, cast row from y 990, subtitles at 1352
  debate: { left: 40, right: 1040, top: 230, bottom: 975, mascot: null },
  // debate scene with data-zone="wide": the cast has moved aside (cast.moves), content may run down to the subtitles
  wide: { left: 40, right: 1040, top: 230, bottom: 1335, mascot: null },
};
const LIMITS = {
  explainer: { words: [4, 12], duration: [45, 60] },
  dialogue: { words: [1, 14], duration: [45, 75] },
};
const URL_TEXT = 'stanzy-immigration-consulting.com';
const OVERLAY = ['confetti'];

function px(v) {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(String(v || '').trim());
  return m ? Number(m[1]) : null;
}

function validateProject(project) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const { script, config, scenesHtml } = project;
  const cfg = config || {};
  const cast = cfg.cast || null;
  const format = cast ? 'dialogue' : 'explainer';
  const limits = LIMITS[format];
  const [minWords, maxWords] = limits.words;
  const [minDur, maxDur] = cfg.duration || limits.duration;
  const zones = cast ? ZONES.debate : ZONES.solo;

  // ---------- script.json ----------
  if (!Array.isArray(script) || script.length === 0) {
    err('script.json doit être une liste non vide de phrases');
    return { errors, warnings, timeline: null };
  }
  if (script.length > 52) err(`script.json : ${script.length} phrases (52 maximum)`);
  let prevScene = 0;
  script.forEach((p, i) => {
    const want = Core.phraseId(i);
    const where = `script.json phrase ${i + 1} ("${p.id}")`;
    if (p.id !== want) err(`${where} : id attendu "${want}" (a…z puis aa…az, dans l'ordre, sans trou)`);
    if (!Number.isInteger(p.scene) || p.scene < 1) err(`${where} : "scene" doit être un entier ≥ 1`);
    else if (i === 0 && p.scene !== 1) err(`${where} : la première phrase doit être dans la scène 1`);
    else if (p.scene !== prevScene && p.scene !== prevScene + 1) err(`${where} : scène ${p.scene} après la scène ${prevScene} (pas de saut ni de retour en arrière)`);
    prevScene = p.scene;
    const n = Core.splitWords(p.text || '').length;
    if (n < minWords || n > maxWords) err(`${where} : ${n} mots — attendu ${minWords} à ${maxWords} (${format})`);
    if (cast) {
      if (!p.who || !cast[p.who]) err(`${where} : "who" doit être un personnage de config.cast (${Object.keys(cast).join(', ')})`);
      for (const [id, pose] of Object.entries(p.react || {})) {
        if (!cast[id]) err(`${where} : react.${id} — personnage inconnu`);
        if (!Core.POSES.includes(pose)) err(`${where} : react.${id} — pose "${pose}" inconnue`);
      }
    } else if (p.who) err(`${where} : "who" sans config.cast`);
    if (p.pose !== undefined && !Core.POSES.includes(p.pose)) err(`${where} : pose "${p.pose}" inconnue (${Core.POSES.join(', ')})`);
    if (p.cont) {
      const prev = script[i - 1];
      if (!prev || prev.who !== p.who || prev.scene !== p.scene) err(`${where} : "cont" doit suivre une phrase du même personnage dans la même scène`);
      if (p.tone) err(`${where} : "tone" interdit sur une phrase "cont" (même souffle que la précédente)`);
    }
    if (p.tone && (typeof p.tone !== 'object' || Object.keys(p.tone).some((k) => !['rate', 'pitch'].includes(k)))) {
      err(`${where} : "tone" accepte seulement {"rate": "+10%", "pitch": "+15Hz"}`);
    }
  });
  const scriptScenes = [...new Set(script.map((p) => p.scene))];

  // ---------- config.json ----------
  if (!cfg.title) warn('config.json : "title" manquant');
  if (!cast && (!cfg.voice || !cfg.voice.name)) warn('config.json : "voice.name" manquant (fr-CA-ThierryNeural, la voix de Stanzy, sera utilisée)');
  for (const [id, pose] of Object.entries(cfg.poses || {})) {
    if (!script.some((p) => p.id === id)) err(`config.json poses : phrase "${id}" inexistante`);
    if (!Core.POSES.includes(pose)) err(`config.json poses.${id} : pose "${pose}" inconnue (${Core.POSES.join(', ')})`);
  }
  for (const s of Object.keys(cfg.tags || {})) {
    if (!scriptScenes.includes(Number(s))) err(`config.json tags : scène ${s} inexistante`);
  }
  if (cfg.signature && (!Array.isArray(cfg.signature) || cfg.signature.length > 2)) err('config.json : "signature" doit être une liste de 2 lignes maximum');
  for (const k of Object.keys(cfg.pron || {})) {
    if (/\s/.test(k)) err(`config.json pron : "${k}" — une clé = un seul mot (sans espace)`);
  }
  if (cast) {
    for (const [id, c] of Object.entries(cast)) {
      const look = c.look || id;
      if (!Core.LOOKS.includes(look)) err(`config.json cast.${id} : look "${look}" inconnu (${Core.LOOKS.join(', ')})`);
      if (typeof c.x !== 'number' || c.x < 110 || c.x > 820) err(`config.json cast.${id} : "x" (centre du personnage) entre 110 et 820`);
      if (!c.voice || (!c.voice.name && !c.voice.recording)) err(`config.json cast.${id} : "voice.name" (edge-tts) ou "voice.recording" requis`);
      for (const mv of c.moves || []) {
        const [ref, to] = Array.isArray(mv) ? mv : [];
        if (!ref || !to || typeof to !== 'object') { err(`config.json cast.${id}.moves : chaque entrée est ["ref", {"x": 150, "s": 0.7}]`); continue; }
        if (to.x !== undefined && (typeof to.x !== 'number' || to.x < 60 || to.x > 1020)) err(`config.json cast.${id}.moves : "x" entre 60 et 1020`);
        if (to.s !== undefined && (typeof to.s !== 'number' || to.s < 0.3 || to.s > 1.5)) err(`config.json cast.${id}.moves : "s" entre 0.3 et 1.5`);
      }
      for (const [a, b, item] of c.hold || []) {
        if (!Core.PROPS.includes(item)) err(`config.json cast.${id}.hold : objet "${item}" inconnu (${Core.PROPS.join(', ')})`);
        if (!a || !b) err(`config.json cast.${id}.hold : ["début", "fin", "objet"]`);
      }
    }
  }
  for (const [ref, name] of cfg.sfx || []) {
    if (!SFX.includes(name)) err(`config.json sfx : effet "${name}" inconnu (voir engine/sfx.json)`);
    if (!ref) err('config.json sfx : chaque entrée est ["ref", "effet"]');
  }

  // ---------- timeline & duration ----------
  if (project.voiceStale) warn('voix périmée (script, voix ou prononciation modifiés) — relancer : npm run voice -- <slug>');
  const timeline = project.timeline || Core.estimateTimeline(script, cfg.pacing);
  const windows = Core.sceneWindows(timeline);
  const tryRef = (ref, label) => {
    try { Core.resolveRef(ref, timeline); } catch (e) { err(`${label} : ${e.message}`); }
  };
  if (cast) {
    for (const [id, c] of Object.entries(cast)) {
      if (c.in) tryRef(c.in, `config.json cast.${id}.in`);
      for (const [a, b] of c.freeze || []) { tryRef(a, `cast.${id}.freeze`); tryRef(b, `cast.${id}.freeze`); }
      for (const [a, b] of c.hold || []) { if (a) tryRef(a, `cast.${id}.hold`); if (b) tryRef(b, `cast.${id}.hold`); }
      for (const mv of c.moves || []) if (Array.isArray(mv) && mv[0]) tryRef(mv[0], `cast.${id}.moves`);
    }
  }
  for (const [ref] of cfg.sfx || []) if (ref) tryRef(ref, 'config.json sfx');
  for (const [a, b] of (cfg.music && cfg.music.mute) || []) { tryRef(a, 'music.mute'); tryRef(b, 'music.mute'); }
  for (const [a, b, gain] of (cfg.music && cfg.music.dip) || []) {
    tryRef(a, 'music.dip'); tryRef(b, 'music.dip');
    if (typeof gain !== 'number' || gain < 0 || gain > 1) err('config.json music.dip : ["début", "fin", gain entre 0 et 1]');
  }
  const d = timeline.duration;
  if (d < minDur || d > maxDur) {
    const msg = `Durée ${d.toFixed(1)} s${timeline.estimated ? ' (estimée)' : ''} — attendu ${minDur} à ${maxDur} s`;
    if (cfg.draft) warn(`${msg} (ignoré : "draft": true)`);
    else if (timeline.estimated) warn(`${msg} — à confirmer avec la vraie voix`);
    else err(msg);
  }

  // ---------- scenes.js ----------
  let elements;
  try {
    elements = parseHtml(scenesHtml);
  } catch (e) {
    err(`scenes.js : ${e.message}`);
    return { errors, warnings, timeline };
  }
  if (/\$\{/.test(scenesHtml)) err('scenes.js : pas d\'interpolation ${…} dans le gabarit');

  const sceneOf = (el) => {
    for (let p = el; p; p = p.parent) if (classList(p).includes('scene')) return p;
    return null;
  };
  const sceneEls = elements.filter((e) => classList(e).includes('scene'));
  const htmlScenes = [];
  for (const s of sceneEls) {
    const n = Number(s.attrs['data-scene']);
    if (s.depth !== 0) err(`scenes.js : la scène ${s.attrs['data-scene']} est imbriquée dans un autre élément`);
    if (!Number.isInteger(n)) { err('scenes.js : une .scene sans data-scene numérique'); continue; }
    if (htmlScenes.includes(n)) err(`scenes.js : scène ${n} définie deux fois`);
    htmlScenes.push(n);
  }
  const storyScenes = htmlScenes.filter((n) => n !== 0);
  for (const n of scriptScenes) if (!htmlScenes.includes(n)) err(`scenes.js : scène ${n} du script absente`);
  for (const n of storyScenes) if (!scriptScenes.includes(n)) err(`scenes.js : scène ${n} absente du script`);

  const perScene = {};
  for (const el of elements) {
    const scene = sceneOf(el);
    if (!scene || scene === el) continue;
    const n = Number(scene.attrs['data-scene']);
    const classes = classList(el);
    const tagDesc = `scène ${n} <${el.tag}${el.attrs.class ? ` class="${el.attrs.class}"` : ''}>`;

    const src = el.attrs.src || el.attrs.href || '';
    if (/^https?:/i.test(src) || /url\(\s*['"]?https?:/i.test(el.attrs.style || '')) err(`${tagDesc} : ressource externe interdite (CSS, SVG ou emoji uniquement)`);
    if (el.tag === 'img' && !/^data:/i.test(src)) err(`${tagDesc} : <img> interdit (utiliser CSS/SVG/emoji)`);
    if (el.attrs['data-sfx'] !== undefined && !SFX.includes(el.attrs['data-sfx'])) err(`${tagDesc} : data-sfx "${el.attrs['data-sfx']}" inconnu (voir engine/sfx.json)`);

    const hasIn = el.attrs['data-in'] !== undefined;
    const hasCls = el.attrs['data-cls'] !== undefined;
    if (!hasIn && !hasCls) continue;

    let spec;
    try {
      spec = Core.resolveSpec(Core.parseElementAttrs(el.attrs), n, timeline, windows);
    } catch (e) {
      err(`${tagDesc} : ${e.message}`);
      continue;
    }
    if (hasIn) {
      const ph = timeline.phrases.find((p) => p.id === Core.parseRef(el.attrs['data-in']).id);
      if (ph && n !== 0 && ph.scene !== n) err(`${tagDesc} : data-in="${el.attrs['data-in']}" vise la phrase "${ph.id}" de la scène ${ph.scene}`);
      if (spec.tOut <= spec.tIn) err(`${tagDesc} : sort (data-out) avant d'apparaître`);
    }

    let animatedAncestor = false;
    for (let p = el.parent; p && p !== scene; p = p.parent) if (p.attrs['data-in'] !== undefined) animatedAncestor = true;
    if (!hasIn || animatedAncestor) continue;

    perScene[n] = (perScene[n] || 0) + 1;
    const st = parseStyle(el.attrs.style);
    if (st.transform) err(`${tagDesc} : pas de "transform" sur un élément animé (utiliser data-r / data-kf)`);
    if (classes.some((c) => OVERLAY.includes(c))) continue;
    if (!cast && scene.attrs['data-zone'] === 'wide') warn(`scène ${n} : data-zone="wide" ignoré sans config.cast`);
    const z = cast && scene.attrs['data-zone'] === 'wide' ? ZONES.wide : zones;
    const box = { left: px(st.left), top: px(st.top), width: px(st.width), height: px(st.height) };
    const missing = Object.entries(box).filter(([, v]) => v === null).map(([k]) => k);
    if (missing.length) { err(`${tagDesc} : style doit définir ${missing.join(', ')} en px`); continue; }
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    if (box.left < z.left || right > z.right || box.top < z.top || bottom > z.bottom) {
      err(`${tagDesc} : hors zone sûre (x ${box.left}–${right}, y ${box.top}–${bottom} ; attendu x ${z.left}–${z.right}, y ${z.top}–${z.bottom})`);
    }
    const m = z.mascot;
    if (m && right > m.left && bottom > m.top) warn(`${tagDesc} : chevauche la mascotte (x > ${m.left}, y > ${m.top})`);
  }
  for (const n of storyScenes) {
    const c = perScene[n] || 0;
    if (c < 2 || c > 6) err(`scène ${n} : ${c} élément(s) animé(s) — attendu 2 à 6`);
  }
  if ((perScene[0] || 0) > 8) err(`scène 0 (calque permanent) : ${perScene[0]} éléments — 8 maximum`);

  // ---------- final scene: logo + URL + CTA ----------
  if (storyScenes.length) {
    const lastN = Math.max(...storyScenes);
    const last = sceneEls.find((s) => Number(s.attrs['data-scene']) === lastN);
    const inLast = elements.filter((e) => sceneOf(e) === last);
    const hasLogo = inLast.some((e) => classList(e).includes('logo'));
    const hasCta = inLast.some((e) => classList(e).includes('cta'));
    const nextScene = sceneEls.find((s) => s.index > last.index);
    const lastHtml = scenesHtml.slice(last.index, nextScene ? nextScene.index : undefined);
    const msgs = [];
    if (!hasLogo) msgs.push('le logo (.logo)');
    if (!hasCta) msgs.push("le bouton d'appel à l'action (.cta)");
    if (!lastHtml.includes(URL_TEXT)) msgs.push(`l'URL ${URL_TEXT}`);
    for (const what of msgs) {
      const text = `scène finale (${lastN}) : il manque ${what}`;
      if (cfg.cliffhanger) warn(`${text} (épisode à suivre : "cliffhanger": true)`);
      else err(text);
    }
  }

  return { errors, warnings, timeline };
}

module.exports = { validateProject, ZONES, LIMITS, SFX };
