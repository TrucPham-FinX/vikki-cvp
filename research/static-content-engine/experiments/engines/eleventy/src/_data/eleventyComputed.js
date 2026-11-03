// Eleventy exposes the paginated item as `vm`; the shared Nunjucks templates expect
// the view-model keys at top level, plus per-page asset()/t(). Map them here.
const h = require('../../../../lib/helpers');
const KEYS = ['locale', 'title', 'className', 'hasTopSpace', 'assetBase', 'hero', 'components', 'qaGroup', 'document', 'ui'];
const computed = Object.fromEntries(KEYS.map((k) => [k, (d) => (d.vm ? d.vm[k] : d[k])]));
computed.asset = (d) => (f) => h.asset(d.vm.assetBase, f);
computed.t = (d) => (k) => h.t(d.vm.ui, k);
module.exports = computed;
