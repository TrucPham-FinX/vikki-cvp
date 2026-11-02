const fs = require('fs');
const path = require('path');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function loadConfig() {
  const root = getRootPath();
  const configPath = path.join(root, 'cvp.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {
    contentTypes: 'content-types',
    blocks: 'front-end/components',
    layouts: 'front-end/layouts',
    pages: 'front-end/pages',
    data: 'front-end/data',
    output: 'vikki-cvp'
  };
}

function findFilesRecursive(dir, filterFn, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFilesRecursive(full, filterFn, fileList);
    } else if (filterFn(entry.name)) {
      fileList.push(full);
    }
  }
  return fileList;
}

function discoverContentTypes() {
  const root = getRootPath();
  const ctDir = path.join(root, 'content-types');
  const schemas = {};

  if (!fs.existsSync(ctDir)) return schemas;

  const files = fs.readdirSync(ctDir).filter((f) => f.endsWith('.schema.json') || f.endsWith('_defs.json'));
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(ctDir, file), 'utf8'));
    const id = content.$id || file.replace('.schema.json', '');
    schemas[id] = {
      id,
      file,
      path: path.join(ctDir, file),
      schema: content
    };
  }
  return schemas;
}

function discoverBlocks() {
  const root = getRootPath();
  const config = loadConfig();
  const blocksDir = path.join(root, config.blocks || 'front-end/components');
  const blockFiles = findFilesRecursive(blocksDir, (name) => name.endsWith('.block.json'));
  const blocks = {};

  for (const file of blockFiles) {
    const blockData = JSON.parse(fs.readFileSync(file, 'utf8'));
    const type = blockData.type;
    const relPath = path.relative(root, file);
    blocks[type] = {
      ...blockData,
      filePath: relPath,
      templatePath: file.replace('.block.json', '.hbs')
    };
  }
  return blocks;
}

function discoverTemplates() {
  const root = getRootPath();
  const config = loadConfig();
  const layoutsDir = path.join(root, config.layouts || 'front-end/layouts');
  const layouts = {};

  if (fs.existsSync(layoutsDir)) {
    const files = fs.readdirSync(layoutsDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      const name = file.replace('.hbs', '');
      layouts[name] = {
        name,
        file,
        path: path.relative(root, path.join(layoutsDir, file))
      };
    }
  }
  return layouts;
}

function buildRegistry() {
  const contentTypes = discoverContentTypes();
  const blocks = discoverBlocks();
  const templates = discoverTemplates();

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    contentTypes,
    blocks,
    templates
  };
}

module.exports = {
  loadConfig,
  discoverContentTypes,
  discoverBlocks,
  discoverTemplates,
  buildRegistry
};
