const eq = require('./eq');
const json = require('./json');
const inc = require('./inc');
const assetPath = require('./assetPath');
const t = require('./t');
const action = require('./action');
const block = require('./block');

function registerAllHelpers(Handlebars, registry = {}) {
  Handlebars.registerHelper('eq', eq);
  Handlebars.registerHelper('json', json(Handlebars));
  Handlebars.registerHelper('inc', inc);
  Handlebars.registerHelper('assetPath', assetPath);
  Handlebars.registerHelper('t', t);
  Handlebars.registerHelper('action', action(Handlebars));
  Handlebars.registerHelper('block', block(Handlebars, registry));
}

module.exports = {
  registerAllHelpers,
  eq,
  json,
  inc,
  assetPath,
  t,
  action,
  block
};
