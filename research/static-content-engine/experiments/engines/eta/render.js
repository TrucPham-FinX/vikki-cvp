const path = require('path');
const { Eta } = require('eta');
const h = require('../../lib/helpers');

function createRenderer() {
  const eta = new Eta({ views: path.join(__dirname, 'templates'), autoEscape: true, cache: true,
    // Without this Eta prints the string "undefined" for missing optional fields.
    autoFilter: true, filterFunction: (v) => (v ?? '') });
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ctx = (vm) => ({
    ...vm,
    $: { cx: h.cx, esc, scriptJson: h.scriptJson, asset: (f) => h.asset(vm.assetBase, f), t: (k) => h.t(vm.ui, k) }
  });
  return {
    renderLanding: (vm) => eta.render('/pages/landing', ctx(vm)),
    renderDocument: (vm) => eta.render('/pages/document', ctx(vm))
  };
}

module.exports = { createRenderer };
