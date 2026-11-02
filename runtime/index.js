const contracts = require('./contracts');
const bridge = require('./bridge');
const env = require('./env');

module.exports = {
  ...contracts,
  bridge,
  env
};
