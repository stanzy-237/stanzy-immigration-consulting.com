// Characters (Stanzy, Awa, Junior): SVG string as a pure function of look, pose, time and speech.
(function (root) {
  'use strict';

  const INK = '#0d1f4e', ROUGE = '#cc1627', WHITE = '#ffffff', NAVY = '#0d1f4e';
  const HAIR = '#1d1a1f', MOUTH = '#7a1f2a';
  const SW = 4;
  const O = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"`;
  const UPPER = 50, FORE = 50, LIMB = 22, SLEEVE = 24;
  const SHOULDER_L = [70, 166], SHOULDER_R = [170, 166];

  const LOOKS = {
    stanzy: { skin: '#9a6440', hair: 'twists', shirt: ROUGE, emblem: true, pants: NAVY, glasses: true },
    awa: { skin: '#7a4a2e', hair: 'puff', shirt: '#ee8a93', dress: true, pants: NAVY, lashes: true, earrings: true, collar: WHITE },
    junior: { skin: '#5c3a24', hair: 'fade', beard: true, cap: true, shirt: '#6b88b5', pants: '#cdb991' },
  };

  // Joint angles in degrees: 0 = hanging down, positive = clockwise (towards the viewer's left).
  const POSES = {
    idle:   { L: [8, -6],    R: [-8, 6],     hands: ['fist', 'fist'],   tilt: 0,  look: [0, 0],   brows: 0 },
    wave:   { L: [8, -6],    R: [-158, -18], hands: ['fist', 'open'],   tilt: -4, look: [0, 0],   brows: 1, wave: true },
    point:  { L: [84, -12],  R: [-8, 6],     hands: ['point', 'fist'],  tilt: -3, look: [-2.5, 0], brows: 1 },
    head:   { L: [8, -6],    R: [-146, -78], hands: ['fist', 'open'],   tilt: 6,  look: [1.5, -1.5], brows: 2, mouth: 'o' },
    shrug:  { L: [34, 74],   R: [-34, -74],  hands: ['open', 'open'],   tilt: 5,  look: [0, -1],  brows: 3, mouth: 'flat' },
    thumbs: { L: [8, -6],    R: [-22, -118], hands: ['fist', 'thumb'],  tilt: -2, look: [1, 0],   brows: 1, mouth: 'grin' },
    think:  { L: [-61, -121], R: [-8, 6],    hands: ['fist', 'fist'],   tilt: 7,  look: [2, -2.5], brows: 2, mouth: 'o', frontL: true },
    both:   { L: [150, 22],  R: [-150, -22], hands: ['open', 'open'],   tilt: 0,  look: [0, -1],  brows: 2, mouth: 'grin' },
    hold:   { L: [8, -6],    R: [-18, -122], hands: ['fist', 'fist'],   tilt: 4,  look: [1.5, 2], brows: 0 },
    cross:  { L: [-28, -62], R: [28, 62],    hands: ['fist', 'fist'],   tilt: -4, look: [0, 0],   brows: 1, mouth: 'flat', frontL: true, frontR: true },
    pointr: { L: [8, -6],    R: [-84, 12],   hands: ['fist', 'point'],  tilt: 3,  look: [2.5, 0], brows: 1 },
  };

  const rad = (d) => (d * Math.PI) / 180;
  const dir = (deg) => [-Math.sin(rad(deg)), Math.cos(rad(deg))];
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const f = (n) => n.toFixed(2);
  const lerp = (a, b, k) => a + (b - a) * k;

  function leaf(fill) {
    return `<path d="M12 2 L13.6 6.2 L16.2 5.2 L15.2 10 L19.2 8.2 L18.2 11.2 L21.5 12.2 L17.4 15.2 L18.4 17.4 L13.1 16.4 L12.7 21.5 L11.3 21.5 L10.9 16.4 L5.6 17.4 L6.6 15.2 L2.5 12.2 L5.8 11.2 L4.8 8.2 L8.8 10 L7.8 5.2 L10.4 6.2 Z" fill="${fill}" stroke="${fill}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }

  function prop(kind, wrist, angle) {
    const [x, y] = wrist;
    if (kind === 'phone') {
      return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle * 0.25)})">
        <rect x="-13" y="-34" width="26" height="44" rx="5" fill="${NAVY}" ${O}/>
        <rect x="-9" y="-29" width="18" height="30" rx="2" fill="#7fe0b0"/>
        <path d="M-5 -22 H5 M-5 -16 H3 M-5 -10 H5" stroke="#1d6b4a" stroke-width="2" stroke-linecap="round"/></g>`;
    }
    if (kind === 'beignet') {
      return `<g transform="translate(${f(x)} ${f(y - 16)})">
        <circle r="15" fill="#c8893b" ${O}/>
        <path d="M-7 -5 L-5 -6 M2 -9 L4 -8 M6 2 L8 1 M-3 4 L-1 5" stroke="#fdf3e1" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M9 -12 A6 6 0 0 0 14 -4" fill="#fdf3e1" stroke="${INK}" stroke-width="3"/></g>`;
    }
    return '';
  }

  function hand(type, wrist, angle, side, skin) {
    const [x, y] = wrist;
    const rot = `transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"`;
    if (type === 'open') {
      return `<g ${rot}>
        <ellipse cx="${side * 9}" cy="2" rx="5.5" ry="9" fill="${skin}" ${O} transform="rotate(${side * -35} ${side * 9} 2)"/>
        <rect x="-12" y="-2" width="24" height="26" rx="11" fill="${skin}" ${O}/>
        <path d="M-5 18 V25 M0 19 V26 M5 18 V25" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    }
    if (type === 'point') {
      return `<g ${rot}>
        <circle cx="0" cy="4" r="12.5" fill="${skin}" ${O}/>
        <rect x="-5" y="4" width="10" height="34" rx="5" fill="${skin}" ${O}/></g>`;
    }
    const fist = `<circle cx="${f(x)}" cy="${f(y)}" r="12.5" fill="${skin}" ${O}/>`;
    if (type === 'thumb') {
      return `${fist}<rect x="${f(x - 4.5)}" y="${f(y - 30)}" width="9" height="24" rx="4.5" fill="${skin}" ${O}/>
        <path d="M${f(x - 8)} ${f(y - 3)} H${f(x + 8)} M${f(x - 8)} ${f(y + 4)} H${f(x + 8)}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return fist;
  }

  function arm(look, shoulder, a1, a2, handType, side, held) {
    const elbow = add(shoulder, dir(a1), UPPER);
    const wrist = add(elbow, dir(a1 + a2), FORE);
    const sleeveEnd = add(shoulder, dir(a1), SLEEVE);
    const d = `M${f(shoulder[0])} ${f(shoulder[1])} L${f(elbow[0])} ${f(elbow[1])} L${f(wrist[0])} ${f(wrist[1])}`;
    const s = `M${f(shoulder[0])} ${f(shoulder[1])} L${f(sleeveEnd[0])} ${f(sleeveEnd[1])}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${LIMB + 2 * SW}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${look.skin}" stroke-width="${LIMB}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${s}" fill="none" stroke="${INK}" stroke-width="${LIMB + 12 + 2 * SW}" stroke-linecap="round"/>
      <path d="${s}" fill="none" stroke="${look.shirt}" stroke-width="${LIMB + 12}" stroke-linecap="round"/>
      ${held ? prop(held, wrist, a1 + a2) : ''}
      ${hand(held ? 'fist' : handType, wrist, a1 + a2, side, look.skin)}`;
  }

  function hairBack(look) {
    if (look.hair === 'puff') {
      return `<circle cx="120" cy="38" r="30" fill="${HAIR}" stroke="${INK}" stroke-width="${SW}"/>`;
    }
    return '';
  }

  function hairFront(look) {
    if (look.hair === 'twists') {
      let s = '';
      for (const [x, y] of [[78, 82], [84, 64], [96, 50], [110, 43], [125, 42], [140, 46], [153, 57], [161, 72], [164, 88]]) {
        s += `<circle cx="${x}" cy="${y}" r="13" fill="${HAIR}" stroke="${INK}" stroke-width="3.5"/>`;
      }
      return s + `<path d="M80 92 Q82 56 120 54 Q158 56 160 92 Q150 72 120 70 Q90 72 80 92 Z" fill="${HAIR}"/>`;
    }
    if (look.hair === 'puff') {
      return `<path d="M94 54 Q120 62 146 54" fill="none" stroke="${ROUGE}" stroke-width="7" stroke-linecap="round"/>
        <path d="M79 96 Q76 50 120 52 Q164 50 161 96 Q152 70 120 68 Q88 70 79 96 Z" fill="${HAIR}" ${O}/>`;
    }
    if (look.hair === 'fade') {
      let s = `<path d="M81 92 Q78 48 120 47 Q162 48 159 92 Q154 68 120 67 Q86 68 81 92 Z" fill="${HAIR}" ${O}/>`;
      if (look.cap) {
        s += `<path d="M79 78 Q80 40 120 38 Q160 40 161 78 Z" fill="${NAVY}" ${O}/>
          <path d="M150 74 Q178 70 192 80 Q170 86 150 82 Z" fill="${ROUGE}" ${O}/>
          <circle cx="120" cy="40" r="4" fill="${ROUGE}"/>`;
      }
      return s;
    }
    return '';
  }

  function face(look, t, talking, p) {
    const [lx, ly] = p.look;
    const blink = (t % 3.7) < 0.12;
    const eyes = blink
      ? `<path d="M100 97 H110 M130 97 H140" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`
      : `<ellipse cx="${f(105 + lx)}" cy="${f(97 + ly)}" rx="4.2" ry="5.6" fill="${INK}"/><ellipse cx="${f(135 + lx)}" cy="${f(97 + ly)}" rx="4.2" ry="5.6" fill="${INK}"/>
         <circle cx="${f(106.4 + lx)}" cy="${f(95 + ly)}" r="1.5" fill="#fff"/><circle cx="${f(136.4 + lx)}" cy="${f(95 + ly)}" r="1.5" fill="#fff"/>`;
    const lashes = look.lashes && !blink
      ? '<path d="M100 91 L97 88 M110 91 L113 88 M130 91 L127 88 M140 91 L143 88" stroke="#0d1f4e" stroke-width="2" stroke-linecap="round"/>' : '';
    const b = -2 * p.brows;
    const brows = `<path d="M97 ${f(82 + b)} Q105 ${f(77 + b)} 112 ${f(81 + b)}" fill="none" stroke="${HAIR}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M128 ${f(81 + b)} Q135 ${f(77 + b)} 143 ${f(82 + b)}" fill="none" stroke="${HAIR}" stroke-width="3.6" stroke-linecap="round"/>`;
    const beard = look.beard
      ? `<path d="M86 106 Q90 142 120 143 Q150 142 154 106 Q147 128 120 130 Q93 128 86 106 Z" fill="${HAIR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` : '';
    let mouth;
    if (talking && Math.sin(t * 2 * Math.PI * 4.2) > -0.2) {
      mouth = `<ellipse cx="120" cy="117" rx="9" ry="${f(5 + 3 * Math.abs(Math.sin(t * 9.1)))}" fill="${MOUTH}" stroke="${INK}" stroke-width="3"/>`;
    } else if (p.mouth === 'o') {
      mouth = `<circle cx="121" cy="117" r="4.5" fill="${MOUTH}" stroke="${INK}" stroke-width="3"/>`;
    } else if (p.mouth === 'flat') {
      mouth = `<path d="M110 117 Q120 113 130 117" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    } else if (p.mouth === 'grin') {
      mouth = `<path d="M105 113 Q120 131 135 113 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    } else {
      mouth = `<path d="M108 115 Q120 127 132 115 Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    const glasses = look.glasses
      ? `<circle cx="105" cy="97" r="13" fill="rgba(255,255,255,.18)" stroke="${INK}" stroke-width="3.5"/>
         <circle cx="135" cy="97" r="13" fill="rgba(255,255,255,.18)" stroke="${INK}" stroke-width="3.5"/>
         <path d="M118 96 Q120 93 122 96" fill="none" stroke="${INK}" stroke-width="3.5"/>` : '';
    const earrings = look.earrings
      ? `<circle cx="80" cy="113" r="4.5" fill="${ROUGE}" stroke="${INK}" stroke-width="2"/><circle cx="160" cy="113" r="4.5" fill="${ROUGE}" stroke="${INK}" stroke-width="2"/>` : '';
    return `${beard}${eyes}${lashes}${brows}
      <path d="M120 101 Q116 109 122 109" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
      ${mouth}
      <circle cx="95" cy="111" r="6" fill="#ee8a93" opacity=".45"/><circle cx="145" cy="111" r="6" fill="#ee8a93" opacity=".45"/>
      ${glasses}${earrings}`;
  }

  function torso(look) {
    const legs = look.dress
      ? `<rect x="97" y="290" width="18" height="90" rx="8" fill="${look.skin}" ${O}/>
         <rect x="125" y="290" width="18" height="90" rx="8" fill="${look.skin}" ${O}/>`
      : `<rect x="91" y="262" width="27" height="118" rx="9" fill="${look.pants}" ${O}/>
         <rect x="122" y="262" width="27" height="118" rx="9" fill="${look.pants}" ${O}/>`;
    return `${legs}
      <rect x="78" y="372" width="44" height="24" rx="11" fill="#fff" ${O}/>
      <rect x="118" y="372" width="44" height="24" rx="11" fill="#fff" ${O}/>
      <path d="M82 388 H118 M122 388 H158" stroke="${ROUGE}" stroke-width="4" stroke-linecap="round"/>`;
  }

  function body(look) {
    const shape = look.dress
      ? 'M80 150 Q120 140 160 150 Q174 156 170 190 L166 250 L184 312 L56 312 L74 250 L70 190 Q66 156 80 150 Z'
      : 'M80 150 Q120 140 160 150 Q174 156 170 190 L162 278 L78 278 L70 190 Q66 156 80 150 Z';
    let s = `<rect x="109" y="124" width="22" height="26" rx="6" fill="${look.skin}" ${O}/>
      <path d="${shape}" fill="${look.shirt}" ${O}/>`;
    if (look.dress) s += `<path d="M74 250 Q120 262 166 250" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<path d="M106 146 Q120 158 134 146" fill="${look.collar || 'none'}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    if (look.emblem) {
      s += `<g transform="translate(101 186) scale(1.6)">${leaf(WHITE)}</g>
        <text x="120" y="244" text-anchor="middle" font-family="Inter" font-weight="800" font-size="12" letter-spacing="2" fill="${WHITE}">STANZY</text>`;
    }
    return s;
  }

  // Blend two poses: numbers interpolate, discrete traits switch at the midpoint.
  function blend(a, b, k) {
    const mix = (x, y) => [lerp(x[0], y[0], k), lerp(x[1], y[1], k)];
    const late = k >= 0.5 ? b : a;
    return {
      L: mix(a.L, b.L), R: mix(a.R, b.R), look: mix(a.look, b.look),
      tilt: lerp(a.tilt, b.tilt, k), brows: lerp(a.brows, b.brows, k),
      hands: late.hands, mouth: late.mouth, frontL: late.frontL, frontR: late.frontR, wave: b.wave && k > 0.6,
    };
  }

  // opts: { look: 'stanzy'|'awa'|'junior', hold: 'phone'|'beignet', gaze: [dx, dy] }
  function mascotSVG(poseName, t, talking, fromPose, k, opts) {
    const o = opts || {};
    const look = LOOKS[o.look] || LOOKS.stanzy;
    const time = t || 0;
    const target = POSES[poseName] || POSES.idle;
    let p = fromPose && POSES[fromPose] && k !== undefined && k < 1 ? blend(POSES[fromPose], target, Math.max(0, k)) : target;
    if (o.gaze) p = Object.assign({}, p, { look: [p.look[0] + o.gaze[0], p.look[1] + o.gaze[1]] });
    const rE = p.R[1] + (p.wave ? 22 * Math.sin(time * 2 * Math.PI * 1.8) : 0);
    const holdRight = o.hold && p.hands[1] !== 'open' && p.hands[1] !== 'thumb' ? o.hold : null;
    const left = arm(look, SHOULDER_L, p.L[0], p.L[1], p.hands[0], -1, null);
    const right = arm(look, SHOULDER_R, p.R[0], rE, p.hands[1], 1, holdRight);
    return `<svg viewBox="0 0 240 420" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="120" cy="404" rx="64" ry="8" fill="${INK}" opacity=".12"/>
  ${torso(look)}
  ${p.frontL ? '' : left}
  ${p.frontR ? '' : right}
  ${body(look)}
  <g transform="rotate(${f(p.tilt)} 120 140)">
    ${hairBack(look)}
    <circle cx="80" cy="99" r="9" fill="${look.skin}" ${O}/>
    <circle cx="160" cy="99" r="9" fill="${look.skin}" ${O}/>
    <ellipse cx="120" cy="95" rx="41" ry="45" fill="${look.skin}" ${O}/>
    ${hairFront(look)}
    ${face(look, time, talking, p)}
  </g>
  ${p.frontL ? left : ''}
  ${p.frontR ? right : ''}
</svg>`;
  }

  const api = { mascotSVG, POSE_NAMES: Object.keys(POSES), LOOK_NAMES: Object.keys(LOOKS) };
  root.StanzyMascot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
