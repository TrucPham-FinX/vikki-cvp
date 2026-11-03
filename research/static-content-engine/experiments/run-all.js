#!/usr/bin/env node
/**
 * Renders the landing + document page for vi/en with every engine into dist/<engine>/<locale>/.
 * Usage: node run-all.js [engine ...]
 */
const fs = require('fs');
const path = require('path');
const { prepare } = require('./lib/prepare');

const ENGINES = ['handlebars', 'nunjucks', 'liquid', 'eta', 'preact'];
const LOCALES = ['vi', 'en'];

function loadViewModels() {
  const ui = require('./fixtures/ui.json');
  return LOCALES.map((l) => prepare(require(`./fixtures/page.${l}.json`), ui));
}

async function renderEngine(name, vms) {
  const { createRenderer } = require(`./engines/${name}/render`);
  const r = await createRenderer();
  const out = [];
  for (const vm of vms) {
    const dir = path.join(__dirname, 'dist', name, vm.locale);
    fs.mkdirSync(dir, { recursive: true });
    const landing = await r.renderLanding(vm);
    const doc = await r.renderDocument(vm);
    fs.writeFileSync(path.join(dir, 'index.html'), landing);
    fs.writeFileSync(path.join(dir, 'tc.html'), doc);
    out.push({ locale: vm.locale, landingBytes: landing.length, docBytes: doc.length });
  }
  return out;
}

async function main() {
  const only = process.argv.slice(2);
  const vms = loadViewModels();
  for (const name of only.length ? only : ENGINES) {
    try {
      const res = await renderEngine(name, vms);
      console.log(`✓ ${name.padEnd(10)} ${res.map((r) => `${r.locale}: index ${r.landingBytes}B, tc ${r.docBytes}B`).join(' | ')}`);
    } catch (e) {
      console.log(`✗ ${name.padEnd(10)} ${e.message.split('\n')[0]}`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) main();
module.exports = { ENGINES, LOCALES, loadViewModels };
