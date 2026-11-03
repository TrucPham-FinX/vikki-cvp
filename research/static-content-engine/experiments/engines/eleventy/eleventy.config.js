const h = require('../../lib/helpers');
// Must be Eleventy's own nunjucks instance, otherwise SafeString is not recognised.
const { runtime } = require(require.resolve('nunjucks', { paths: [require.resolve('@11ty/eleventy')] }));
module.exports = function (cfg) {
  cfg.addNunjucksGlobal('cx', h.cx);
  cfg.addNunjucksGlobal('fail', (m) => { throw new Error(`[Render Error] ${m}`); });
  // Universal addFilter() output is autoescaped; a SafeString needs the nunjucks-specific API.
  cfg.addNunjucksFilter('scriptJson', (v) => new runtime.SafeString(h.scriptJson(v)));
  cfg.setNunjucksEnvironmentOptions({ autoescape: true });
  return {
    dir: { input: 'src', includes: '../../nunjucks/templates', output: '../../dist/eleventy' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk'
  };
};
