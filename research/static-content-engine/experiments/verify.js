#!/usr/bin/env node
/**
 * Proves every engine produced the same pages as the Handlebars reference,
 * compared on parse5-canonical HTML (see lib/normalize.js). Prints the first
 * divergence when a page differs.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalize } = require('./lib/normalize');

const DIST = path.join(__dirname, 'dist');
const REF = 'handlebars';
const engines = fs.readdirSync(DIST).filter((d) => fs.statSync(path.join(DIST, d)).isDirectory());
const pages = ['vi/index.html', 'vi/tc.html', 'en/index.html', 'en/tc.html'];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

let failed = 0;
const ref = Object.fromEntries(pages.map((p) => [p, normalize(fs.readFileSync(path.join(DIST, REF, p), 'utf8'))]));
console.log(`reference: ${REF}  ${pages.map((p) => `${p}=${sha(ref[p])}`).join('  ')}`);

for (const e of engines.filter((x) => x !== REF)) {
  const res = pages.map((p) => {
    const file = path.join(DIST, e, p);
    if (!fs.existsSync(file)) return { p, ok: false, why: 'missing' };
    const n = normalize(fs.readFileSync(file, 'utf8'));
    if (n === ref[p]) return { p, ok: true };
    let i = 0;
    while (n[i] === ref[p][i]) i++;
    return { p, ok: false, why: `@${i}\n      ref: …${ref[p].slice(Math.max(0, i - 60), i + 80)}\n      got: …${n.slice(Math.max(0, i - 60), i + 80)}` };
  });
  const bad = res.filter((r) => !r.ok);
  failed += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${e.padEnd(10)} ${res.filter((r) => r.ok).length}/${pages.length} pages equivalent`);
  bad.forEach((b) => console.log(`    ${b.p}: ${b.why}`));
}
process.exitCode = failed ? 1 : 0;
