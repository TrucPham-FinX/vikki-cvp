const path = require('path');
const { Liquid } = require('liquidjs');
const h = require('../../lib/helpers');

function createRenderer() {
  const liquid = new Liquid({
    root: path.join(__dirname, 'templates'),
    extname: '.liquid',
    outputEscape: 'escape', // LiquidJS does NOT escape by default
    strictFilters: true,
    jsTruthy: true, // Liquid default: '' is truthy (Ruby semantics) -> class="" leaks; match JS/Handlebars
    cache: true
  });
  // Filters read page-level values from globals, because {% render %} isolates scope.
  const g = (ctx, key) => ctx.getSync([key]);
  liquid.registerFilter('asset', function (file) { return h.asset(g(this.context, 'assetBase'), file); });
  liquid.registerFilter('t', function (key) { return h.t(g(this.context, 'ui'), key); });
  liquid.registerFilter('cx', (...parts) => h.cx(...parts));
  liquid.registerFilter('script_json', (v) => h.scriptJson(v));

  const render = (file, vm) => liquid.renderFileSync(file, vm, { globals: { assetBase: vm.assetBase, ui: vm.ui } });
  return {
    renderLanding: (vm) => render('pages/landing', vm),
    renderDocument: (vm) => render('pages/document', vm)
  };
}

module.exports = { createRenderer };
