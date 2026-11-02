#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadConfig } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function calculateFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function findFilesRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFilesRecursive(full, fileList);
    } else if (entry.isFile() && !entry.name.startsWith('.manifest')) {
      fileList.push(full);
    }
  }
  return fileList;
}

function generateManifest() {
  const root = getRootPath();
  const config = loadConfig();
  const outDir = path.join(root, config.output || 'vikki-cvp');

  if (!fs.existsSync(outDir)) {
    throw new Error(`Output directory does not exist: ${outDir}`);
  }

  const allFiles = findFilesRecursive(outDir);
  const filesMap = {};
  let totalBytes = 0;

  allFiles.sort().forEach((file) => {
    const rel = path.relative(outDir, file);
    const stat = fs.statSync(file);
    const sha256 = calculateFileSha256(file);
    totalBytes += stat.size;

    filesMap[rel] = {
      sha256,
      size: stat.size,
      mtime: stat.mtime.toISOString()
    };
  });

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    outputDir: config.output || 'vikki-cvp',
    totalFiles: Object.keys(filesMap).length,
    totalBytes,
    files: filesMap
  };

  const manifestPath = path.join(outDir, '.manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, manifestPath };
}

function verifyManifest() {
  const root = getRootPath();
  const config = loadConfig();
  const outDir = path.join(root, config.output || 'vikki-cvp');
  const manifestPath = path.join(outDir, '.manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest file not found at ${manifestPath}. Run manifest generation first.`);
    return { success: false, reason: 'missing_manifest' };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const recordedFiles = manifest.files || {};
  const currentFiles = findFilesRecursive(outDir);

  const currentMap = new Map();
  currentFiles.forEach((file) => {
    const rel = path.relative(outDir, file);
    currentMap.set(rel, calculateFileSha256(file));
  });

  const modified = [];
  const missing = [];
  const untracked = [];

  for (const [rel, meta] of Object.entries(recordedFiles)) {
    if (!currentMap.has(rel)) {
      missing.push(rel);
    } else if (currentMap.get(rel) !== meta.sha256) {
      modified.push(rel);
    }
  }

  for (const rel of currentMap.keys()) {
    if (!recordedFiles[rel]) {
      untracked.push(rel);
    }
  }

  const isClean = modified.length === 0 && missing.length === 0 && untracked.length === 0;

  console.log('📋 Vikki CVP Manifest Verification');
  console.log(`📁 Directory: ${path.relative(root, outDir)}`);
  console.log(`📄 Manifest recorded: ${Object.keys(recordedFiles).length} files`);
  console.log(`🔍 Current on disk: ${currentMap.size} files`);

  if (isClean) {
    console.log('✅ Manifest verification passed. All files byte-identical to manifest.');
    return { success: true };
  }

  console.error('\n❌ Manifest verification failed:');
  if (modified.length > 0) {
    console.error(`  - Modified (${modified.length}):`);
    modified.slice(0, 10).forEach((f) => console.error(`      * ${f}`));
  }
  if (missing.length > 0) {
    console.error(`  - Missing (${missing.length}):`);
    missing.slice(0, 10).forEach((f) => console.error(`      * ${f}`));
  }
  if (untracked.length > 0) {
    console.error(`  - Untracked/Orphaned (${untracked.length}):`);
    untracked.slice(0, 10).forEach((f) => console.error(`      * ${f}`));
  }

  return { success: false, modified, missing, untracked };
}

function checkOrphans() {
  const root = getRootPath();
  const config = loadConfig();
  const outDir = path.join(root, config.output || 'vikki-cvp');
  const promoListPath = path.join(root, 'front-end/data/promotion/list.json');

  console.log('🔍 Checking for orphaned HTML files in build output...');

  const validPromoIds = new Set();
  if (fs.existsSync(promoListPath)) {
    const data = JSON.parse(fs.readFileSync(promoListPath, 'utf8'));
    (data.items || []).forEach((item) => {
      if (item.id) validPromoIds.add(item.id);
    });
  }

  const promoOutDir = path.join(outDir, 'promotion');
  const orphans = [];

  if (fs.existsSync(promoOutDir)) {
    const promoFiles = fs.readdirSync(promoOutDir).filter((f) => f.startsWith('promo-') && f.endsWith('.html'));
    promoFiles.forEach((file) => {
      const id = file.replace('.html', '');
      if (!validPromoIds.has(id)) {
        orphans.push(`promotion/${file}`);
      }
    });
  }

  if (orphans.length === 0) {
    console.log(`✅ No orphaned promotion pages found. All ${validPromoIds.size} active promos match output.`);
    return { success: true, orphans: [] };
  } else {
    console.warn(`⚠️  Found ${orphans.length} orphaned promotion pages:`);
    orphans.forEach((o) => console.warn(`  - ${o}`));
    return { success: false, orphans };
  }
}

function cleanOrphans() {
  const root = getRootPath();
  const config = loadConfig();
  const outDir = path.join(root, config.output || 'vikki-cvp');
  const { orphans } = checkOrphans();

  if (orphans.length === 0) {
    console.log('✨ Output directory is already clean. No orphans to remove.');
    return;
  }

  console.log(`\n🧹 Removing ${orphans.length} orphaned files from ${path.relative(root, outDir)}...`);
  orphans.forEach((rel) => {
    const full = path.join(outDir, rel);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      console.log(`  🗑️ Removed: ${rel}`);
    }
  });

  console.log('✅ Clean complete. Regenerating manifest...');
  generateManifest();
}

function runCLI() {
  const args = process.argv.slice(2);
  const root = getRootPath();

  if (args.includes('--verify')) {
    const res = verifyManifest();
    process.exit(res.success ? 0 : 1);
  } else if (args.includes('--check-orphans')) {
    const res = checkOrphans();
    process.exit(res.success ? 0 : 1);
  } else if (args.includes('--clean-orphans')) {
    cleanOrphans();
  } else {
    console.log('📦 Generating Vikki CVP Build Manifest...');
    const { manifest, manifestPath } = generateManifest();
    console.log(`✅ Generated manifest with ${manifest.totalFiles} files (${(manifest.totalBytes / 1024).toFixed(1)} KB)`);
    console.log(`📄 Saved to: ${path.relative(root, manifestPath)}`);
  }
}

if (require.main === module) {
  runCLI();
}

module.exports = {
  generateManifest,
  verifyManifest,
  checkOrphans
};
