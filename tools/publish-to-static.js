#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildAll } = require('../core/build');
const { loadConfig } = require('../core/registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

/**
 * Stage A Publisher (09 §4)
 * Publishes built CVP content into the static delivery repo folder
 */
function publishToStaticRepo({ env = 'dev', staticRepoPath, dryRun = false } = {}) {
  const root = getRootPath();
  const config = loadConfig();

  const envConfig = config.environments && config.environments[env];
  if (!envConfig) {
    throw new Error(`Environment "${env}" not defined in cvp.config.json`);
  }

  console.log(`🚀 CVP Publisher -> Static Repo (09 §4)`);
  console.log(`🌐 Target Environment: ${env}`);
  console.log(`🔗 Target Folder: ${envConfig.target}`);

  // 1. Build for the specific environment
  console.log(`\n📦 Building outputs for [${env}]...`);
  buildAll({ env, skipValidation: false });

  // 2. Identify destination directory
  const destDir = staticRepoPath
    ? path.resolve(staticRepoPath, envConfig.target)
    : path.resolve(root, '../non-prod-workload-cloudfront-static-contents', envConfig.target);

  const sourceDir = path.join(root, config.output || 'vikki-cvp');

  console.log(`📂 Source: ${path.relative(root, sourceDir)}`);
  console.log(`🎯 Destination: ${destDir}`);

  if (dryRun) {
    console.log('✨ Dry run mode enabled. No files written to delivery repo.');
    return;
  }

  if (!fs.existsSync(destDir)) {
    console.log(`📁 Target directory does not exist yet. Creating: ${destDir}`);
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Copy files recursively
  function copyRecursive(src, dst) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        count += copyRecursive(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
        count++;
      }
    }
    return count;
  }

  const copiedFiles = copyRecursive(sourceDir, destDir);
  console.log(`✅ Successfully published ${copiedFiles} files to ${destDir}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='));
  const env = envArg ? envArg.split('=')[1] : 'dev';
  const repoArg = args.find((a) => a.startsWith('--static-repo='));
  const staticRepoPath = repoArg ? repoArg.split('=')[1] : null;
  const dryRun = args.includes('--dry-run');

  try {
    publishToStaticRepo({ env, staticRepoPath, dryRun });
  } catch (err) {
    console.error(`❌ Publish to static repo failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  publishToStaticRepo
};
