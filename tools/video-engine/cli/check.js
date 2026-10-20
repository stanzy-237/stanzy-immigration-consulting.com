'use strict';
const { resolveProjectDir, loadProject } = require('../lib/project.js');
const { validateProject } = require('../lib/validate.js');

function runCheck(slug, { quiet } = {}) {
  const project = loadProject(resolveProjectDir(slug));
  const result = validateProject(project);
  if (!quiet || result.errors.length) {
    console.log(`\n▸ check ${project.slug} (${project.dir})`);
    for (const w of result.warnings) console.log(`  ⚠  ${w}`);
    for (const e of result.errors) console.log(`  ✖  ${e}`);
    if (!result.errors.length) {
      const d = result.timeline.duration.toFixed(1);
      console.log(`  ✔  OK — ${project.script.length} phrases, durée ${d} s${result.timeline.estimated ? ' (estimée)' : ''}`);
    } else {
      console.log(`\n  ${result.errors.length} erreur(s) — corriger avant de continuer.`);
    }
  }
  return { project, ...result };
}

if (require.main === module) {
  try {
    const { errors } = runCheck(process.argv[2]);
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}

module.exports = { runCheck };
