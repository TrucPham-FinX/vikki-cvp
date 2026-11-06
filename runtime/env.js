/**
 * Vikki CVP Runtime Environment & Query Parameters Parser
 * Handles query parameter contracts (hasTopSpace, hasCard, productScheme, category)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VikkiEnv = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SUPPORTED_LANGS = ['vi', 'en', 'ko'];
  var FALLBACK_LANG = 'en';

  /** ?lang as one of SUPPORTED_LANGS, FALLBACK_LANG for any other, null when absent or empty */
  function normalizeLang(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim().toLowerCase();
    if (!text) return null;
    var code = text.split(/[-_]/)[0];
    return SUPPORTED_LANGS.indexOf(code) !== -1 ? code : FALLBACK_LANG;
  }

  /**
   * Parse query string into typed parameters
   * @param {string} [searchStr] Defaults to window.location.search
   */
  function parseQueryParams(searchStr) {
    const search =
      typeof searchStr === 'string'
        ? searchStr
        : typeof window !== 'undefined' && window.location
        ? window.location.search
        : '';

    const params = new URLSearchParams(search);

    const hasTopSpaceRaw = params.get('hasTopSpace');
    const hasCardRaw = params.get('hasCard');
    const productSchemeRaw = params.get('productScheme');
    const categoryRaw = params.get('category');
    const langRaw = params.get('lang');

    return {
      // lang: vi | en | ko ('en-US' reads as 'en'); any other language falls back to 'en';
      // null without ?lang, when a page shows its default language (vi)
      lang: normalizeLang(langRaw),
      // hasTopSpace: defaults to true unless explicitly 'false'
      hasTopSpace: hasTopSpaceRaw === null ? true : hasTopSpaceRaw !== 'false',
      // hasCard: defaults to false unless explicitly 'true'
      hasCard: hasCardRaw === 'true',
      // productScheme: normalized uppercase string or null
      productScheme: productSchemeRaw ? String(productSchemeRaw).toUpperCase() : null,
      // category: raw category code or null
      category: categoryRaw ? String(categoryRaw).trim() : null,
      // Raw instance for any custom params
      raw: params
    };
  }

  /**
   * Apply runtime environment attributes to DOM (e.g. toggle top space on body)
   */
  function applyRuntimeEnv() {
    if (typeof document === 'undefined') return;

    const env = parseQueryParams();
    const body = document.getElementById('body') || document.body;
    if (!body) return;

    if (!env.hasTopSpace) {
      body.classList.remove('hasTopSpace');
    } else {
      body.classList.add('hasTopSpace');
    }

    if (env.hasCard) {
      body.classList.add('user-has-card');
      // Hide any registration buttons marked for new card applicants
      const openCardButtons = document.querySelectorAll('[data-action="openCard"], .btn-open-card');
      openCardButtons.forEach((btn) => {
        btn.style.display = 'none';
      });
    }

    return env;
  }

  return {
    parseQueryParams,
    normalizeLang,
    applyRuntimeEnv
  };
});
