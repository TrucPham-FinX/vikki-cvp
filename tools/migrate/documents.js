#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getRootPath() {
  return path.resolve(__dirname, '../..');
}

/**
 * Normalizes any legacy section/article structure into the unified recursive section shape:
 * { id, title, expanded, blocks: [], sections: [] }
 */
function normalizeSection(rawSection, idx) {
  const id = rawSection.id || `s-${idx + 1}`;
  const title = rawSection.title || rawSection.name || '';
  const expanded = rawSection.defaultExpanded === 'block' || rawSection.expanded === true;

  const blocks = Array.isArray(rawSection.blocks) ? rawSection.blocks : [];
  const childSections = [];

  // If section has articles[], treat articles as child sections
  if (Array.isArray(rawSection.articles)) {
    rawSection.articles.forEach((art, artIdx) => {
      childSections.push({
        id: art.id || `${id}-art-${artIdx + 1}`,
        title: art.title || '',
        expanded: art.expanded || false,
        blocks: Array.isArray(art.blocks) ? art.blocks : [],
        sections: []
      });
    });
  }

  // If section has nested sections[]
  if (Array.isArray(rawSection.sections)) {
    rawSection.sections.forEach((s, sIdx) => {
      childSections.push(normalizeSection(s, sIdx));
    });
  }

  return {
    id,
    title,
    expanded,
    blocks,
    sections: childSections
  };
}

/**
 * Normalizes a document JSON entry into the target document schema (05 §3.2)
 */
function normalizeDocument(docData, filename, slug) {
  const isFee = filename.startsWith('fee');
  const isTc = filename.startsWith('tc') || filename.startsWith('claim') || filename.startsWith('insurance');
  const variant = isFee ? 'fee' : isTc ? 'tc' : 'legal';

  const sections = [];

  // Case 1: Top-level blocks[] (flat document)
  if (Array.isArray(docData.blocks)) {
    sections.push({
      id: 'main',
      title: docData.title || '',
      expanded: true,
      blocks: docData.blocks,
      sections: []
    });
  }

  // Case 2: Top-level sections[]
  if (Array.isArray(docData.sections)) {
    docData.sections.forEach((sec, idx) => {
      sections.push(normalizeSection(sec, idx));
    });
  }

  return {
    $schema: '../../content-types/document.schema.json',
    type: 'document',
    schemaVersion: 1,
    slug: slug || docData.slug || '',
    filename: filename.replace('.json', ''),
    variant,
    id: docData.id || `${slug}-${filename.replace('.json', '')}`,
    version: docData.version || '1.0.0',
    header: docData.header || (docData.title ? { title: docData.title } : undefined),
    sections,
    note: docData.note
  };
}

function runMigration() {
  const root = getRootPath();
  const dataDir = path.join(root, 'front-end/data');
  const destDir = path.join(root, 'content/documents');

  const args = process.argv.slice(2);
  const isWrite = args.includes('--write');

  console.log('🔄 Vikki CVP Document Migration Tool (05 §3.2)');
  console.log(`📂 Source: ${path.relative(root, dataDir)}`);
  console.log(`📁 Destination: ${path.relative(root, destDir)}\n`);

  let count = 0;
  const pageDirs = fs.readdirSync(dataDir).filter((f) => fs.statSync(path.join(dataDir, f)).isDirectory());

  for (const pageName of pageDirs) {
    const pagePath = path.join(dataDir, pageName);
    const files = fs.readdirSync(pagePath).filter((f) => {
      return (
        f.startsWith('tc') ||
        f.startsWith('fee') ||
        f.startsWith('claim') ||
        f.startsWith('insurance-wording')
      ) && f.endsWith('.json');
    });

    for (const file of files) {
      const fullPath = path.join(pagePath, file);
      const rawData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const normalized = normalizeDocument(rawData, file, pageName);
      count++;

      const destFileDir = path.join(destDir, `${pageName}-${file.replace('.json', '')}`);
      const destFilePath = path.join(destFileDir, 'vi.json');

      if (isWrite) {
        fs.mkdirSync(destFileDir, { recursive: true });
        fs.writeFileSync(destFilePath, JSON.stringify(normalized, null, 2) + '\n');
        console.log(`✓ Migrated [${normalized.variant}] ${pageName}/${file} -> ${path.relative(root, destFilePath)}`);
      } else {
        console.log(`[Preview] ${pageName}/${file} -> sections: ${normalized.sections.length} (variant: ${normalized.variant})`);
      }
    }
  }

  console.log(`\n🎉 Processed ${count} documents. (${isWrite ? 'Written to content/documents/' : 'Dry run. Use --write to save.'})`);
}

if (require.main === module) {
  runMigration();
}

module.exports = {
  normalizeSection,
  normalizeDocument
};
