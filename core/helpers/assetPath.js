module.exports = function assetPath(file, options) {
  const root = (options && options.data && options.data.root) || {};
  const base = root.assetBase || './assets/';
  return `${base}${file}`;
};
