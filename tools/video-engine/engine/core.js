// Pure engine logic shared by the browser renderer and the Node CLI/tests.
// Everything here is a function of its inputs only: no DOM, no clock, no randomness.
(function (root) {
  'use strict';

  const ANIMATIONS = ['pop', 'drop', 'up', 'stamp', 'left', 'fade', 'grow'];
  const POSES = ['idle', 'wave', 'point', 'head', 'shrug', 'thumbs', 'think', 'both', 'hold'];
  const LOOKS = ['stanzy', 'awa', 'junior'];
  const PROPS = ['phone', 'beignet'];
  const ENTER = 0.5;
  const ENTER_STAMP = 0.3;
  const EXIT = 0.3;
  const KF_DURATION = 0.6;

  // ---------- easing ----------
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutBack = (p) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  };

  // ---------- phrase ids: a … z, then aa … az (52 max) ----------
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  function phraseId(i) {
    return i < 26 ? LETTERS[i] : 'a' + LETTERS[i - 26];
  }

  // ---------- time references: "b", "b@3", "b$", "b@3+0.2", "c$-0.1", "ab@2" ----------
  const REF_RE = /^([a-z]|a[a-z])(?:@(\d+)|(\$))?([+-]\d+(?:\.\d+)?)?$/;

  function parseRef(str) {
    const m = REF_RE.exec(String(str).trim());
    if (!m) throw new Error(`Référence de temps invalide : "${str}"`);
    return {
      id: m[1],
      word: m[2] !== undefined ? Number(m[2]) : null,
      end: m[3] === '$',
      offset: m[4] ? Number(m[4]) : 0,
    };
  }

  function phraseById(timeline, id) {
    return timeline.phrases.find((p) => p.id === id);
  }

  function resolveRef(str, timeline) {
    const ref = parseRef(str);
    const phrase = phraseById(timeline, ref.id);
    if (!phrase) throw new Error(`Phrase "${ref.id}" introuvable (référence "${str}")`);
    let t;
    if (ref.end) t = phrase.end;
    else if (ref.word !== null) {
      const w = phrase.words[ref.word];
      if (!w) throw new Error(`Le mot ${ref.word} n'existe pas dans la phrase "${ref.id}" (${phrase.words.length} mots, index à partir de 0) — "${str}"`);
      t = w.start;
    } else t = phrase.start;
    return t + ref.offset;
  }

  // ---------- silent timeline (used until real TTS word timings exist) ----------
  // Regular whitespace only: a no-break space keeps "55 500" as one word. Mirrored in python/pron_fr.py.
  function splitWords(text) {
    return String(text).split(/[ \t\r\n]+/).filter(Boolean);
  }

  function estimateTimeline(script, opts) {
    const o = Object.assign({ wps: 2.6, lead: 0.6, gap: 0.3, sceneGap: 0.5, tail: 2.5 }, opts || {});
    let t = o.lead;
    let prevScene = null;
    const phrases = script.map((p) => {
      if (prevScene !== null && p.scene !== prevScene) t += o.sceneGap;
      if (p.cont) t -= o.gap;
      t += Number(p.pause || 0);
      prevScene = p.scene;
      const words = splitWords(p.text);
      const total = words.length / o.wps;
      const weights = words.map((w) => 0.6 + 0.07 * w.length);
      const sum = weights.reduce((a, b) => a + b, 0);
      const start = t;
      const timed = words.map((w, i) => {
        const d = (total * weights[i]) / sum;
        const ws = t;
        t += d;
        return { w, start: round(ws), end: round(t) };
      });
      const end = t;
      t += o.gap;
      return { id: p.id, scene: p.scene, who: p.who, text: p.text, start: round(start), end: round(end), words: timed };
    });
    const last = phrases[phrases.length - 1];
    return { duration: round((last ? last.end : 0) + o.tail), phrases, estimated: true };
  }

  function round(x) {
    return Math.round(x * 1000) / 1000;
  }

  // ---------- scenes ----------
  function sceneWindows(timeline) {
    const order = [];
    const first = {};
    for (const p of timeline.phrases) {
      if (!(p.scene in first)) {
        first[p.scene] = p.start;
        order.push(p.scene);
      }
    }
    const windows = {};
    order.forEach((s, i) => {
      const start = i === 0 ? 0 : Math.max(0, first[s] - 0.2);
      const next = order[i + 1];
      const end = next !== undefined ? Math.max(0, first[next] - 0.2) : timeline.duration;
      windows[s] = { start, end, firstPhraseStart: first[s] };
    });
    // scene 0 is the persistent layer (counters, recurring badges): visible for the whole video
    windows[0] = { start: 0, end: timeline.duration, firstPhraseStart: 0 };
    return windows;
  }

  // ---------- element specs (from DOM dataset or parsed HTML attributes) ----------
  function parseElementAttrs(attrs) {
    const get = (k) => (attrs[k] === undefined || attrs[k] === null ? undefined : String(attrs[k]));
    const spec = {
      in: get('data-in'),
      out: get('data-out'),
      a: get('data-a') || 'pop',
      r: get('data-r') !== undefined ? Number(get('data-r')) : 0,
      kf: [],
      wig: get('data-wig') !== undefined ? Number(get('data-wig') || 3) : 0,
      pulse: get('data-pulse') !== undefined,
      count: get('data-count') !== undefined ? Number(get('data-count')) : null,
      draw: get('data-draw') !== undefined,
      cls: [],
    };
    const kf = get('data-kf');
    if (kf) {
      let arr;
      try {
        arr = JSON.parse(kf);
      } catch (e) {
        throw new Error(`data-kf n'est pas du JSON valide : ${kf}`);
      }
      if (!Array.isArray(arr)) throw new Error(`data-kf doit être une liste : ${kf}`);
      spec.kf = arr.map((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[1] !== 'object') {
          throw new Error(`data-kf : chaque entrée doit être ["ref", {x,y,r,s,o}] — ${JSON.stringify(pair)}`);
        }
        return { ref: pair[0], to: pair[1] };
      });
    }
    const cls = get('data-cls');
    if (cls) {
      spec.cls = cls.split(';').map((s) => s.trim()).filter(Boolean).map((part) => {
        const i = part.lastIndexOf(':');
        if (i < 1) throw new Error(`data-cls attend "ref:classe" — "${part}"`);
        return { ref: part.slice(0, i).trim(), cls: part.slice(i + 1).trim() };
      });
    }
    if (!ANIMATIONS.includes(spec.a)) throw new Error(`data-a inconnu : "${spec.a}" (attendu : ${ANIMATIONS.join(', ')})`);
    if (spec.count !== null && !Number.isFinite(spec.count)) throw new Error(`data-count doit être un nombre — "${get('data-count')}"`);
    return spec;
  }

  // Resolve every time reference of a spec into seconds.
  function resolveSpec(spec, scene, timeline, windows) {
    const win = windows[scene];
    if (!win) throw new Error(`Scène ${scene} absente du script`);
    const tIn = spec.in !== undefined ? resolveRef(spec.in, timeline) : win.start;
    const tOut = spec.out !== undefined ? resolveRef(spec.out, timeline) : win.end;
    const kf = spec.kf.map((k) => ({ t: resolveRef(k.ref, timeline), to: k.to })).sort((a, b) => a.t - b.t);
    const cls = spec.cls.map((c) => ({ t: resolveRef(c.ref, timeline), cls: c.cls }));
    return Object.assign({}, spec, { scene, tIn, tOut, kfT: kf, clsT: cls, animated: spec.in !== undefined });
  }

  // ---------- state at time t ----------
  function stateAt(el, t) {
    const s = { visible: false, o: 1, x: 0, y: 0, r: el.r || 0, s: 1, sx: 1, draw: 1, count: null, classes: [] };
    for (const c of el.clsT) if (t >= c.t) s.classes.push(c.cls);
    if (t < el.tIn || t >= el.tOut) return s;
    s.visible = true;

    if (el.animated) {
      const dur = el.a === 'stamp' ? ENTER_STAMP : ENTER;
      const p = clamp01((t - el.tIn) / dur);
      const ec = easeOutCubic(p);
      const eb = easeOutBack(p);
      switch (el.a) {
        case 'pop': s.s = 0.4 + 0.6 * eb; s.o = Math.min(1, p * 2); break;
        case 'drop': s.y = -140 * (1 - eb); s.o = Math.min(1, p * 3); break;
        case 'up': s.y = 70 * (1 - ec); s.o = ec; break;
        case 'left': s.x = -160 * (1 - ec); s.o = ec; break;
        case 'stamp': s.s = 1.9 - 0.9 * ec; s.o = Math.min(1, p * 2.5); break;
        case 'fade': s.o = ec; break;
        case 'grow': s.sx = ec; s.o = Math.min(1, p * 4); break;
      }
      if (el.count !== null) s.count = Math.round(el.count * easeOutCubic(clamp01((t - el.tIn - 0.15) / 1.1)));
      if (el.draw) s.draw = easeOutCubic(clamp01((t - el.tIn - 0.1) / 0.9));
      if (el.pulse && t > el.tIn + dur) s.s *= 1 + 0.045 * Math.sin(2 * Math.PI * 1.6 * (t - el.tIn - dur));
      if (el.wig) s.r += el.wig * Math.sin(2 * Math.PI * 2.2 * (t - el.tIn));
    }

    // keyframes: offsets relative to the element's resting position, applied in order
    let base = { x: 0, y: 0, r: 0, s: 1, o: 1 };
    for (const k of el.kfT) {
      if (t < k.t) break;
      const q = easeInOutCubic(clamp01((t - k.t) / KF_DURATION));
      const target = Object.assign({}, base, k.to);
      base = {
        x: base.x + (target.x - base.x) * q,
        y: base.y + (target.y - base.y) * q,
        r: base.r + (target.r - base.r) * q,
        s: base.s + (target.s - base.s) * q,
        o: base.o + (target.o - base.o) * q,
      };
    }
    s.x += base.x; s.y += base.y; s.r += base.r; s.s *= base.s; s.o *= base.o;

    const q = clamp01((t - (el.tOut - EXIT)) / EXIT);
    if (q > 0) { s.o *= 1 - q; s.s *= 1 - 0.08 * q; }
    return s;
  }

  function activePhrase(timeline, t) {
    const ps = timeline.phrases;
    for (let i = ps.length - 1; i >= 0; i--) {
      const next = ps[i + 1];
      const until = next ? Math.min(next.start, ps[i].end + 0.6) : ps[i].end + 0.6;
      if (t >= ps[i].start && t < until) return ps[i];
    }
    return null;
  }

  function formatNumberFr(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Ranges like [["u", "z$"]] → [{from, to}] in seconds.
  function resolveRanges(ranges, timeline) {
    return (ranges || []).map(([a, b]) => ({ from: resolveRef(a, timeline), to: resolveRef(b, timeline) }));
  }

  const api = {
    ANIMATIONS, POSES, LOOKS, PROPS, ENTER, EXIT,
    phraseId, resolveRanges, parseRef, resolveRef, splitWords, estimateTimeline, sceneWindows,
    parseElementAttrs, resolveSpec, stateAt, activePhrase, formatNumberFr,
    easeOutCubic, easeOutBack,
  };
  root.StanzyCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
