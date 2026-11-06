import { CVP_OPERATIONS } from '../contracts/cvp'
import type { Translator } from '../admin/i18n/dictionary'

/**
 * The page Payload's Live Preview loads (`admin.livePreview.url`, see previewConfig.ts): a frame
 * for the CVP page, and the script that keeps it in step with the edit form.
 *
 * Payload's side of the protocol (@payloadcms/ui, LivePreview/Window): once this page posts
 * `{ type: 'payload-live-preview', ready: true }` to its parent — or to its opener, when the
 * editor pops the preview out into its own window — Payload posts the form's values in the
 * content language on every change. Each change, after a pause in typing, is built by the server
 * (POST /api/cvp/preview) and shown.
 *
 * Two frames take turns: the next render loads hidden, takes the visible one's scroll position,
 * then swaps in — so the page neither flashes white nor jumps to the top on every keystroke.
 *
 * A standalone document, not an admin screen: it has no design tokens to spend, so its few
 * colours are literal.
 */
export function previewShell(t: Translator): string {
  const endpoint = `/api${CVP_OPERATIONS.preview.path}`
  const messages = {
    failed: t('preview.failed'),
    language: t('preview.language'),
    missing: t('preview.missing'),
    onlyDefault: t('preview.onlyDefault'),
    standalone: t('preview.standalone'),
    unreachable: t('preview.unreachable'),
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${t('preview.title')}</title>
<style>
  html, body { height: 100%; margin: 0; background: #fff; overflow: hidden; }
  /* The pages are the app's webviews: in a frame wider than a phone (Payload opens on
     "Responsive"), they keep a phone's width, centred, rather than stretching */
  .stage { height: 100%; margin: 0 auto; max-width: 390px; position: relative; }
  @media (min-width: 431px) {
    body { background: #f1f1f1; }
    .stage { background: #fff; box-shadow: 0 0 0 1px #e3e3e3; }
  }
  iframe { border: 0; display: block; height: 100%; inset: 0; position: absolute; width: 100%; }
  iframe[hidden] { visibility: hidden; }
  .progress { background: #0000ff; height: 2px; left: 0; opacity: 0; position: fixed; right: 0; top: 0;
    transform: scaleX(0.15); transform-origin: left; transition: opacity 150ms ease, transform 2s ease-out; z-index: 2; }
  body.busy .progress { opacity: 1; transform: scaleX(0.85); }
  .state { bottom: 12px; display: none; font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    left: 12px; max-height: 45%; overflow: auto; padding: 10px 12px; position: fixed; right: 12px;
    white-space: pre-wrap; border-radius: 8px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); z-index: 3; }
  .state--error { background: #fdf0f1; border: 1px solid #f7d4d6; color: #c50000; display: block; }
  .state--info { background: #eef5ff; border: 1px solid #d3e5ff; color: #0761d1; display: block; }
</style>
</head>
<body>
<div class="progress"></div>
<div class="stage">
<iframe id="frame-a" title="${t('preview.title')}"></iframe>
<iframe id="frame-b" title="${t('preview.title')}" hidden></iframe>
</div>
<div class="state" id="state" role="status"></div>
<script>
(function () {
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var MESSAGES = ${JSON.stringify(messages).replace(/</g, '\\u003c')};
  var DELAY = 350;

  var frames = [document.getElementById('frame-a'), document.getElementById('frame-b')];
  var shown = 0;
  var state = document.getElementById('state');
  var token = null, sequence = 0, timer = null, controller = null, latest = null;

  function say(text, kind) {
    state.textContent = text || '';
    state.className = 'state' + (text ? ' state--' + kind : '');
  }

  function busy(on) { document.body.classList.toggle('busy', on); }

  function scroller(frame) {
    try { var doc = frame.contentDocument; return doc && (doc.scrollingElement || doc.documentElement); }
    catch (error) { return null; }
  }

  function show(url) {
    var current = frames[shown], next = frames[1 - shown];
    var from = scroller(current), y = from ? from.scrollTop : 0;
    next.onload = function () {
      next.onload = null;
      var to = scroller(next);
      if (to) to.scrollTop = y;
      next.hidden = false;
      current.hidden = true;
      shown = 1 - shown;
      busy(false);
    };
    next.src = url;
  }

  function render(message) {
    var mine = ++sequence;
    if (controller) controller.abort();
    controller = new AbortController();
    busy(true);
    fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        collection: message.collectionSlug,
        id: message.data && message.data.id,
        locale: message.locale,
        data: message.data,
        token: token
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (mine !== sequence) return;
        if (result.token) token = result.token;
        if (result.ok) { say('', ''); show(result.url); return; }
        busy(false);
        if (result.reason === 'language') say(MESSAGES.language.replace('{lang}', String(message.locale).toUpperCase()), 'error');
        else if (result.reason === 'only-default') say(MESSAGES.onlyDefault, 'info');
        else if (result.reason === 'missing') say(MESSAGES.missing, 'info');
        else say(MESSAGES.failed + (result.error ? '\\n\\n' + result.error : ''), 'error');
      })
      .catch(function (error) {
        if ((error && error.name === 'AbortError') || mine !== sequence) return;
        busy(false);
        say(MESSAGES.unreachable, 'error');
      });
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var message = event.data;
    if (!message || message.type !== 'payload-live-preview' || !message.data) return;
    latest = message;
    clearTimeout(timer);
    timer = setTimeout(function () { render(latest); }, DELAY);
  });

  var host = window.opener || (window.parent !== window ? window.parent : null);
  if (host) host.postMessage({ type: 'payload-live-preview', ready: true }, window.location.origin);
  else say(MESSAGES.standalone, 'info');
})();
</script>
</body>
</html>
`
}
