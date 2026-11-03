const path = require('path');
const nunjucks = require('nunjucks');
const h = require('../../lib/helpers');

function createRenderer() {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(path.join(__dirname, 'templates'), { noCache: false }),
    { autoescape: true, throwOnUndefined: false }
  );
  env.addGlobal('cx', h.cx);
  env.addGlobal('fail', (msg) => { throw new Error(`[Render Error] ${msg}`); });
  env.addFilter('scriptJson', (v) => new nunjucks.runtime.SafeString(h.scriptJson(v)));

  // Per-render functions that need the page (asset base, locale dictionary).
  const ctx = (vm) => ({ ...vm, asset: (f) => h.asset(vm.assetBase, f), t: (k) => h.t(vm.ui, k) });

  return {
    renderLanding: (vm) => env.render('pages/landing.njk', ctx(vm)),
    renderDocument: (vm) => env.render('pages/document.njk', ctx(vm))
  };
}

module.exports = { createRenderer };
