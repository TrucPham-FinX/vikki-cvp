/**
 * Engine-agnostic view-model preparation, shared by every engine in the experiment.
 *
 * Everything that is *logic* lives here, not in templates:
 *   - FAQ numbering (today: prepareNumOrder() mutating data inside front-end/build.js)
 *   - rich-text sanitisation for the fields that are rendered raw
 *   - localisation dictionary lookup table for the active locale
 *
 * The result is deep-frozen so a template that tries to mutate data fails loudly.
 */
const sanitizeHtml = require('sanitize-html');

const SANITIZE = {
  allowedTags: ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'ul', 'ol', 'li', 'a', 'sup', 'sub',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'target', 'rel', 'data-popup'],
    ol: ['type', 'start'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false
};

const clean = (html) => (typeof html === 'string' ? sanitizeHtml(html, SANITIZE) : html);

function cleanList(list) {
  for (const item of list.items || []) {
    item.text = clean(item.text);
    if (item.type === 'table') cleanTable(item);
    if (item.children) cleanList(item.children);
  }
}

function cleanTable(table) {
  for (const row of [...(table.headerRows || []), ...(table.rows || [])]) {
    for (const cell of row.cells || []) cell.value = clean(cell.value);
  }
  table.note = clean(table.note);
}

function cleanBlocks(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'paragraph' || b.type === 'subheading') b.text = clean(b.text);
    else if (b.type === 'list') cleanList(b);
    else if (b.type === 'table') cleanTable(b);
  }
}

function cleanSection(section) {
  cleanBlocks(section.blocks);
  (section.articles || []).forEach(cleanSection);
  (section.sections || []).forEach(cleanSection);
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

function prepare(page, uiAll) {
  const vm = JSON.parse(JSON.stringify(page));

  let n = 1;
  for (const group of vm.qaGroup || []) {
    for (const child of group.children || []) {
      child.numOrder = n++;
      child.content = clean(child.content);
    }
  }

  for (const c of vm.components) {
    if (c.type === 'qa') c.items.forEach((it) => { it.content = clean(it.content); });
    if (c.type === 'productList') c.items.forEach((it) => { it.shortDesc = clean(it.shortDesc); });
  }

  vm.document.sections.forEach(cleanSection);
  vm.ui = uiAll[vm.locale] || uiAll.vi;
  return deepFreeze(vm);
}

module.exports = { prepare, SANITIZE };
