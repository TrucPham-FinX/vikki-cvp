const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./registry');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

/**
 * Resolves $ref string to target URL or document path
 * Examples:
 *   "document:home-loan-cvp-tc" -> "/vikki-cvp/home-loan-cvp/tc.html"
 *   "page:vikki-one-connect"    -> "/vikki-cvp/vikki-one-connect/index.html"
 */
function resolveRef(refStr, entryContext = {}) {
  if (typeof refStr !== 'string') return refStr;

  if (refStr.startsWith('links.') && entryContext.links) {
    const key = refStr.replace('links.', '');
    const nested = entryContext.links[key];
    return nested && nested.$ref ? resolveRef(nested.$ref, entryContext) : nested;
  }

  if (refStr.startsWith('document:')) {
    const docId = refStr.replace('document:', '');
    const parts = docId.split('-');
    const lastPart = parts[parts.length - 1];
    const docType = lastPart === 'fee' ? 'fee' : 'tc';
    const pageSlug = parts.slice(0, parts.length - 1).join('-');
    return `/vikki-cvp/${pageSlug}/${docType}.html`;
  }

  if (refStr.startsWith('page:')) {
    const slug = refStr.replace('page:', '');
    return `/vikki-cvp/${slug}/index.html`;
  }

  return refStr;
}

/**
 * Resolves collection queries like:
 * { "$source": "promotions", "where": { "category": "VIKKI_ONE" }, "limit": 6 }
 */
function resolveCollectionQuery(query, rootDir) {
  const root = rootDir || getRootPath();
  const source = query.$source;

  if (source === 'promotions') {
    const listPath = path.join(root, 'front-end/data/promotion/list.json');
    if (!fs.existsSync(listPath)) return [];

    const data = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    let items = data.items || [];

    if (query.where) {
      if (query.where.category) {
        items = items.filter((it) =>
          it.promotionCate && it.promotionCate.includes(query.where.category)
        );
      }
      if (query.where.group) {
        items = items.filter((it) => it.promotionGroup === query.where.group);
      }
    }

    if (typeof query.limit === 'number') {
      items = items.slice(0, query.limit);
    }

    return items;
  }

  if (source === 'card-intro') {
    const listPath = path.join(root, 'front-end/data/card-intro/list.json');
    if (!fs.existsSync(listPath)) return [];
    const data = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    return data.items || [];
  }

  return [];
}

/**
 * Substitute environment variables like {{env.cdnHost}}
 */
function substituteEnv(contentStr, envName = 'dev') {
  if (typeof contentStr !== 'string') return contentStr;
  const config = loadConfig();
  const envConfig = (config.environments && config.environments[envName]) || {};
  const cdnHost = envConfig.cdnHost || '';

  return contentStr
    .replace(/\{\{env\.cdnHost\}\}/g, cdnHost)
    .replace(/\{\{env\.name\}\}/g, envName);
}

/**
 * Deeply traverses data model and resolves $ref, collection queries, and env variables
 */
function resolveData(data, options = {}) {
  const { envName = 'dev', rootDir = getRootPath() } = options;

  function walk(node) {
    if (node === null || typeof node !== 'object') {
      if (typeof node === 'string') {
        return substituteEnv(node, envName);
      }
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }

    // Check if node is a $ref object
    if (node.$ref && typeof node.$ref === 'string') {
      return resolveRef(node.$ref, data);
    }

    // Check if node is a collection query
    if (node.$source && typeof node.$source === 'string') {
      return resolveCollectionQuery(node, rootDir);
    }

    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v);
    }
    return out;
  }

  return walk(data);
}

module.exports = {
  resolveRef,
  resolveCollectionQuery,
  substituteEnv,
  resolveData
};
