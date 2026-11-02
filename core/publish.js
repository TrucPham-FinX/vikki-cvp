#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildAll } = require('./build');
const { loadConfig } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function loadPublishConfig() {
  const root = getRootPath();
  const publishPath = path.join(root, 'content/publish.json');
  if (fs.existsSync(publishPath)) {
    return JSON.parse(fs.readFileSync(publishPath, 'utf8'));
  }
  return { pages: {} };
}

/**
 * Publish build outputs to target environment directory
 * @param {string} env 'dev' | 'uat' | 'stg'
 */
function publishToEnv(env = 'dev') {
  const root = getRootPath();
  const config = loadConfig();
  const publishConfig = loadPublishConfig();

  console.log(`🚀 Publishing CVP Content to environment [${env}]...`);
  const envConfig = (config.environments && config.environments[env]) || {};
  console.log(`🌐 Target CDN Host: ${envConfig.cdnHost || '(local)'}`);

  const activePages = Object.entries(publishConfig.pages || {})
    .filter(([_, envMap]) => envMap[env] !== false && envMap[env] !== undefined)
    .map(([page]) => page);

  console.log(`📄 Active pages for ${env} (${activePages.length}): ${activePages.join(', ')}`);

  const result = buildAll({ env, skipValidation: false });
  console.log(`\n✅ Published ${result.pageCount} pages for [${env}] environment.`);
  return result;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='));
  const env = envArg ? envArg.split('=')[1] : 'dev';

  try {
    publishToEnv(env);
  } catch (err) {
    console.error(`❌ Publish Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  loadPublishConfig,
  publishToEnv
};
