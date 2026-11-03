// Global data: the same prepared view models every other engine receives.
const { loadViewModels } = require('../../../../run-all');
module.exports = () => loadViewModels();
