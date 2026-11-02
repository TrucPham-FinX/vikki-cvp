#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function normalizePromoId(rawId, index) {
  if (!rawId) return `promo-${String(index + 1).padStart(3, '0')}`;
  const str = String(rawId).trim();
  const match = str.match(/^(?:promo-)?(\d+)$/i);
  if (match) {
    return `promo-${match[1].padStart(3, '0')}`;
  }
  return str.startsWith('promo-') ? str : `promo-${str}`;
}

function normalizeThumbnail(rawImage, promoId) {
  const img = (rawImage || promoId || 'default.png').trim();
  if (/\.(png|jpe?g|webp|svg)$/i.test(img)) {
    return `./assets/${img}`;
  }
  return `./assets/${img}.png`;
}

function formatBold(text) {
  return String(text || '').replace(/(\d+%)/g, '<strong>$1</strong>');
}

function convertToHTML(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  let html = '';
  let inList = false;

  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    if (/^\d+\./.test(line)) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p><strong>${line}</strong></p>`;
    } else if (line.startsWith('-')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${line.substring(1).trim()}</li>`;
    } else {
      html += `<p>${line}</p>`;
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function parsePromotionsFromExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet);

  const now = new Date().toISOString();

  return rawRows.map((row, index) => {
    const getVal = (key) => {
      for (const k of Object.keys(row)) {
        if (k.trim().toLowerCase() === key.toLowerCase()) return row[k];
      }
      return '';
    };

    const title = getVal('title') || row.title || '';
    const shortContent = getVal('shortContent') || row.shortContent || '';
    const longContent = getVal('longContent') || row.longContent || '';
    const rawImage = getVal('image') || row.image || '';
    const timeVal = getVal('time') || row.time || '';
    const cardType = getVal('cardType') || row.cardType || '';
    const code = getVal('code') || row.code || '';

    const promoId = normalizePromoId(rawImage, index);
    const longHTML = convertToHTML(longContent);

    return {
      id: promoId,
      promotionGroup: 'HDB',
      promotionCate: cardType ? String(cardType).replace(/\s+/g, '') : '',
      promotionCode: String(code || ''),
      name: String(title).trim(),
      thumbnail: normalizeThumbnail(rawImage, promoId),
      shortDesc: formatBold(shortContent),
      longDesc: longHTML,
      startDate: row.startDate || now,
      endDate: row.endDate || now,
      createdDate: now,
      updatedDate: now,
      isHotDeal: false,
      extraData: timeVal || ''
    };
  });
}

function validatePromotions(items) {
  const root = getRootPath();
  const schemaPath = path.join(root, 'content-types/promotion.schema.json');
  const defsPath = path.join(root, 'content-types/_defs.json');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  if (fs.existsSync(defsPath)) {
    ajv.addSchema(JSON.parse(fs.readFileSync(defsPath, 'utf8')), 'cvp:_defs');
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = ajv.compile(schema);

  const errors = [];
  items.forEach((item, idx) => {
    if (!validate(item)) {
      validate.errors.forEach((err) => {
        errors.push({
          index: idx,
          id: item.id,
          path: err.instancePath,
          message: err.message
        });
      });
    }
  });

  return { isValid: errors.length === 0, errors };
}

function runCLI() {
  const args = process.argv.slice(2);
  const root = getRootPath();

  const isTest = args.includes('--test') || args.includes('--dry-run');
  const isWrite = args.includes('--write');
  const outputArg = args.find((a) => a.startsWith('--output='));
  const fileArg = args.find((a) => !a.startsWith('--'));

  const inputPath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.join(root, 'front-end/data/promotion/promotionTemplate.xlsx');

  const defaultOutPath = path.join(root, 'front-end/data/promotion/list.json');
  const outputPath = outputArg ? path.resolve(process.cwd(), outputArg.split('=')[1]) : defaultOutPath;

  console.log('📊 Vikki CVP Promotion Importer');
  console.log(`📖 Input Excel: ${path.relative(root, inputPath)}`);

  const items = parsePromotionsFromExcel(inputPath);
  console.log(`📦 Parsed ${items.length} promotion items from Excel.`);

  const validation = validatePromotions(items);
  if (!validation.isValid) {
    console.error(`❌ Validation failed with ${validation.errors.length} error(s):`);
    validation.errors.forEach((e) => {
      console.error(`  - Item [${e.index}] (${e.id}) ${e.path}: ${e.message}`);
    });
    process.exit(1);
  }

  console.log('✅ All promotion items validated successfully against schema.');

  if (isTest) {
    console.log('\nPreview of imported items:');
    items.forEach((item) => {
      console.log(`  - [${item.id}] ${item.name} (${item.promotionCode}) -> ${item.thumbnail}`);
    });
    console.log('\nDry run complete. No files modified.');
    return;
  }

  if (isWrite) {
    let outputData = { layout: 'promotion', items };
    if (fs.existsSync(outputPath)) {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const existingItems = existing.items || [];
      const itemMap = new Map();
      existingItems.forEach((it) => itemMap.set(it.id, it));
      items.forEach((it) => itemMap.set(it.id, it));
      outputData = {
        ...existing,
        items: Array.from(itemMap.values())
      };
    }
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2) + '\n');
    console.log(`💾 Successfully written to ${path.relative(root, outputPath)}`);
  } else {
    console.log('\nPreview of parsed promotions (use --write to save to list.json):');
    items.forEach((item) => {
      console.log(`  - [${item.id}] ${item.name} (${item.promotionCode}) -> ${item.thumbnail}`);
    });
  }
}

if (require.main === module) {
  try {
    runCLI();
  } catch (err) {
    console.error(`❌ Error importing promotions: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  parsePromotionsFromExcel,
  validatePromotions,
  normalizePromoId,
  normalizeThumbnail,
  convertToHTML,
  formatBold
};
