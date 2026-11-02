module.exports = function action(Handlebars) {
  return function (act) {
    if (!act || typeof act !== 'object') return '';

    const attrs = [];
    if (act.type) attrs.push(`data-action="${Handlebars.escapeExpression(act.type)}"`);
    if (act.target) attrs.push(`data-target="${Handlebars.escapeExpression(act.target)}"`);
    if (act.title) attrs.push(`data-title="${Handlebars.escapeExpression(act.title)}"`);
    if (act.screen) attrs.push(`data-screen="${Handlebars.escapeExpression(act.screen)}"`);
    if (act.campaignCode) attrs.push(`data-campaign="${Handlebars.escapeExpression(act.campaignCode)}"`);
    if (act.id) attrs.push(`data-id="${Handlebars.escapeExpression(act.id)}"`);

    return new Handlebars.SafeString(attrs.join(' '));
  };
};
