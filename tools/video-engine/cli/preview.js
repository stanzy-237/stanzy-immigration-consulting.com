'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCheck } = require('./check.js');
const { buildHtml } = require('../lib/build-html.js');
const { mixHash } = require('../lib/events.js');

// Writes build/preview.html (self-contained) with the best up-to-date audio: full mix, else voice only.
function writePreview(project, timeline) {
  const buildDir = path.join(project.dir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  const out = path.join(buildDir, 'preview.html');
  const mixFresh = project.voiceFile && project.mixRecordedHash === mixHash(project) && fs.existsSync(project.mixFile);
  const audioFile = mixFresh ? project.mixFile : project.voiceFile;
  fs.writeFileSync(out, buildHtml(project, timeline, { audioFile }));
  const note = mixFresh ? '  (voix + musique + effets)' : project.voiceFile ? '  (voix seule)' : `  (muet — npm run voice -- ${project.slug})`;
  console.log(`  ▸ aperçu : ${out}${note}`);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const { project, errors, timeline } = runCheck(slug);
  if (errors.length) process.exit(1);
  const out = writePreview(project, timeline);
  if (!args.includes('--no-open')) execFileSync('open', [out]);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}

module.exports = { writePreview };
