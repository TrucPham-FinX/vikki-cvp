const fs = require('fs');
const path = require('path');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

/**
 * Loads a theme by ID and returns its CSS declarations
 * @param {string} themeId Theme ID (e.g. 'cvp-loan', 'cvp-card')
 * @returns {string} CSS block string
 */
function getThemeCss(themeId = 'cvp-default') {
  const root = getRootPath();
  const themeFile = path.join(root, 'themes', `${themeId}.json`);

  if (!fs.existsSync(themeFile)) {
    return '';
  }

  const themeData = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
  const tokens = themeData.tokens || {};

  const lines = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

module.exports = {
  getThemeCss
};
