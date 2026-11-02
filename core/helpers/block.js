module.exports = function blockHelper(Handlebars, registry) {
  return function renderBlock(blockData, options) {
    if (!blockData || typeof blockData !== 'object' || !blockData.type) {
      throw new Error(`[Render Error] Block instance is missing 'type'`);
    }

    const type = blockData.type;
    const partialName = registry && registry.blocks && registry.blocks[type]
      ? type
      : type;

    const partial = Handlebars.partials[partialName];
    if (!partial) {
      throw new Error(
        `[Render Error] Unknown block type: "${type}". Block partial "${partialName}" is not registered in Handlebars.`
      );
    }

    const compiled = typeof partial === 'function' ? partial : Handlebars.compile(partial);
    const parentRoot = (options && options.data && options.data.root) || {};
    const context = {
      ...blockData,
      ...blockData.props,
      _parent: parentRoot
    };

    return new Handlebars.SafeString(compiled(context, options));
  };
};
