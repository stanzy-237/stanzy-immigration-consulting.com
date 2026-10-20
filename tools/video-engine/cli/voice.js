'use strict';
// Audio for preview: check → voice (cached) → re-check on real timings → music & effects → preview.
const { execFileSync } = require('node:child_process');
const { runCheck } = require('./check.js');
const { writePreview } = require('./preview.js');
const { ensureVoice, ensureMix } = require('../lib/audio.js');

function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));

  const first = runCheck(slug);
  if (first.errors.length) process.exit(1);
  ensureVoice(first.project, { force: true });

  const second = runCheck(slug);
  if (second.errors.length) process.exit(1);
  ensureMix(second.project, second.timeline);

  const final = runCheck(slug, { quiet: true });
  const out = writePreview(final.project, final.timeline);
  if (!args.includes('--no-open')) execFileSync('open', [out]);
}

try {
  main();
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
