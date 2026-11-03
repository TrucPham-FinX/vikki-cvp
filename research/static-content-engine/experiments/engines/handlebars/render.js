const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const h = require('../../lib/helpers');

const DIR = path.join(__dirname, 'templates');

function createRenderer() {
  const hbs = Handlebars.create();

  (function register(dir, ns) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const name = ns ? `${ns}/${e.name}` : e.name;
      if (e.isDirectory()) register(full, name);
      else if (e.name.endsWith('.hbs') && !full.includes(`${path.sep}pages${path.sep}`)) {
        hbs.registerPartial(name.replace(/\.hbs$/, ''), fs.readFileSync(full, 'utf8'));
      }
    }
  })(DIR, '');

  const root = (o) => o.data.root;
  hbs.registerHelper({
    eq: (a, b) => a === b,
    or: (a, b) => a || b,
    when: (cond, v) => (cond ? v : ''),
    concat: (...a) => a.slice(0, -1).join(''),
    lower: h.lower,
    cx: (...a) => h.cx(...a.slice(0, -1)),
    asset: (file, o) => h.asset(root(o).assetBase, file),
    t: (key, o) => h.t(root(o).ui, key),
    json: (v) => new hbs.SafeString(h.scriptJson(v))
  });

  const page = (name) => hbs.compile(fs.readFileSync(path.join(DIR, 'pages', `${name}.hbs`), 'utf8'));
  const landing = page('landing');
  const document = page('document');

  return {
    renderLanding: (vm) => landing(vm),
    renderDocument: (vm) => document(vm)
  };
}

module.exports = { createRenderer };
