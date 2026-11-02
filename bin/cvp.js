#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

const COMMANDS = {
  build: 'core/build.js',
  validate: 'core/validate.js',
  inventory: 'core/inventory.js',
  manifest: 'core/manifest.js',
  catalogue: 'tools/catalogue.js',
  import: 'tools/import-promotions.js',
  publish: 'core/publish.js',
  test: 'tools/verify-roadmap.js'
};

if (command === 'help' || !COMMANDS[command]) {
  console.log(`
Usage: cvp <command> [options]

Commands:
  build       Run target build pipeline (validate -> resolve -> render -> assemble)
  validate    Validate all content against JSON schemas and contracts
  inventory   Show inventory report and export registry.json
  manifest    Generate, verify, or audit output manifest (.manifest.json)
  catalogue   Generate living component and block catalogue (catalogue.html)
  import      Import promotions from Excel with validation
  publish     Publish outputs for dev, uat, or stg
  test        Verify all migration roadmap phases (0 to 6)
  help        Show this help message
`);
  process.exit(command === 'help' ? 0 : 1);
}

const targetScript = path.join(root, COMMANDS[command]);
const result = spawnSync('node', [targetScript, ...args], {
  stdio: 'inherit',
  cwd: root
});

process.exit(result.status || 0);
