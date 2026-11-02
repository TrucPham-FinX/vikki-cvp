/**
 * CVP Content Sanitizer (06 §5 Safety Rules)
 * Enforces admin content safety: strips scripts, inline styles, event handlers, and dangerous URL protocols.
 */

const ALLOWED_TAGS = new Set([
  'p', 'strong', 'b', 'em', 'i', 'u', 'br',
  'ul', 'ol', 'li',
  'a', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

const ALLOWED_ATTRS = {
  a: new Set(['href', 'target', 'rel', 'title']),
  span: new Set(['class']),
  td: new Set(['rowspan', 'colspan']),
  th: new Set(['rowspan', 'colspan'])
};

const DANGEROUS_PROTOCOLS = /^(?:javascript|data|vbscript):/i;

function isSafeUrl(url) {
  if (!url) return false;
  const trimmed = String(url).trim();
  if (DANGEROUS_PROTOCOLS.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * Sanitizes an HTML string according to CVP safety rules
 * @param {string} html 
 * @returns {string} Clean HTML
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // 1. Remove dangerous blocks completely (<script>, <style>, <iframe>, <object>, <embed>)
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

  // 2. Remove on* event handlers
  clean = clean.replace(/\son[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Remove inline style attributes
  clean = clean.replace(/\sstyle\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 4. Validate tags and attributes
  clean = clean.replace(/<\/?([a-zA-Z0-9_-]+)([^>]*)>/g, (match, tag, rawAttrs) => {
    const lowerTag = tag.toLowerCase();

    // If tag is not in allow-list, strip the tag but keep text
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return '';
    }

    if (match.startsWith('</')) {
      return `</${lowerTag}>`;
    }

    // Process attributes for allowed tag
    const allowedForTag = ALLOWED_ATTRS[lowerTag] || new Set();
    const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+)))?/g;
    let attrMatch;
    const cleanAttrs = [];

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrVal = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] !== undefined ? attrMatch[3] : attrMatch[4]);

      if (allowedForTag.has(attrName)) {
        if (attrName === 'href') {
          if (isSafeUrl(attrVal)) {
            cleanAttrs.push(`href="${attrVal}"`);
          }
        } else if (attrVal !== undefined) {
          cleanAttrs.push(`${attrName}="${attrVal}"`);
        } else {
          cleanAttrs.push(attrName);
        }
      }
    }

    const attrStr = cleanAttrs.length > 0 ? ' ' + cleanAttrs.join(' ') : '';
    const isSelfClosing = match.endsWith('/>') || lowerTag === 'br';
    return isSelfClosing ? `<${lowerTag}${attrStr} />` : `<${lowerTag}${attrStr}>`;
  });

  return clean;
}

module.exports = {
  sanitizeHtml,
  isSafeUrl,
  ALLOWED_TAGS,
  ALLOWED_ATTRS
};
