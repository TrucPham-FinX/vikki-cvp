const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

/**
 * Assembler writes page HTML and associated assets to the target output directory
 */
function assemblePage({ pageName, outputName, html, outDir }) {
  const root = getRootPath();
  const config = loadConfig();
  const baseOutDir = outDir || path.join(root, config.output || 'vikki-cvp');
  const targetDir = pageName ? path.join(baseOutDir, pageName) : baseOutDir;

  fs.mkdirSync(targetDir, { recursive: true });
  const finalPath = path.join(targetDir, outputName);
  fs.writeFileSync(finalPath, html, 'utf8');

  return {
    path: finalPath,
    relPath: path.relative(root, finalPath),
    size: Buffer.byteLength(html, 'utf8')
  };
}

/**
 * Copy local assets from page data folder to output if needed
 */
function copyPageAssets(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) return [];

  fs.mkdirSync(destDir, { recursive: true });
  const copied = [];
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copied.push(...copyPageAssets(src, dst));
    } else {
      fs.copyFileSync(src, dst);
      copied.push(dst);
    }
  }

  return copied;
}

module.exports = {
  assemblePage,
  copyPageAssets
};
