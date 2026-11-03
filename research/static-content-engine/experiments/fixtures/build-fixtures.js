#!/usr/bin/env node
/**
 * Builds the shared experiment input from REAL repository data (read-only).
 *
 *   front-end/data/home-loan-cvp/index.json     -> landing components + FAQ groups
 *   front-end/data/promotion/list.json          -> product/offer list (6 items)
 *   front-end/data/vikki-go-plus-cvp/tc.json    -> nested document sections (recursive lists)
 *   front-end/data/vikki-one-connect/fee.json   -> one fee table
 *
 * Output: fixtures/page.vi.json, fixtures/page.en.json (identical shape) and fixtures/ui.json.
 * Every engine in this experiment consumes exactly these files.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));

const landing = read('front-end/data/home-loan-cvp/index.json');
const promos = read('front-end/data/promotion/list.json').items.slice(0, 6);
const tc = read('front-end/data/vikki-go-plus-cvp/tc.json');
const fee = read('front-end/data/vikki-one-connect/fee.json');

function findFirst(node, pred) {
  if (!node || typeof node !== 'object') return null;
  if (pred(node)) return node;
  for (const v of Object.values(node)) {
    const hit = findFirst(v, pred);
    if (hit) return hit;
  }
  return null;
}

const feeTable = findFirst(fee, (n) => n.type === 'table' && Array.isArray(n.rows));
const byType = (t) => landing.components.filter((c) => c.type === t);

// Mark one promotion as hot deal so the conditional badge path is exercised.
const products = promos.map((p, i) => ({
  id: p.id,
  name: p.name,
  thumbnail: p.thumbnail,
  shortDesc: p.shortDesc,
  isHotDeal: i === 0,
  categories: String(p.promotionCate || '').split(',').filter(Boolean)
}));

// Production data contains a document block with no "type"
// (vikki-go-plus-cvp/tc.json sections[0].articles[14].blocks[1]); the current
// if-eq dispatch silently drops it from the published HTML. Repair it here so
// every engine renders it, and log the repair instead of hiding it.
function repairUntypedBlocks(node, trail = 'document') {
  if (Array.isArray(node)) return node.forEach((n, i) => repairUntypedBlocks(n, `${trail}[${i}]`));
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.blocks)) {
    node.blocks = node.blocks.map((b, i) => {
      if (b && !b.type && b.children) {
        console.log(`  repaired untyped block at ${trail}.blocks[${i}] -> list`);
        return { type: 'list', style: '', items: [b] };
      }
      return b;
    });
  }
  for (const [k, v] of Object.entries(node)) repairUntypedBlocks(v, `${trail}.${k}`);
}

function documentFor(locale) {
  const sections = tc.sections.slice(0, 2).map((s) => JSON.parse(JSON.stringify(s)));
  repairUntypedBlocks(sections, 'sections');
  sections.push({
    id: 'bieu-phi',
    title: locale === 'en' ? 'Fee schedule (excerpt)' : 'Biểu phí (trích)',
    blocks: [feeTable]
  });
  return { header: tc.header, sections };
}

const EN = {
  menu: { 'Hỏi đáp': 'FAQ', 'Ưu đãi': 'Offers', 'Giới thiệu': 'About', 'Đăng ký': 'Register' },
  title: 'Home loan | Vikki Digital Bank',
  productsTitle: 'Featured offers',
  terms: 'Terms & conditions'
};

function pageFor(locale) {
  const en = locale === 'en';
  const topMenu = JSON.parse(JSON.stringify(byType('topMenu')[0]));
  if (en) topMenu.items.forEach((it) => { it.text = EN.menu[it.text.trim()] || it.text; it.title = it.text; });

  const qa = JSON.parse(JSON.stringify(byType('qa')[0]));
  const activation = JSON.parse(JSON.stringify(byType('activation')[0]));
  if (en && activation.termsButtonFullW) {
    activation.termsButtonFullW.text = EN.terms;
    activation.termsButtonFullW.title = EN.terms;
  }

  return {
    locale,
    title: en ? EN.title : landing.title,
    className: landing.className,
    hasTopSpace: landing.hasTopSpace !== false,
    assetBase: './assets/',
    hero: {
      video: { src: 'video.mp4', poster: 'poster.jpg', hls: 'video/playlist.m3u8' },
      heading: en ? 'Own your home sooner' : 'Sở hữu nhà sớm hơn',
      subheading: en ? 'Up to 100% of your capital needs' : 'Hỗ trợ đến 100% nhu cầu vốn'
    },
    components: [
      topMenu,
      ...byType('imageSection').slice(0, 3),
      { type: 'productList', id: 'offers', title: en ? EN.productsTitle : 'Ưu đãi nổi bật', columns: 2, items: products },
      qa,
      activation
    ],
    qaGroup: JSON.parse(JSON.stringify(landing.qaGroup)),
    document: documentFor(locale)
  };
}

const ui = {
  vi: { 'faq.title': 'Hỏi đáp', 'backToTop': 'Về đầu trang', 'badge.hot': 'Hot', 'products.cta': 'Xem chi tiết', 'doc.toc': 'Mục lục', 'close': 'Đóng' },
  en: { 'faq.title': 'FAQs', 'backToTop': 'Back to top', 'badge.hot': 'Hot', 'products.cta': 'View details', 'doc.toc': 'Contents', 'close': 'Close' }
};

const out = path.join(__dirname);
fs.writeFileSync(path.join(out, 'page.vi.json'), JSON.stringify(pageFor('vi'), null, 2) + '\n');
fs.writeFileSync(path.join(out, 'page.en.json'), JSON.stringify(pageFor('en'), null, 2) + '\n');
fs.writeFileSync(path.join(out, 'ui.json'), JSON.stringify(ui, null, 2) + '\n');

const vi = pageFor('vi');
console.log(`fixtures written: components=${vi.components.length} (${vi.components.map((c) => c.type).join(', ')}), ` +
  `qaGroup=${vi.qaGroup.length}, document.sections=${vi.document.sections.length}`);
