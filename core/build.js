#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validateAllData } = require('./validate');
const { resolveData } = require('./resolve');
const { createRenderer } = require('./render');
const { assemblePage } = require('./assemble');
const { generateManifest } = require('./manifest');
const { loadConfig } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

/**
 * Modern CVP Target Build Pipeline
 * Stages:
 *   1. Validate (Ajv schema validation + block checks)
 *   2. Resolve ($ref, collections, env substitution)
 *   3. Render (Handlebars + shell + block registry dispatch)
 *   4. Assemble (HTML assembly, asset management)
 *   5. Manifest (Checksums & integrity tracking)
 */
function buildAll({ env = 'dev', skipValidation = false } = {}) {
  const root = getRootPath();
  const config = loadConfig();
  console.log(`🚀 Starting CVP Build Pipeline [Target Architecture] (env: ${env})...\n`);

  // 1. Validate
  if (!skipValidation) {
    console.log('🔍 [1/5] Validating content against schemas...');
    const validation = validateAllData({ warnOnly: true });
    if (validation.errors.length > 0) {
      console.error(`❌ Validation failed with ${validation.errors.length} error(s).`);
      throw new Error(`Build aborted due to content validation errors.`);
    }
    console.log(`✅ ${validation.validFiles}/${validation.totalFiles} data files passed validation.`);
  } else {
    console.log('⏭️  [1/5] Skipping validation (skipValidation=true)');
  }

  // 2. Initialize Renderer
  console.log('🎨 [2/5] Initializing Renderer & Registry...');
  const renderer = createRenderer();

  // 3. Render and Assemble Pages
  console.log('⚙️  [3/5] Resolving & Rendering pages...');
  const pagesDir = path.join(root, config.pages || 'front-end/pages');
  const dataDir = path.join(root, config.data || 'front-end/data');
  const outDir = path.join(root, config.output || 'vikki-cvp');

  let pageCount = 0;

  if (fs.existsSync(pagesDir)) {
    const pageFolders = fs.readdirSync(pagesDir).filter((f) => {
      return fs.statSync(path.join(pagesDir, f)).isDirectory();
    });

    for (const pageName of pageFolders) {
      const pageDirPath = path.join(pagesDir, pageName);
      const hbsFiles = fs.readdirSync(pageDirPath).filter((f) => f.endsWith('.hbs'));
      if (!hbsFiles.length) continue;

      for (const hbsFile of hbsFiles) {
        const templateName = path.basename(hbsFile, '.hbs');
        if (templateName === 'detail') continue;

        // Load data candidate
        const dataCandidates = [
          path.join(dataDir, pageName, `${templateName}.json`),
          path.join(dataDir, pageName, 'index.json'),
          path.join(dataDir, pageName, `${pageName}.json`),
          path.join(dataDir, pageName, 'list.json')
        ];

        let rawData = {};
        for (const cand of dataCandidates) {
          if (fs.existsSync(cand)) {
            rawData = JSON.parse(fs.readFileSync(cand, 'utf8'));
            break;
          }
        }

        // Resolve data ($ref, collections, env variables)
        const resolvedData = resolveData(rawData, { envName: env, rootDir: root });

        // Render page
        const templatePath = path.join(pageDirPath, hbsFile);
        const html = renderer.renderEntry({
          data: resolvedData,
          templatePath,
          layoutName: resolvedData.layout,
          pageName,
          templateName
        });

        // Assemble page
        assemblePage({
          pageName,
          outputName: `${templateName}.html`,
          html,
          outDir
        });

        pageCount++;
      }
    }
  }

  console.log(`✅ [4/5] Successfully rendered and assembled ${pageCount} pages.`);

  // 5. Generate Manifest
  console.log('📦 [5/5] Generating Build Manifest...');
  const { manifest } = generateManifest();
  console.log(`✅ Build manifest recorded: ${manifest.totalFiles} files (${(manifest.totalBytes / 1024).toFixed(1)} KB)`);

  console.log('\n✨ CVP Pipeline Build Complete.');
  return { success: true, pageCount, totalFiles: manifest.totalFiles };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='));
  const env = envArg ? envArg.split('=')[1] : 'dev';
  const skipValidation = args.includes('--skip-validation');

  try {
    buildAll({ env, skipValidation });
  } catch (err) {
    console.error(`\n❌ Build Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  buildAll
};
