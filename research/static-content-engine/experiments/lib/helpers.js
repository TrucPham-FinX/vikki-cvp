/**
 * The four pure functions every engine needs. Each engine registers these under
 * its own mechanism (helper / filter / global / import) — the logic is shared so
 * the comparison measures the engine, not differing helper implementations.
 */

// Join truthy class tokens: cx('a', false, 'b') -> 'a b'
const cx = (...parts) => parts.filter((p) => typeof p === 'string' && p.trim()).join(' ');

// Asset URL from the page's assetBase. Absolute / already-relative URLs pass through.
const asset = (assetBase, file) => (/^(?:[a-z]+:|\/|\.\/)/i.test(file) ? file : `${assetBase}${file}`);

// Dictionary lookup; a missing key is a build error, not a silently printed key.
function t(ui, key) {
  if (!(key in ui)) throw new Error(`[i18n] missing key "${key}"`);
  return ui[key];
}

// JSON safe for embedding inside <script>: no "</script>", no "<!--", no U+2028/9.
const scriptJson = (v) => JSON.stringify(v)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const lower = (s) => String(s).toLowerCase();

module.exports = { cx, asset, t, scriptJson, lower };
