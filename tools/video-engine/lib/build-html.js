'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ENGINE_ROOT, REPO_ROOT } = require('./project.js');

const ENGINE = path.join(ENGINE_ROOT, 'engine');
const LOGO = path.join(REPO_ROOT, 'public', 'Logo-white-background.svg');
const FONTS = [
  ['Inter', 'inter.woff2', '400 800'],
  ['Fraunces', 'fraunces.woff2', '600 800'],
  ['Caveat', 'caveat.woff2', '500 700'],
];

function fontFaces() {
  return FONTS.map(([family, file, weight]) => {
    const b64 = fs.readFileSync(path.join(ENGINE, 'fonts', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
}

function safeJson(obj) {
  const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  return JSON.stringify(obj).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in values ? values[k] : ''));
}

// Assemble a single self-contained HTML page for preview (and later, frame capture).
function buildHtml(project, timeline, opts) {
  const o = opts || {};
  const read = (f) => fs.readFileSync(path.join(ENGINE, f), 'utf8');
  const scripts = [read('core.js'), read('mascot.js'), project.scenesJs, read('engine.js'), o.capture ? '' : read('player.js')]
    .join('\n;\n')
    .replace(/<\/script/gi, '<\\/script');
  return fill(read('template.html'), {
    TITLE: escapeHtml((project.config && project.config.title) || project.slug),
    BODY_CLASS: o.capture ? 'capture' : '',
    FONTS: fontFaces(),
    STYLES: read('styles.css'),
    PROJECT: safeJson({ script: project.script, config: project.config, timeline, logoSVG: fs.readFileSync(LOGO, 'utf8') }),
    SCRIPTS: scripts,
    AUDIO_SRC: o.audioFile ? ` src="data:audio/wav;base64,${fs.readFileSync(o.audioFile).toString('base64')}"` : '',
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

module.exports = { buildHtml };
