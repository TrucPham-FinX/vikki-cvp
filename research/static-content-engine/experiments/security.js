#!/usr/bin/env node
/**
 * Same hostile inputs through every engine. Reports what each engine does by default
 * with the template code from this experiment (not with hand-added escaping).
 */
const path = require('path');
const { prepare } = require('./lib/prepare');
const ui = require('./fixtures/ui.json');
const base = require('./fixtures/page.vi.json');
const ENGINES = ['handlebars', 'nunjucks', 'liquid', 'eta', 'preact'];

const clone = (o) => JSON.parse(JSON.stringify(o));
function page(mut) { const p = clone(base); mut(p); return p; }
const img = (p) => p.components.find((c) => c.type === 'imageSection');

const CASES = [
  { id: 'text', desc: 'hero heading = <script>alert(1)</script>',
    vm: () => prepare(page((p) => { p.hero.heading = '<script>alert(1)</script>'; }), ui),
    page: 'landing', bad: (h) => h.includes('<script>alert(1)</script>') },
  { id: 'attr', desc: 'imageSection.className = x" onmouseover="alert(1)',
    vm: () => prepare(page((p) => { img(p).className = 'x" onmouseover="alert(1)'; }), ui),
    page: 'landing', bad: (h) => /class="[^"]*x"\s*onmouseover=/.test(h) },
  { id: 'url', desc: 'imageSection.src = javascript:alert(1)',
    vm: () => prepare(page((p) => { img(p).src = 'javascript:alert(1)'; }), ui),
    page: 'landing', bad: (h) => h.includes('src="javascript:alert(1)"') },
  { id: 'script-json', desc: 'hero.video.src = </script><script>alert(1)</script>',
    vm: () => prepare(page((p) => { p.hero.video.src = '</script><script>alert(1)</script>'; }), ui),
    page: 'landing', bad: (h) => h.includes('<script>alert(1)</script>') },
  { id: 'rich', desc: 'FAQ content = <img src=x onerror=alert(1)><a href="&#106;avascript:alert(1)">x</a>',
    vm: () => prepare(page((p) => { p.qaGroup[0].children[0].content = '<img src=x onerror=alert(1)><a href="&#106;avascript:alert(1)">x</a>'; }), ui),
    page: 'landing', bad: (h) => /onerror|&#106;avascript|javascript:/.test(h) },
  { id: 'typo-spelling', desc: 'components[] contains { type: "imageSectoin" }',
    vm: () => prepare(page((p) => { p.components.push({ type: 'imageSectoin', src: 'a.png' }); }), ui),
    page: 'landing', expectThrow: true },
  { id: 'typo-case', desc: 'components[] contains { type: "imagesection" } (case only; host FS: ' + process.platform + ')',
    vm: () => prepare(page((p) => { p.components.push({ type: 'imagesection', src: 'a.png' }); }), ui),
    page: 'landing', expectThrow: true },
  { id: 'unknown-doc-block', desc: 'document block { type: "note" }',
    vm: () => prepare(page((p) => { p.document.sections[2].blocks.push({ type: 'note', text: 'x' }); }), ui),
    page: 'document', expectThrow: true }
];

async function main() {
  const rows = [];
  for (const e of ENGINES) {
    const r = await require(`./engines/${e}/render`).createRenderer();
    const row = { engine: e };
    for (const c of CASES) {
      let html, err;
      try { html = await (c.page === 'landing' ? r.renderLanding(c.vm()) : r.renderDocument(c.vm())); } catch (x) { err = x; }
      if (c.expectThrow) row[c.id] = err ? 'throws ✓' : 'SILENT ✗';
      else if (err) row[c.id] = `error: ${err.message.slice(0, 40)}`;
      else row[c.id] = c.bad(html) ? 'VULNERABLE ✗' : 'safe ✓';
    }
    rows.push(row);
  }
  console.log('Cases:'); CASES.forEach((c) => console.log(`  ${c.id.padEnd(18)} ${c.desc}`));
  console.table(rows);

  // Sanitiser comparison on the payloads that bypass core/sanitize.js.
  const repo = require(path.resolve(__dirname, '../../../core/sanitize.js'));
  const sh = require('sanitize-html');
  const { SANITIZE } = require('./lib/prepare');
  const payloads = [
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="java&#x09;script:alert(1)">x</a>',
    `<a title='"onmouseover=alert(1) x="'>x</a>`,
    '<ul class="note-plus-list"><li>kept?</li></ul>'
  ];
  console.log('\nSanitiser comparison (input -> core/sanitize.js | sanitize-html with lib/prepare.js config):');
  for (const p of payloads) console.log(`  ${p}\n     repo: ${repo.sanitizeHtml(p)}\n     s-h : ${sh(p, SANITIZE)}`);
}

main();
