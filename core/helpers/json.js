module.exports = function json(Handlebars) {
  return function (context) {
    return new Handlebars.SafeString(
      JSON.stringify(context).replace(/</g, '\\u003c')
    );
  };
};
