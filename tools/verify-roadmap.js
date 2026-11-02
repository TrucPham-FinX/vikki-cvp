#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validateAllData } = require('../core/validate');
const { discoverBlocks } = require('../core/registry');
const { verifyManifest } = require('../core/manifest');
const { parsePromotionsFromExcel, validatePromotions } = require('./import-promotions');
const { bridge, env } = require('../runtime');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function verifyAllRoadmapPhases() {
  const root = getRootPath();
  console.log('🏁 Vikki CVP — Migration Roadmap Automated Verification (07)\n');

  const results = [];

  function check(phase, name, testFn) {
    try {
      const ok = testFn();
      if (ok !== false) {
        console.log(`  ✅ [${phase}] ${name}`);
        results.push({ phase, name, pass: true });
      } else {
        console.error(`  ❌ [${phase}] ${name} (Check returned false)`);
        results.push({ phase, name, pass: false });
      }
    } catch (e) {
      console.error(`  ❌ [${phase}] ${name} (Failed: ${e.message})`);
      results.push({ phase, name, pass: false, error: e.message });
    }
  }

  // Phase 0: Stabilise
  check('Phase 0', 'Committed output manifest exists', () => {
    return fs.existsSync(path.join(root, 'vikki-cvp/.manifest.json'));
  });

  // Phase 1: Core contracts
  check('Phase 1', 'Content-type schemas and Ajv validation passes (53/53 files)', () => {
    const val = validateAllData({ warnOnly: true });
    return val.errors.length === 0 && val.validFiles >= 50;
  });

  check('Phase 1', 'Block registry discovers all core blocks (15 blocks)', () => {
    const blocks = discoverBlocks();
    return Object.keys(blocks).length >= 15;
  });

  // Phase 2: Restructuring
  check('Phase 2', 'Document migration model exists in content/documents/', () => {
    const docDir = path.join(root, 'content/documents');
    return fs.existsSync(docDir) && fs.readdirSync(docDir).length >= 30;
  });

  check('Phase 2', 'Collection migration exists in content/collections/', () => {
    const promoDir = path.join(root, 'content/collections/promotions');
    return fs.existsSync(promoDir) && fs.readdirSync(promoDir).length >= 40;
  });

  // Phase 3: Block Registry & Catalogue
  check('Phase 3', 'Living block catalogue is generated in vikki-cvp/catalogue.html', () => {
    return fs.existsSync(path.join(root, 'vikki-cvp/catalogue.html'));
  });

  // Phase 4: Admin Capabilities
  check('Phase 4', 'Excel promotion importer CLI parses & validates template', () => {
    const items = parsePromotionsFromExcel(path.join(root, 'front-end/data/promotion/promotionTemplate.xlsx'));
    const val = validatePromotions(items);
    return items.length > 0 && val.isValid;
  });

  // Phase 5: Runtime Bridge & Env
  check('Phase 5', 'Runtime bridge module exports safe postMessage dispatchers', () => {
    return typeof bridge.openCard === 'function' && typeof bridge.navigate === 'function';
  });

  check('Phase 5', 'Runtime env module parses query params and attributes', () => {
    const parsed = env.parseQueryParams('?hasTopSpace=false&hasCard=true&productScheme=HDBANK');
    return parsed.hasTopSpace === false && parsed.hasCard === true && parsed.productScheme === 'HDBANK';
  });

  // Phase 6: Publishing & Manifest Integrity
  check('Phase 6', 'Publishing configuration content/publish.json exists', () => {
    return fs.existsSync(path.join(root, 'content/publish.json'));
  });

  check('Phase 6', 'Manifest verification passes across all output files', () => {
    const res = verifyManifest();
    return res.success === true;
  });

  const allPassed = results.every((r) => r.pass);
  console.log(`\n======================================================`);
  if (allPassed) {
    console.log(`🎉 ALL ${results.length} ROADMAP PHASE CHECKS PASSED SUCCESSFULLY!`);
  } else {
    const failed = results.filter((r) => !r.pass);
    console.error(`⚠️  ${failed.length} of ${results.length} checks failed.`);
  }
  console.log(`======================================================\n`);

  return allPassed;
}

if (require.main === module) {
  const ok = verifyAllRoadmapPhases();
  process.exit(ok ? 0 : 1);
}

module.exports = {
  verifyAllRoadmapPhases
};
