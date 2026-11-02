#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getRootPath() {
  return path.resolve(__dirname, '../..');
}

/**
 * Splits monolithic list.json files into individual collection item JSON files:
 * content/collections/promotions/<id>.json
 * content/collections/card-intro/<id>.json
 */
function migrateCollections() {
  const root = getRootPath();
  const args = process.argv.slice(2);
  const isWrite = args.includes('--write');

  console.log('🔄 Vikki CVP Collection Normalization Tool (05 §3.3)\n');

  // 1. Promotions
  const promoListPath = path.join(root, 'front-end/data/promotion/list.json');
  const promoDestDir = path.join(root, 'content/collections/promotions');
  let promoCount = 0;

  if (fs.existsSync(promoListPath)) {
    const promoData = JSON.parse(fs.readFileSync(promoListPath, 'utf8'));
    const items = promoData.items || [];

    if (isWrite) fs.mkdirSync(promoDestDir, { recursive: true });

    items.forEach((item) => {
      const id = item.id;
      if (!id) return;

      // Normalize categories from comma-separated string to array
      const rawCate = item.promotionCate || '';
      const categories = rawCate
        ? rawCate.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      const normalizedItem = {
        $schema: '../../../../content-types/promotion.schema.json',
        type: 'promotion',
        id: item.id,
        group: item.promotionGroup || 'HDB',
        categories,
        code: item.promotionCode || '',
        name: item.name || '',
        thumbnail: item.thumbnail || '',
        shortDesc: item.shortDesc || '',
        longDesc: item.longDesc || '',
        startDate: item.startDate,
        endDate: item.endDate,
        createdDate: item.createdDate,
        updatedDate: item.updatedDate,
        hotDeal: Boolean(item.isHotDeal),
        extraData: item.extraData || ''
      };

      if (isWrite) {
        const destPath = path.join(promoDestDir, `${id}.json`);
        fs.writeFileSync(destPath, JSON.stringify(normalizedItem, null, 2) + '\n');
      }
      promoCount++;
    });
    console.log(`📦 Promotions: ${promoCount} items ${isWrite ? 'written to content/collections/promotions/' : 'previewed.'}`);
  }

  // 2. Card Intro
  const cardIntroPath = path.join(root, 'front-end/data/card-intro/list.json');
  const cardDestDir = path.join(root, 'content/collections/card-intro');
  let cardCount = 0;

  if (fs.existsSync(cardIntroPath)) {
    const cardData = JSON.parse(fs.readFileSync(cardIntroPath, 'utf8'));
    const items = cardData.items || [];

    if (isWrite) fs.mkdirSync(cardDestDir, { recursive: true });

    items.forEach((item) => {
      const id = item.id || item.slug || `card-${cardCount + 1}`;
      const normalizedItem = {
        $schema: '../../../../content-types/card-intro.schema.json',
        type: 'card-intro',
        id,
        name: item.name || item.title || '',
        code: item.code || '',
        image: item.image || item.thumbnail || '',
        description: item.description || item.desc || '',
        features: item.features || [],
        applyUrl: item.applyUrl || ''
      };

      if (isWrite) {
        const destPath = path.join(cardDestDir, `${id}.json`);
        fs.writeFileSync(destPath, JSON.stringify(normalizedItem, null, 2) + '\n');
      }
      cardCount++;
    });
    console.log(`💳 Card Intro: ${cardCount} items ${isWrite ? 'written to content/collections/card-intro/' : 'previewed.'}`);
  }

  console.log(`\n✨ Collection migration complete.`);
}

if (require.main === module) {
  migrateCollections();
}

module.exports = {
  migrateCollections
};
