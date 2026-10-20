'use strict';
// Minimal HTML tag scanner for the constrained scenes.js markup: yields every element
// with its attributes, parent, and nesting depth. Not a general-purpose parser.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TAG_RE = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(src) {
  const attrs = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(src))) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function parseHtml(html) {
  const elements = [];
  const stack = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const name = m[1].toLowerCase();
      const top = stack.pop();
      if (!top || top.tag !== name) {
        throw new Error(`HTML déséquilibré : </${name}> ne ferme pas <${top ? top.tag : '(rien)'}> (position ${m.index})`);
      }
      continue;
    }
    const tag = m[2].toLowerCase();
    const el = { tag, attrs: parseAttrs(m[3] || ''), parent: stack[stack.length - 1] || null, depth: stack.length, index: m.index };
    elements.push(el);
    if (!(m[4] === '/' || VOID.has(tag))) stack.push(el);
  }
  if (stack.length) throw new Error(`HTML déséquilibré : <${stack[stack.length - 1].tag}> jamais fermé`);
  return elements;
}

function classList(el) {
  return (el.attrs.class || '').split(/\s+/).filter(Boolean);
}

function parseStyle(style) {
  const out = {};
  for (const part of String(style || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

module.exports = { parseHtml, classList, parseStyle };
