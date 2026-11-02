/**
 * Vikki CVP Runtime Bridge
 * Standardized communication bridge between WebView web content, host React Native app, and parent iframe.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VikkiBridge = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isReactNative() {
    return (
      typeof window !== 'undefined' &&
      typeof window.ReactNativeWebView !== 'undefined' &&
      typeof window.ReactNativeWebView.postMessage === 'function'
    );
  }

  function isIframe() {
    return typeof window !== 'undefined' && window.parent && window.parent !== window;
  }

  /**
   * Send a typed message to the host React Native app
   * @param {Object} payload 
   * @returns {boolean} whether message was dispatched
   */
  function sendAppMessage(payload) {
    if (!payload || typeof payload !== 'object') {
      console.warn('[VikkiBridge] Invalid message payload:', payload);
      return false;
    }

    if (isReactNative()) {
      try {
        const messageStr = JSON.stringify(payload);
        window.ReactNativeWebView.postMessage(messageStr);
        return true;
      } catch (err) {
        console.error('[VikkiBridge] Failed to postMessage to ReactNativeWebView:', err);
        return false;
      }
    } else {
      console.log('[VikkiBridge:WebFallback] App message dispatched:', payload);
      return false;
    }
  }

  /**
   * Send a typed message to the parent iframe host
   * @param {Object} message 
   * @param {string} targetOrigin 
   */
  function sendIframeMessage(message, targetOrigin) {
    if (!isIframe()) return false;
    try {
      window.parent.postMessage(message, targetOrigin || '*');
      return true;
    } catch (err) {
      console.error('[VikkiBridge] Failed to postMessage to parent iframe:', err);
      return false;
    }
  }

  /**
   * Dispatch OPEN_CARD action to mobile app
   */
  function openCard() {
    return sendAppMessage({ action: 'OPEN_CARD' });
  }

  /**
   * Dispatch navigate action to mobile app screen
   * @param {Object} options
   * @param {string} options.screen Screen name (e.g., 'LuckySpinScreen')
   * @param {string} [options.campaignCode] Optional campaign code
   * @param {string} [options.actionType] Optional actionType (e.g. 'navigate-screen')
   */
  function navigate(options) {
    if (!options || !options.screen) {
      console.warn('[VikkiBridge] navigate requires a screen target');
      return false;
    }

    const payload = {
      redirectTo: options.screen,
      actionType: options.actionType || 'navigate-screen'
    };

    if (options.campaignCode) {
      payload.additionalData = { campaignCode: options.campaignCode };
    }

    return sendAppMessage(payload);
  }

  /**
   * Notify parent iframe of content height for automatic height adjustment
   * @param {number} [height] Content height in pixels (defaults to scrollHeight)
   */
  function notifyIframeHeight(height) {
    const measured = height || (typeof document !== 'undefined' ? document.documentElement.scrollHeight : 0);
    return sendIframeMessage({ type: 'setHeight', height: measured });
  }

  /**
   * Notify parent iframe to redirect
   * @param {string} url Target URL
   */
  function notifyIframeRedirect(url) {
    return sendIframeMessage({ type: 'redirect', url });
  }

  /**
   * Open promotion detail in parent or modal
   * @param {string} promoId Promotion ID
   */
  function openPromoDetail(promoId) {
    return sendIframeMessage({ type: 'OPEN_PROMO_DETAIL', id: promoId });
  }

  /**
   * Register listener for inbound messages from host app
   * Handles actions like 'change_video_state'
   * @param {Function} callback Handler receiving { type, data }
   * @returns {Function} Unsubscribe function
   */
  function onInboundMessage(callback) {
    if (typeof window === 'undefined') return () => {};

    function listener(event) {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // not JSON, keep string
        }
      }

      if (data && typeof data === 'object') {
        // Handle common inbound actions
        if (data.type === 'change_video_state' || data.action === 'change_video_state') {
          const videoEl = document.querySelector('video');
          if (videoEl) {
            if (data.state === 'play') videoEl.play().catch(() => {});
            else if (data.state === 'pause') videoEl.pause();
          }
        }
        callback(data, event);
      }
    }

    window.addEventListener('message', listener);
    return function unsubscribe() {
      window.removeEventListener('message', listener);
    };
  }

  return {
    isReactNative,
    isIframe,
    sendAppMessage,
    sendIframeMessage,
    openCard,
    navigate,
    notifyIframeHeight,
    notifyIframeRedirect,
    openPromoDetail,
    onInboundMessage
  };
});
