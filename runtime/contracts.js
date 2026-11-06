/**
 * Vikki CVP Runtime Contracts Specification
 * Machine-readable definitions for Mobile Bridge Actions, Iframe Messages, and URL Query Parameters.
 */

const BridgeActions = {
  OPEN_CARD: 'OPEN_CARD',
  NAVIGATE: 'navigate',
  NAVIGATE_SCREEN: 'navigate-screen'
};

const SupportedScreens = [
  'LuckySpinScreen',
  'CardDetailScreen',
  'HomeScreen',
  'LoanScreen',
  'SavingsScreen',
  'PromotionDetailScreen',
  'AccountDetailScreen',
  'KYCScreen'
];

const IframeMessages = {
  SET_HEIGHT: 'setHeight',
  REDIRECT: 'redirect',
  OPEN_PROMO_DETAIL: 'OPEN_PROMO_DETAIL'
};

const InboundBridgeMessages = {
  CHANGE_VIDEO_STATE: 'change_video_state'
};

const QueryParams = {
  hasTopSpace: {
    name: 'hasTopSpace',
    type: 'boolean',
    description: 'Toggle top safe area padding in WebView (true = apply top padding, false = remove top padding)',
    defaultValue: true
  },
  hasCard: {
    name: 'hasCard',
    type: 'boolean',
    description: 'User card-holding status. When true, hides "Open Card" registration buttons on landing pages.',
    defaultValue: false
  },
  productScheme: {
    name: 'productScheme',
    type: 'string',
    description: 'Partner co-branding scheme identifier for partner card flows.',
    allowedValues: ['HDBANK', 'VIKKI_BANK', 'SOVICO', 'DAMTC']
  },
  category: {
    name: 'category',
    type: 'string',
    description: 'Category filter code for promotion lists (e.g., VIKKI_ONE, VIKKIGO_PLUS).'
  },
  lang: {
    name: 'lang',
    type: 'string',
    description:
      'Language of the page. A page the language is missing for, or any other value, opens English, else Vietnamese. Popups pass it on to the CVP pages they open.',
    allowedValues: ['vi', 'en', 'ko'],
    defaultValue: 'vi',
    fallbackValue: 'en'
  }
};

const DeclarativeActions = {
  popup: {
    type: 'popup',
    properties: {
      target: { type: 'string', description: 'ID of popup (e.g. "qa") or relative URL to document' },
      title: { type: 'string', description: 'Title shown in popup header' }
    }
  },
  scroll: {
    type: 'scroll',
    properties: {
      target: { type: 'string', description: 'CSS selector of element to scroll to (e.g. "#intro")' }
    }
  },
  link: {
    type: 'link',
    properties: {
      href: { type: 'string', description: 'Allowed HTTPS or relative URL' },
      target: { type: 'string', enum: ['_blank', '_self'] }
    }
  },
  openCard: {
    type: 'openCard',
    properties: {}
  },
  navigate: {
    type: 'navigate',
    properties: {
      screen: { type: 'string', enum: SupportedScreens },
      campaignCode: { type: 'string' },
      actionType: { type: 'string', enum: ['navigate-screen'] }
    }
  },
  openPromo: {
    type: 'openPromo',
    properties: {
      id: { type: 'string', description: 'Promotion ID (e.g. "promo-075")' }
    }
  }
};

module.exports = {
  BridgeActions,
  SupportedScreens,
  IframeMessages,
  InboundBridgeMessages,
  QueryParams,
  DeclarativeActions
};
