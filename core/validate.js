const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { discoverContentTypes, discoverBlocks, loadConfig } = require('./registry');

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const contentTypes = discoverContentTypes();
  for (const [id, item] of Object.entries(contentTypes)) {
    try {
      ajv.addSchema(item.schema, id);
    } catch (e) {
      // Ignore if already added
    }
  }

  const blocks = discoverBlocks();
  for (const [type, block] of Object.entries(blocks)) {
    if (block.props) {
      try {
        ajv.addSchema(block.props, `block:${type}`);
      } catch (e) {
        // Ignore
      }
    }
  }

  return { ajv, blocks };
}

function classifyDataFile(filePath, content) {
  const baseName = path.basename(filePath);
  const dirName = path.basename(path.dirname(filePath));

  if (dirName === 'promotion' && baseName === 'list.json') {
    return { type: 'collection', itemSchema: 'cvp:promotion', collectionKey: 'items' };
  }
  if (dirName === 'card-intro' && baseName === 'list.json') {
    return { type: 'collection', itemSchema: 'cvp:card-intro', collectionKey: 'items' };
  }
  if (
    baseName.startsWith('tc') ||
    baseName.startsWith('fee') ||
    baseName.startsWith('claim') ||
    baseName.startsWith('insurance-wording')
  ) {
    return { type: 'document', schema: 'cvp:document' };
  }

  if (content && typeof content === 'object') {
    if (content.components || content.qaGroup || content.layout === 'template' || content.layout === 'base') {
      return { type: 'landing-page', schema: 'cvp:landing-page' };
    }
  }

  return { type: 'landing-page', schema: 'cvp:landing-page' };
}

function validateAllData({ warnOnly = false } = {}) {
  const root = path.resolve(__dirname, '..');
  const config = loadConfig();
  const dataDir = path.join(root, config.data || 'front-end/data');

  const { ajv, blocks } = createValidator();
  const results = {
    totalFiles: 0,
    validFiles: 0,
    errors: [],
    warnings: [],
    blockValidation: {
      totalBlocks: 0,
      validBlocks: 0,
      unknownBlocks: 0,
      blockErrors: []
    }
  };

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        validateFile(full);
      }
    }
  }

  function validateFile(filePath) {
    results.totalFiles++;
    const relPath = path.relative(root, filePath);
    let data;

    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      results.errors.push({ file: relPath, message: `JSON syntax error: ${e.message}` });
      return;
    }

    const classification = classifyDataFile(filePath, data);

    if (classification.type === 'collection') {
      const items = data[classification.collectionKey] || [];
      const validateItem = ajv.getSchema(classification.itemSchema);

      items.forEach((item, index) => {
        if (validateItem && !validateItem(item)) {
          validateItem.errors.forEach((err) => {
            results.errors.push({
              file: relPath,
              path: `/${classification.collectionKey}/${index}${err.instancePath}`,
              message: `${err.message} (${JSON.stringify(err.params)})`
            });
          });
        }
      });
    } else {
      const validate = ajv.getSchema(classification.schema);
      if (validate && !validate(data)) {
        validate.errors.forEach((err) => {
          results.errors.push({
            file: relPath,
            path: err.instancePath,
            message: `${err.message} (${JSON.stringify(err.params)})`
          });
        });
      }

      if (Array.isArray(data.components)) {
        data.components.forEach((component, idx) => {
          results.blockValidation.totalBlocks++;
          const blockType = component.type;
          const blockDef = blocks[blockType];

          if (!blockDef) {
            results.blockValidation.unknownBlocks++;
            results.warnings.push({
              file: relPath,
              path: `/components/${idx}`,
              message: `Unknown block type: "${blockType}"`
            });
            return;
          }

          const blockValidator = ajv.getSchema(`block:${blockType}`);
          if (blockValidator && !blockValidator(component)) {
            blockValidator.errors.forEach((err) => {
              results.blockValidation.blockErrors.push({
                file: relPath,
                path: `/components/${idx}${err.instancePath}`,
                message: `[${blockType}] ${err.message}`
              });
            });
          } else {
            results.blockValidation.validBlocks++;
          }
        });
      }
    }

    lintContent(relPath, data);

    if (!results.errors.some((e) => e.file === relPath)) {
      results.validFiles++;
    }
  }

  const idMap = new Map();
  const lintResults = {
    duplicateIds: [],
    hardcodedEnvUrls: [],
    brokenAssets: []
  };

  const ENV_URL_REGEX = /(?:https?:)?\/\/[a-zA-Z0-9.-]*(?:sit|uat)[a-zA-Z0-9.-]*(?:\.galaxyfinx\.cloud|\.vikkibank\.vn)/i;

  function lintContent(relPath, obj) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.id && typeof obj.id === 'string') {
      const existing = idMap.get(obj.id) || [];
      existing.push(relPath);
      idMap.set(obj.id, existing);
    }

    function scanStrings(val, currentPath = '') {
      if (typeof val === 'string') {
        if (ENV_URL_REGEX.test(val)) {
          const match = val.match(ENV_URL_REGEX);
          lintResults.hardcodedEnvUrls.push({
            file: relPath,
            path: currentPath,
            url: match[0],
            message: `Hardcoded environment host found: "${match[0]}". Use $ref or {{env.cdnHost}} instead.`
          });
        }
      } else if (Array.isArray(val)) {
        val.forEach((item, idx) => scanStrings(item, `${currentPath}[${idx}]`));
      } else if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          scanStrings(v, currentPath ? `${currentPath}.${k}` : k);
        }
      }
    }

    scanStrings(obj);
  }

  walk(dataDir);

  // Check duplicate IDs
  for (const [id, files] of idMap.entries()) {
    if (files.length > 1) {
      lintResults.duplicateIds.push({
        id,
        files,
        message: `Duplicate ID "${id}" detected across multiple files: ${files.join(', ')}`
      });
    }
  }

  results.lint = lintResults;
  return results;
}

if (require.main === module) {
  const isLintMode = process.argv.includes('--lint');
  console.log('🔍 Validating all CVP content against schemas & block contracts...\n');
  const results = validateAllData({ warnOnly: true });

  console.log(`📁 Files scanned: ${results.totalFiles}`);
  console.log(`✅ Valid files: ${results.validFiles}`);
  console.log(`🧱 Blocks inspected: ${results.blockValidation.totalBlocks}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nValidation Errors:');
    results.errors.slice(0, 20).forEach((err) => {
      console.log(`  - ${err.file}${err.path ? ' ' + err.path : ''}: ${err.message}`);
    });
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more errors`);
    }
  }

  if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    results.warnings.slice(0, 10).forEach((w) => {
      console.log(`  - ${w.file} ${w.path}: ${w.message}`);
    });
  }

  if (isLintMode && results.lint) {
    console.log('\n🧹 Content Linting Report (R10):');
    if (results.lint.duplicateIds.length > 0) {
      console.log(`\n  ⚠️  Duplicate IDs (${results.lint.duplicateIds.length}):`);
      results.lint.duplicateIds.forEach((dup) => {
        console.log(`    - ID "${dup.id}": ${dup.files.join(' <-> ')}`);
      });
    } else {
      console.log('  ✅ No duplicate IDs found.');
    }

    if (results.lint.hardcodedEnvUrls.length > 0) {
      console.log(`\n  ⚠️  Hardcoded Environment URLs (${results.lint.hardcodedEnvUrls.length}):`);
      results.lint.hardcodedEnvUrls.forEach((h) => {
        console.log(`    - ${h.file} (${h.path}): ${h.url}`);
      });
    } else {
      console.log('  ✅ No hardcoded environment URLs found.');
    }
  }

  console.log('\nValidation complete.');
}

module.exports = {
  createValidator,
  classifyDataFile,
  validateAllData
};
