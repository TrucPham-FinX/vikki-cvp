/**
 * Canonical HTML form used to decide whether two engines produced the *same page*.
 *
 * parse5 parses with the HTML spec algorithm and re-serialises, which removes
 * differences that browsers also ignore: quote style, `<img/>` vs `<img>`,
 * boolean attribute spelling (`autoplay` vs `autoplay=""`), entity spelling.
 * On top of that: inter-tag whitespace is collapsed and class tokens are
 * normalised (`"a  b "` == `"a b"`). Nothing else is normalised.
 */
const { parse, serialize } = require('parse5');

function walk(node) {
  if (node.attrs) {
    for (const a of node.attrs) {
      if (a.name === 'class') a.value = a.value.split(/\s+/).filter(Boolean).join(' ');
    }
    node.attrs.sort((x, y) => x.name.localeCompare(y.name));
  }
  if (node.nodeName === '#text') node.value = node.value.replace(/\s+/g, ' ');
  const kids = node.content ? node.content.childNodes : node.childNodes;
  if (kids) {
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      if (k.nodeName === '#text' && !k.value.trim() && !['script', 'style'].includes(node.nodeName)) kids.splice(i, 1);
      else walk(k);
    }
  }
}

function normalize(html) {
  const doc = parse(html);
  walk(doc);
  return serialize(doc).replace(/> </g, '><').replace(/ </g, '<').replace(/> /g, '>');
}

module.exports = { normalize };
