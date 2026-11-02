const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { registerAllHelpers } = require('./helpers');
const { loadConfig, discoverBlocks, discoverTemplates } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function createRenderer() {
  const root = getRootPath();
  const config = loadConfig();
  const hbs = Handlebars.create();

  const blocks = discoverBlocks();
  const templates = discoverTemplates();

  // Register helpers with registry context
  registerAllHelpers(hbs, { blocks, templates });

  // Register partials recursively
  function registerPartials(dir, namespace = '') {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        registerPartials(fullPath, namespace ? `${namespace}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.hbs')) {
        const baseName = entry.name.replace('.hbs', '');
        const partialName = namespace ? `${namespace}/${baseName}` : baseName;
        hbs.registerPartial(partialName, fs.readFileSync(fullPath, 'utf8'));
      }
    }
  }

  const componentsDir = path.join(root, config.blocks || 'front-end/components');
  const layoutsDir = path.join(root, config.layouts || 'front-end/layouts');

  registerPartials(componentsDir);
  registerPartials(layoutsDir);

  /**
   * Render an entry with its layout/template
   */
  function renderEntry({ data, templatePath, layoutName, pageName, templateName }) {
    let body = '';
    if (templatePath && fs.existsSync(templatePath)) {
      const tplSource = fs.readFileSync(templatePath, 'utf8');
      const tpl = hbs.compile(tplSource);
      body = tpl(data);
    }

    const effectiveLayout = layoutName || data.layout || 'base';
    const layoutCandidates = [
      path.join(layoutsDir, `${effectiveLayout}.hbs`),
      path.join(layoutsDir, 'base.hbs')
    ];

    let layoutPath = layoutCandidates.find((p) => fs.existsSync(p));
    if (!layoutPath) {
      layoutPath = path.join(layoutsDir, 'base.hbs');
    }

    const layoutSource = fs.readFileSync(layoutPath, 'utf8');
    const layoutTpl = hbs.compile(layoutSource);

    return layoutTpl({
      ...data,
      body,
      page: pageName || '',
      template: templateName || ''
    });
  }

  return {
    hbs,
    registerPartials,
    renderEntry
  };
}

module.exports = {
  createRenderer
};
