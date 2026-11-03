#!/usr/bin/env node
/** Static code metrics per engine: files, non-blank lines, characters, raw-HTML sites. */
const fs = require('fs');
const path = require('path');

const ENGINES = {
  handlebars: { dirs: ['templates'], raw: /\{\{\{/g },
  nunjucks: { dirs: ['templates'], raw: /\|\s*safe/g },
  liquid: { dirs: ['templates'], raw: /\|\s*raw/g },
  eta: { dirs: ['templates'], raw: /<%~/g },
  preact: { dirs: ['src'], raw: /<Rich\b|dangerouslySetInnerHTML/g },
  eleventy: { dirs: ['src'], extra: ['eleventy.config.js'], raw: /\|\s*safe/g }
};

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}

const rows = [];
for (const [name, cfg] of Object.entries(ENGINES)) {
  const base = path.join(__dirname, 'engines', name);
  const tpl = cfg.dirs.flatMap((d) => files(path.join(base, d)));
  const glue = [path.join(base, 'render.js'), ...(cfg.extra || []).map((f) => path.join(base, f))].filter(fs.existsSync);
  const stat = (list) => list.reduce((a, f) => {
    const s = fs.readFileSync(f, 'utf8');
    a.lines += s.split('\n').filter((l) => l.trim()).length;
    a.chars += s.replace(/\s+/g, '').length;
    a.raw += (s.match(cfg.raw) || []).length;
    return a;
  }, { lines: 0, chars: 0, raw: 0 });
  const t = stat(tpl), g = stat(glue);
  rows.push({ engine: name, templateFiles: tpl.length, templateLines: t.lines, templateChars: t.chars, glueLines: g.lines, rawHtmlSites: t.raw + g.raw });
}
console.table(rows);
console.log('Shared by all engines (not counted above): lib/prepare.js, lib/helpers.js');
console.log('templateChars = non-whitespace characters (less sensitive to formatting than line counts).');
