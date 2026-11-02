const TRANSLATIONS = {
  vi: {
    'faq.title': 'Hỏi đáp',
    'faq.showMore': 'Xem thêm',
    'terms.title': 'Điều khoản và Điều kiện',
    'fee.title': 'Biểu phí dịch vụ',
    'backToTop': 'Về đầu trang'
  },
  en: {
    'faq.title': 'FAQs',
    'faq.showMore': 'Show more',
    'terms.title': 'Terms & Conditions',
    'fee.title': 'Fee Schedule',
    'backToTop': 'Back to top'
  }
};

module.exports = function t(key, options) {
  const root = (options && options.data && options.data.root) || {};
  const locale = root.language || root.locale || 'vi';
  const table = TRANSLATIONS[locale] || TRANSLATIONS.vi;
  return table[key] || key;
};
