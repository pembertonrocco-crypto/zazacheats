#!/usr/bin/env node
/**
 * Builds the uploadable theme zip.
 *
 *   npm run package        # -> zazacheats-theme.zip
 *
 * The layout deliberately mirrors the export SellAuth produces, which carries
 * every file TWICE: once in the canonical directory tree, and once flattened
 * into the archive root.
 *
 * The flat copies are lossy and cannot be the whole story — `faq.njk` and
 * `products.njk` each exist as both a component and a template, and only one
 * of the two can occupy a given root filename. The export resolves both in
 * favour of the template, so this does the same, and the directory tree
 * alongside carries the complete set either way. Do not "clean this up" by
 * dropping the flat copies without checking how the dashboard's importer
 * actually reads an upload; matching the export byte-for-byte in shape is the
 * cheap way to be sure an upload behaves the way the last one did.
 *
 * What is NOT included: built.css, style.css, hero.jpg and tailwind.config.js.
 * They ship in the stock export, nothing in this theme references any of them
 * (verified against every `| assetUrl` call), and they are ~110KB of dead
 * weight. They have never been tracked in this repo either.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'zazacheats-theme.zip');
const STAGE = path.join(ROOT, '.package');

const DIRS = ['assets', 'components', 'layouts', 'snippets', 'templates'];
const ROOT_FILES = ['settings.json', 'schema.json', 'settings.default.json'];

/* Which directory wins a flat-root filename collision. Matches the export. */
const FLAT_WINNER = { 'faq.njk': 'templates', 'products.njk': 'templates' };
/* Directory precedence when a name is unique — later entries never override. */
const FLAT_ORDER = ['components', 'snippets', 'layouts', 'templates', 'assets'];

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

/* 1. the canonical directory tree */
for (const d of DIRS) {
  fs.cpSync(path.join(ROOT, d), path.join(STAGE, d), { recursive: true });
}

/* 2. the top-level config files */
for (const f of ROOT_FILES) {
  fs.copyFileSync(path.join(ROOT, f), path.join(STAGE, f));
}

/* 3. the flattened copies */
const placed = new Map();
for (const d of FLAT_ORDER) {
  for (const name of fs.readdirSync(path.join(ROOT, d))) {
    const winner = FLAT_WINNER[name];
    if (winner && winner !== d) continue;
    if (placed.has(name) && !winner) continue;
    placed.set(name, d);
    fs.copyFileSync(path.join(ROOT, d, name), path.join(STAGE, name));
  }
}

fs.rmSync(OUT, { force: true });
execFileSync('zip', ['-r', '-q', '-X', OUT, '.'], { cwd: STAGE });
fs.rmSync(STAGE, { recursive: true, force: true });

const size = fs.statSync(OUT).size;
const listed = execFileSync('zip', ['-sf', OUT]).toString().trim().split('\n').length - 2;
console.log(
  `${path.basename(OUT)}  ${(size / 1024 / 1024).toFixed(2)} MB  ${listed} entries\n` +
  `  ${DIRS.length} directories + ${ROOT_FILES.length} config files + ${placed.size} flattened copies`
);
for (const [name, dir] of Object.entries(FLAT_WINNER)) {
  console.log(`  collision: /${name} taken from ${dir}/ (components/${name} lives in the tree only)`);
}
