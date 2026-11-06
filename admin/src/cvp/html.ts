/**
 * Whether an HTML field's value may be shown in the admin's rich-text editor
 * (admin/components/cvp/fields/HtmlField.tsx), which puts it in the admin's own page: only markup
 * that cannot run anything there. The pages' content is paragraphs, bold, lists and links
 * (`<p>`, `<strong>`, `<ul><li>`, `<a href target>`); anything able to run a script or restyle the
 * admin opens as HTML source instead, where it is text.
 *
 * Deliberately broad: a false alarm costs an editor the toolbar for that one value, a miss would
 * run someone's markup with the admin's session. No DOM here (the tests run in Node); the editor
 * checks the parsed tree again with `hasActiveContent` before showing it.
 */

const ACTIVE_TAGS = [
  'script', 'style', 'link', 'meta', 'base', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'form', 'svg', 'math', 'template', 'portal', 'noscript', 'xmp', 'plaintext',
]

const ACTIVE_TAG = new RegExp(`<\\s*/?\\s*(?:${ACTIVE_TAGS.join('|')})\\b`, 'i')
// An event handler attribute inside a tag: <img src=x onerror=…>, <a/onclick=…>
const HANDLER = /<[a-z][^>]*[\s/"'`]on[a-z]+\s*=/i
// A URL that runs or renders markup
const ACTIVE_URL = /(?:java|vb)script\s*:|data\s*:\s*text\/html/i
// A character reference inside a tag, which could spell either of the above
const ENCODED_IN_TAG = /<[a-z][^>]*&(?:#|colon;|tab;|newline;)/i

export function isEditableHtml(html: string): boolean {
  if (!html) return true
  return !(ACTIVE_TAG.test(html) || HANDLER.test(html) || ACTIVE_URL.test(html) || ENCODED_IN_TAG.test(html))
}

/** The parsed tree's check, in the browser: an active element, a handler, a script URL */
export function hasActiveContent(root: ParentNode): boolean {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (ACTIVE_TAGS.includes(element.localName)) return true
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) return true
      if (ACTIVE_URL.test(attribute.value.replace(/[\s\u0000-\u001f]/g, ''))) return true
    }
  }
  return false
}
