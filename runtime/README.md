# Vikki CVP — Runtime Contracts Specification

> **Audience:** Mobile App Engineers (iOS / Android React Native), Web Engineers, and QA.  
> **Status:** Standardized contract resolving P10 from `03-problem-analysis.md`.

This document defines the interface boundary between **CVP WebView Pages**, the **Mobile Host App**, and **Parent Iframe Embeds**.

---

## 1. URL Query Parameters

The host app loads CVP web pages in a WebView by passing URL parameters. The web pages parse these parameters on initialization via `runtime/env.js`.

| Parameter | Type | Default | Description | Consumer |
|---|---|---|---|---|
| `hasTopSpace` | `boolean` (`true` \| `false`) | `true` | When `false`, removes top padding on the page (used when the native app header already accounts for status bar / notch safe area). | `scripts.hbs:147`, `runtime/env.js` |
| `hasCard` | `boolean` (`true` \| `false`) | `false` | When `true`, indicates that the authenticated user already holds the card. The page hides the "Open Card" / "Đăng ký mở thẻ" button. | `vikki-one-connect`, `runtime/env.js` |
| `productScheme` | `string` | `null` | Co-branded partner scheme identifier (`HDBANK`, `VIKKI_BANK`, `SOVICO`, `DAMTC`). Pre-selects and highlights the corresponding partner. | `vikki-one-connect:241` |
| `category` | `string` | `null` | Promotion category filter code (e.g. `VIKKI_ONE`, `VIKKIGO_PLUS`). Filters the active promotion list. | `promotion/list.hbs:29` |
| `lang` | `string` (`vi` \| `en` \| `ko`) | `vi` | Language of the page. See [1.1](#11-language-lang). | `components/localeRedirect.hbs`, `scripts.hbs` (`withLang`), `runtime/env.js` |

### 1.1 Language (`lang`)

Each page has one address; `?lang` picks the language. Consumers (the app, hello-vietnam) add it to the link they already load.

```
https://vikki-cdn.uat.galaxyfinx.cloud/vikki-cvp/vikki-foreign-exchange-cvp/tc.html?lang=en
```

- **Values:** `vi`, `en`, `ko`, case-insensitive; a region is ignored (`en-US` reads as `en`).
- **Fallback:** when the page has no copy in that language, or the value is anything else, it opens English; when it has no English either, Vietnamese.
- **No `?lang`:** Vietnamese, as before. A link straight to a language's copy (`…/en/tc.html`) still opens that copy.
- **Pages in one language** (most pages today) ignore `?lang` and show Vietnamese.
- **Popups** pass `?lang` on to the CVP pages they open (same origin, not PDFs).

How it works: a page with `data/<page>/<lang>.json` is built into `<page>/<lang>/<file>.html` for each language, plus `<page>/<file>.html`, a small page that sends the visitor to the copy `?lang` asks for with `location.replace` (no history entry; the query and hash are kept). Each language's copy carries the same check, for a `?lang` naming another language. Adding Korean to a page means adding `data/<page>/ko.json` (and `<template>-ko.json` for its other files) and its `ko/assets/`.

### Example URL
```
https://cvp.vikkibank.vn/vikki-one-connect/index.html?hasTopSpace=false&hasCard=true&productScheme=HDBANK
```

---

## 2. Mobile App Bridge (React Native WebView)

Outbound messages are sent from the CVP WebView to the mobile app via `window.ReactNativeWebView.postMessage(JSON.stringify(payload))`.

### 2.1 Outbound Actions (Web → App)

#### Action 1: Open Card Registration (`OPEN_CARD`)
Dispatched when the user taps an "Open Card" CTA.
```json
{
  "action": "OPEN_CARD"
}
```

#### Action 2: Navigate to Screen (`navigate-screen`)
Dispatched to deep-link to a native mobile screen (e.g., lucky wheel, loans, savings).
```json
{
  "redirectTo": "LuckySpinScreen",
  "actionType": "navigate-screen",
  "additionalData": {
    "campaignCode": "LIXI2026"
  }
}
```

**Supported Screens Enum:**
- `LuckySpinScreen` — Vòng quay may mắn / Tết lì xì
- `CardDetailScreen` — Chi tiết thẻ
- `HomeScreen` — Trang chủ
- `LoanScreen` — Màn hình vay vốn
- `SavingsScreen` — Màn hình tiết kiệm
- `PromotionDetailScreen` — Chi tiết ưu đãi
- `AccountDetailScreen` — Thông tin tài khoản
- `KYCScreen` — Xác thực định danh

### 2.2 Inbound Actions (App → Web)

The host app can dispatch messages to the WebView via `webview.postMessage(JSON.stringify(payload))`.

#### Action: Video Playback State (`change_video_state`)
Sent when the webview enters or leaves the visible viewport.
```json
{
  "type": "change_video_state",
  "state": "pause" // "play" | "pause"
}
```

---

## 3. Parent Iframe Communication (Web → Web Parent)

For pages hosted within iframe widgets (e.g. `booking-vja`, `td-interest-cvp`, promotion modal).

| Message Type | Payload Structure | Description |
|---|---|---|
| `setHeight` | `{ type: "setHeight", height: 1420 }` | Informs parent container of page scrollHeight for seamless height auto-sizing without scrollbars. |
| `redirect` | `{ type: "redirect", url: "https://..." }` | Asks the parent frame to navigate the top-level window. |
| `OPEN_PROMO_DETAIL` | `{ type: "OPEN_PROMO_DETAIL", id: "promo-075" }` | Asks parent host to open the detailed modal for a specific promotion. |

---

## 4. Declarative Block Actions (Schema-based)

Instead of injecting inline JavaScript handlers inside templates, content blocks declare actions in JSON:

```json
{
  "type": "activation",
  "action": {
    "type": "navigate",
    "screen": "LuckySpinScreen",
    "campaignCode": "LIXI2026"
  }
}
```

```json
{
  "type": "topMenu",
  "items": [
    {
      "title": "Hỏi đáp",
      "iconSrc": "./assets/qa.svg",
      "action": {
        "type": "popup",
        "target": "qa",
        "title": "Hỏi đáp"
      }
    }
  ]
}
```

---

## 5. Verification & Testing

To test bridge calls in development or QA:
1. Open any CVP page in Chrome or Safari.
2. In the console, inspect `window.VikkiBridge`:
   ```javascript
   // Will log: [VikkiBridge:WebFallback] App message dispatched: { action: 'OPEN_CARD' }
   VikkiBridge.openCard();
   ```
3. In a real mobile WebView, `VikkiBridge.isReactNative()` returns `true` and messages post cleanly to `ReactNativeWebView`.
