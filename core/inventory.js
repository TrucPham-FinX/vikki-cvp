const fs = require('fs');
const path = require('path');
const { buildRegistry, loadConfig } = require('./registry');

function generateInventory() {
  const root = path.resolve(__dirname, '..');
  const config = loadConfig();
  const dataDir = path.join(root, config.data || 'front-end/data');
  const layoutsDir = path.join(root, config.layouts || 'front-end/layouts');
  const pagesDir = path.join(root, config.pages || 'front-end/pages');
  const outDir = path.join(root, config.output || 'vikki-cvp');

  const registry = buildRegistry();

  const inventory = {
    generatedAt: new Date().toISOString(),
    content: {
      landingPages: [],
      documents: [],
      feeSchedules: [],
      promotions: [],
      cardIntros: []
    },
    layouts: {},
    pageTemplates: {},
    blocksUsage: {},
    outputSummary: {
      totalHtml: 0,
      generated: [],
      bespoke: []
    }
  };

  // Initialize block usage counts from registry
  for (const type of Object.keys(registry.blocks)) {
    inventory.blocksUsage[type] = 0;
  }

  // Scan layouts
  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (file.endsWith('.hbs')) {
        const name = file.replace('.hbs', '');
        inventory.layouts[name] = { file, instances: 0 };
      }
    }
  }

  // Scan page templates
  if (fs.existsSync(pagesDir)) {
    for (const dir of fs.readdirSync(pagesDir)) {
      const full = path.join(pagesDir, dir);
      if (fs.statSync(full).isDirectory()) {
        const templates = fs.readdirSync(full).filter((f) => f.endsWith('.hbs'));
        inventory.pageTemplates[dir] = templates;
      }
    }
  }

  // Scan data files
  function scanData(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanData(full);
      } else if (entry.name.endsWith('.json')) {
        analyzeDataFile(full);
      }
    }
  }

  function analyzeDataFile(filePath) {
    const rel = path.relative(root, filePath);
    const base = path.basename(filePath);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return;
    }

    if (data.layout && inventory.layouts[data.layout]) {
      inventory.layouts[data.layout].instances++;
    }

    if (rel.includes('promotion/list.json')) {
      inventory.content.promotions = (data.items || []).map((i) => i.id);
      return;
    }

    if (rel.includes('card-intro/list.json')) {
      inventory.content.cardIntros = (data.items || []).map((i) => i.id);
      return;
    }

    if (base.startsWith('fee')) {
      inventory.content.feeSchedules.push(rel);
    } else if (base.startsWith('tc') || base.startsWith('claim') || base.startsWith('insurance-wording')) {
      inventory.content.documents.push(rel);
    } else {
      inventory.content.landingPages.push(rel);
    }

    // Count block usages
    if (Array.isArray(data.components)) {
      for (const comp of data.components) {
        if (comp.type) {
          inventory.blocksUsage[comp.type] = (inventory.blocksUsage[comp.type] || 0) + 1;
        }
      }
    }
  }

  scanData(dataDir);

  // Scan output directory
  if (fs.existsSync(outDir)) {
    function scanOut(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanOut(full);
        } else if (entry.name.endsWith('.html')) {
          inventory.outputSummary.totalHtml++;
          const relOut = path.relative(outDir, full);
          inventory.outputSummary.generated.push(relOut);
        }
      }
    }
    scanOut(outDir);
  }

  return { registry, inventory };
}

if (require.main === module) {
  const { registry, inventory } = generateInventory();
  const root = path.resolve(__dirname, '..');

  // Save registry.json
  const registryExport = {
    version: registry.version,
    generatedAt: registry.generatedAt,
    contentTypes: Object.keys(registry.contentTypes),
    blocks: registry.blocks,
    templates: registry.templates
  };
  fs.writeFileSync(path.join(root, 'registry.json'), JSON.stringify(registryExport, null, 2));

  console.log('📊 ==================== VIKKI CVP INVENTORY REPORT ====================\n');

  console.log('1. Content Instances:');
  console.log(`   - CVP Landing Pages:   ${inventory.content.landingPages.length} files`);
  console.log(`   - Legal Documents:     ${inventory.content.documents.length} files`);
  console.log(`   - Fee Schedules:       ${inventory.content.feeSchedules.length} files`);
  console.log(`   - Promotion Items:     ${inventory.content.promotions.length} items (in list.json)`);
  console.log(`   - Card Intro Items:    ${inventory.content.cardIntros.length} items (in list.json)`);

  console.log('\n2. Layouts Usage:');
  for (const [layout, info] of Object.entries(inventory.layouts)) {
    console.log(`   - ${layout.padEnd(20)} : ${info.instances} page(s)`);
  }

  console.log('\n3. Registered Blocks & Usages:');
  for (const [type, count] of Object.entries(inventory.blocksUsage)) {
    const block = registry.blocks[type];
    const category = block ? `[${block.category}]` : '[unregistered]';
    console.log(`   - ${type.padEnd(24)} ${category.padEnd(14)} : ${count} use(s)`);
  }

  console.log('\n4. Output Directory:');
  console.log(`   - Total HTML files in vikki-cvp/: ${inventory.outputSummary.totalHtml}`);

  console.log('\n✅ Registry exported to registry.json\n');
}

module.exports = {
  generateInventory
};
