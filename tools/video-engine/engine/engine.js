// Browser renderer: render(t) draws the exact frame at time t (deterministic, no clock).
(function () {
  'use strict';
  const Core = window.StanzyCore;
  const Mascot = window.StanzyMascot;

  const DEFAULT_TAG_COLORS = ['#0d1f4e', '#ffffff'];
  const DEFAULT_SIGNATURE = [
    'WWW.STANZY-IMMIGRATION-CONSULTING.COM',
    '+237 679 306 015 · @STANZYCANADA',
  ];
  const CAST = { top: 990, w: 190, h: 333 };
  const LEAF = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2 L13.6 6.2 L16.2 5.2 L15.2 10 L19.2 8.2 L18.2 11.2 L21.5 12.2 L17.4 15.2 L18.4 17.4 L13.1 16.4 L12.7 21.5 L11.3 21.5 L10.9 16.4 L5.6 17.4 L6.6 15.2 L2.5 12.2 L5.8 11.2 L4.8 8.2 L8.8 10 L7.8 5.2 L10.4 6.2 Z" fill="#fff"/></svg>';
  const CONFETTI_COLORS = ['#cc1627', '#ffffff', '#0d1f4e', '#ee8a93', '#2f855a', '#f2b705'];

  let model = null;

  function attrsOf(el) {
    const a = {};
    for (const at of el.attributes) a[at.name] = at.value;
    return a;
  }

  // Deterministic pseudo-random in [0, 1) for confetti pieces.
  function rnd(i, salt) {
    const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function init() {
    if (model) return model;
    const P = window.__PROJECT;
    const cfg = P.config || {};
    const timeline = P.timeline;
    const windows = Core.sceneWindows(timeline);
    const stage = document.getElementById('stage');
    if (cfg.theme) stage.classList.add(`theme-${cfg.theme}`);
    if (cfg.cast) stage.classList.add('layout-debate');

    for (const logo of document.querySelectorAll('#scenes .logo')) logo.innerHTML = P.logoSVG || '';
    for (const av of document.querySelectorAll('#scenes .avatar')) {
      av.innerHTML = Mascot.mascotSVG('idle', 0, false, null, 1, { look: av.dataset.look || 'stanzy' })
        .replace('viewBox="0 0 240 420"', 'viewBox="58 14 124 124"');
    }

    const scenes = [];
    for (const sceneEl of document.querySelectorAll('#scenes .scene')) {
      const n = Number(sceneEl.dataset.scene);
      const items = [];
      for (const el of sceneEl.querySelectorAll('[data-in], [data-cls]')) {
        const spec = Core.resolveSpec(Core.parseElementAttrs(attrsOf(el)), n, timeline, windows);
        const target = el.querySelector('.n') || el;
        const paths = spec.draw ? Array.from(el.querySelectorAll('path, line, polyline, circle, rect')) : [];
        for (const p of paths) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; }
        let confetti = null;
        if (el.classList.contains('confetti')) {
          confetti = [];
          for (let i = 0; i < 90; i++) {
            const piece = document.createElement('i');
            piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
            if (i % 3 === 0) piece.style.borderRadius = '50%';
            el.appendChild(piece);
            confetti.push(piece);
          }
        }
        items.push({
          el, spec, paths, confetti, countTarget: spec.count !== null ? target : null,
          pre: el.dataset.pre || '', suf: el.dataset.suf || '', baseClasses: el.className,
        });
      }
      scenes.push({ n, el: sceneEl, win: windows[n], items });
    }

    // chapter tags: one per scene, entering on the scene's first phrase
    const tags = cfg.tags || {};
    for (const s of scenes) {
      const tag = tags[String(s.n)];
      if (!tag) continue;
      const [text, bg, fg] = Array.isArray(tag) ? tag : [tag];
      const div = document.createElement('div');
      div.className = 'chapter';
      div.textContent = text;
      div.style.background = bg || DEFAULT_TAG_COLORS[0];
      div.style.color = fg || DEFAULT_TAG_COLORS[1];
      const first = timeline.phrases.find((p) => p.scene === s.n);
      div.setAttribute('data-in', first.id);
      div.setAttribute('data-a', 'left');
      s.el.appendChild(div);
      const spec = Core.resolveSpec(Core.parseElementAttrs({ 'data-in': first.id, 'data-a': 'left' }), s.n, timeline, windows);
      s.items.push({ el: div, spec, paths: [], countTarget: null, pre: '', suf: '', baseClasses: 'chapter' });
    }

    const sig = document.getElementById('signature');
    if (cfg.theme === 'passport') {
      sig.className = 'mrz';
      const mrz = cfg.mrz || ['P<CANENTREEEXPRESS<<FRANCOPHONES<<<<<<<<<<<<', 'STANZY<IMMIGRATION<<+237679306015<<<<<<<<<<'];
      sig.innerHTML = mrz.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
      document.getElementById('doodles').innerHTML = guilloche();
    } else {
      sig.innerHTML = (cfg.signature || DEFAULT_SIGNATURE).map((l) => `<div>${escapeHtml(l)}</div>`).join('');
      document.getElementById('doodles').innerHTML = doodles();
    }

    const lines = {};
    for (const l of P.script) lines[l.id] = l;
    const cast = [];
    if (cfg.cast) {
      document.getElementById('mascot').style.display = 'none';
      const host = document.getElementById('cast');
      for (const [id, c] of Object.entries(cfg.cast)) {
        const div = document.createElement('div');
        div.className = 'char';
        div.style.left = `${c.x - CAST.w / 2}px`;
        div.style.top = `${CAST.top}px`;
        host.appendChild(div);
        cast.push({
          id, c, el: div, key: '',
          tIn: c.in ? Core.resolveRef(c.in, timeline) : null,
          freeze: Core.resolveRanges(c.freeze, timeline),
          hold: (c.hold || []).map(([a, b, item]) => ({ from: Core.resolveRef(a, timeline), to: Core.resolveRef(b, timeline), item })),
        });
      }
    }

    model = { timeline, scenes, cfg, lines, cast, poses: cfg.poses || {}, subsKey: '', stage };
    return model;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function doodles() {
    const marks = [
      [60, 150, 'M0 10 Q10 0 20 10 T40 10'], [930, 210, 'M0 0 L14 14 M8 -4 L24 8'],
      [980, 760, 'M0 10 Q10 0 20 10 T40 10'], [40, 1180, 'M0 0 L18 6 M0 14 L18 20'],
      [500, 1540, 'M0 10 Q10 0 20 10 T40 10'], [880, 1620, 'M0 0 Q8 12 16 0 T32 0'],
      [150, 1650, 'M0 6 L30 6'], [990, 1180, 'M0 0 L10 18'],
    ];
    return marks.map(([x, y, d]) =>
      `<path transform="translate(${x} ${y})" d="${d}" fill="none" stroke="rgba(13,31,78,0.32)" stroke-width="4" stroke-linecap="round"/>`
    ).join('');
  }

  // Passport paper: wavy security lines + a central guilloche rosette.
  function guilloche() {
    let s = '';
    for (let y = 40; y < 1920; y += 54) {
      let d = `M0 ${y}`;
      for (let x = 0; x <= 1080; x += 20) d += ` L${x} ${(y + 9 * Math.sin(x / 70 + y / 90)).toFixed(1)}`;
      s += `<path d="${d}" fill="none" stroke="rgba(13,31,78,0.055)" stroke-width="2"/>`;
    }
    const cx = 540, cy = 930, R = 260, r = 47, dd = 120;
    let d = '';
    for (let i = 0; i <= 2400; i++) {
      const th = (i / 2400) * Math.PI * 2 * 47;
      const x = cx + (R - r) * Math.cos(th) + dd * Math.cos(((R - r) / r) * th);
      const y = cy + (R - r) * Math.sin(th) - dd * Math.sin(((R - r) / r) * th);
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    s += `<path d="${d}" fill="none" stroke="rgba(13,31,78,0.07)" stroke-width="1.4"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="120" fill="rgba(253,250,242,0.9)"/>`;
    return s;
  }

  function render(t) {
    if (!model) init();
    for (const s of model.scenes) {
      const on = t >= s.win.start && t < s.win.end + Core.EXIT;
      s.el.style.display = on ? 'block' : 'none';
      if (!on) continue;
      for (const it of s.items) apply(it, Core.stateAt(it.spec, t), t);
    }
    renderSubs(t);
    if (model.cast.length) renderCast(t);
    else renderMascot(t);
  }

  function apply(it, st, t) {
    const el = it.el;
    if (it.spec.animated) {
      // '' (not 'visible') so a child never shows while its animated parent is hidden
      el.style.visibility = st.visible ? '' : 'hidden';
      el.style.opacity = st.o.toFixed(4);
      const sx = st.s * st.sx;
      el.style.transform = it.confetti ? 'none'
        : `translate(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px) rotate(${st.r.toFixed(3)}deg) scale(${sx.toFixed(4)}, ${st.s.toFixed(4)})`;
    }
    const cls = st.classes.join(' ');
    const want = cls ? `${it.baseClasses} ${cls}` : it.baseClasses;
    if (el.className !== want) el.className = want;
    if (it.countTarget && st.count !== null) it.countTarget.textContent = it.pre + Core.formatNumberFr(st.count) + it.suf;
    for (const p of it.paths) p.style.strokeDashoffset = (1 - st.draw).toFixed(4);
    if (it.confetti && st.visible) {
      const age = t - it.spec.tIn;
      it.confetti.forEach((piece, i) => {
        const x = 40 + rnd(i, 1) * 1000 + 60 * Math.sin(age * (1.5 + rnd(i, 2) * 2) + i);
        const y = -60 - rnd(i, 3) * 400 + age * (380 + rnd(i, 4) * 320);
        const rot = age * (200 + rnd(i, 5) * 500) * (i % 2 ? 1 : -1);
        piece.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
      });
    }
  }

  function renderSubs(t) {
    const box = document.getElementById('subs');
    const ph = Core.activePhrase(model.timeline, t);
    if (!ph) { if (model.subsKey) { box.innerHTML = ''; model.subsKey = ''; } return; }
    let html = '';
    let key = ph.id;
    ph.words.forEach((w, i) => {
      const c = t >= w.end ? 'past' : t >= w.start ? 'now' : '';
      key += c[0] || '-';
      html += `<span class="w ${c}">${escapeHtml(w.w)}</span>${i < ph.words.length - 1 ? ' ' : ''}`;
    });
    if (key !== model.subsKey) {
      const who = ph.who && model.cfg.cast ? model.cfg.cast[ph.who] : null;
      const tab = who ? `<div class="slash" style="background:${who.color || '#cc1627'}">${LEAF}</div>` : '<div class="slash">/</div>';
      const name = who && who.name ? `<div class="who" style="color:${who.color || '#cc1627'}">${escapeHtml(who.name)}</div>` : '';
      box.innerHTML = `<div class="box">${tab}<div class="words">${name}${html}</div></div>`;
      model.subsKey = key;
    }
    const p = Math.min(1, Math.max(0, (t - ph.start + 0.12) / 0.2));
    box.style.opacity = p.toFixed(3);
    box.style.transform = `translateY(${(12 * (1 - p)).toFixed(2)}px)`;
  }

  function renderMascot(t) {
    const host = document.getElementById('mascot');
    const ph = Core.activePhrase(model.timeline, t);
    const poseOf = (p) => (p && model.poses[p.id]) || 'idle';
    const pose = poseOf(ph);
    const idx = ph ? model.timeline.phrases.indexOf(ph) : -1;
    const prevPose = idx > 0 ? poseOf(model.timeline.phrases[idx - 1]) : 'idle';
    const k = ph ? (t - ph.start + 0.15) / 0.3 : 1;
    const talking = !!(ph && ph.words.some((w) => t >= w.start && t < w.end));
    host.innerHTML = Mascot.mascotSVG(pose, t, talking, prevPose, k);
    const enter = Core.easeOutBack(Math.min(1, Math.max(0, t / 0.6)));
    const bob = 4 * Math.sin(2 * Math.PI * 0.6 * t);
    host.style.transformOrigin = '50% 100%';
    host.style.transform = `translateY(${bob.toFixed(2)}px) scale(${Math.max(0, enter).toFixed(4)})`;
  }

  // Dialogue: every cast member reacts to the current line; the speaker talks.
  function renderCast(t) {
    const phrases = model.timeline.phrases;
    const ph = Core.activePhrase(model.timeline, t);
    const idx = ph ? phrases.indexOf(ph) : -1;
    const prev = idx > 0 ? phrases[idx - 1] : null;
    const k = ph ? (t - ph.start + 0.15) / 0.3 : 1;
    const speaker = ph ? ph.who : null;
    const speakerX = speaker && model.cfg.cast[speaker] ? model.cfg.cast[speaker].x : null;
    const poseFor = (p, id) => {
      if (!p) return 'idle';
      const line = model.lines[p.id] || {};
      if (line.who === id) return line.pose || 'idle';
      return (line.react && line.react[id]) || 'idle';
    };
    model.cast.forEach((m, i) => {
      if (m.tIn !== null && t < m.tIn - 0.9) { m.el.style.visibility = 'hidden'; return; }
      m.el.style.visibility = 'visible';
      const fr = m.freeze.find((r) => t >= r.from && t < r.to);
      const tt = fr ? fr.from : t;
      const isSpeaker = speaker === m.id;
      const talking = !fr && isSpeaker && ph.words.some((w) => t >= w.start && t < w.end);
      const hold = m.hold.find((r) => tt >= r.from && tt < r.to);
      const gaze = !isSpeaker && speakerX !== null ? [Math.sign(speakerX - m.c.x) * 2.5, 0] : null;
      m.el.innerHTML = Mascot.mascotSVG(poseFor(ph, m.id), tt, talking, poseFor(prev, m.id), Math.min(1, k), {
        look: m.c.look || m.id, hold: hold ? hold.item : null, gaze,
      });
      let dx = 0;
      if (m.tIn !== null) {
        const q = Core.easeOutCubic(Math.min(1, Math.max(0, (t - (m.tIn - 0.9)) / 0.9)));
        dx = (1 - q) * (m.c.from === 'right' ? 1080 - m.c.x + CAST.w : -(m.c.x + CAST.w));
      }
      const bob = fr ? 0 : 3 * Math.sin(2 * Math.PI * 0.6 * t + i * 1.7);
      const lift = isSpeaker && !fr ? Core.easeOutCubic(Math.min(1, Math.max(0, (t - ph.start + 0.2) / 0.25))) : 0;
      m.el.style.transform = `translate(${dx.toFixed(1)}px, ${(bob - 6 * lift).toFixed(2)}px) scale(${(1 + 0.05 * lift).toFixed(4)})`;
      m.el.style.filter = fr ? 'grayscale(0.85) contrast(0.9)' : 'none';
    });
  }

  function entrances() {
    if (!model) init();
    const out = [];
    for (const s of model.scenes) for (const it of s.items) if (it.spec.animated) out.push({ t: it.spec.tIn, a: it.spec.a, scene: s.n });
    return out.sort((a, b) => a.t - b.t);
  }

  window.StanzyEngine = { init, render, entrances, get duration() { return window.__PROJECT.timeline.duration; } };
  window.render = render;
})();
