const path = require('path');
const esbuild = require('esbuild');

// TSX -> one CommonJS bundle (build-time only; nothing of Preact ships to the WebView).
function compile() {
  const outfile = path.join(__dirname, '.build', 'pages.js');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'src', 'pages.tsx')],
    outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', jsxImportSource: 'preact',
    external: ['preact', 'preact-render-to-string', 'preact/*'], logLevel: 'error'
  });
  delete require.cache[outfile];
  return require(outfile);
}

function createRenderer() {
  const { renderLanding, renderDocument } = compile();
  return { renderLanding, renderDocument };
}

module.exports = { createRenderer, compile };
