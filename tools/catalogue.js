#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { discoverBlocks, loadConfig } = require('../core/registry');
const { createRenderer } = require('../core/render');

function getRootPath() {
  return path.resolve(__dirname, '..');
}

function generateBlockCatalogue() {
  const root = getRootPath();
  const config = loadConfig();
  const blocks = discoverBlocks();
  const renderer = createRenderer();

  console.log('📚 Generating Living Block Catalogue (06 §3)...');
  const blockList = Object.values(blocks);
  console.log(`📦 Discovered ${blockList.length} registered block(s).`);

  const cardsHtml = blockList.map((block) => {
    const props = block.props || {};
    const propsKeys = props.properties ? Object.keys(props.properties) : [];
    const variants = block.variants ? Object.keys(block.variants) : [];

    return `
      <section class="block-card" id="block-${block.type}">
        <div class="block-header">
          <span class="badge ${block.category}">${block.category || 'block'}</span>
          <h3>${block.title || block.type}</h3>
          <code>${block.type} @ ${block.version || '1.0.0'}</code>
        </div>
        <p class="description">${block.description || 'No description provided.'}</p>
        
        <div class="block-details">
          <div>
            <strong>Properties:</strong>
            <ul>
              ${propsKeys.length ? propsKeys.map((p) => `<li><code>${p}</code></li>`).join('') : '<li><em>None</em></li>'}
            </ul>
          </div>
          <div>
            <strong>Variants:</strong>
            <ul>
              ${variants.length ? variants.map((v) => `<li><code>${v}</code>: ${block.variants[v]}</li>`).join('') : '<li><em>Default only</em></li>'}
            </ul>
          </div>
        </div>
      </section>
    `;
  }).join('\n');

  const catalogueHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vikki CVP — Component & Block Catalogue</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --primary: #0000ff;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 32px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 2rem;
    }
    .grid {
      display: grid;
      gap: 20px;
    }
    .block-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .block-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .block-header h3 {
      margin: 0;
      flex: 1;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      background: #e0e7ff;
      color: #3730a3;
    }
    .badge.cta { background: #dcfce7; color: #166534; }
    .badge.hero { background: #fef3c7; color: #92400e; }
    .badge.widget { background: #f3e8ff; color: #6b21a8; }
    .description {
      color: var(--muted);
      margin: 0 0 16px;
    }
    .block-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: var(--bg);
      padding: 12px;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    ul {
      margin: 4px 0 0;
      padding-left: 20px;
    }
    code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Vikki CVP Block Catalogue</h1>
      <p>Living component & block contracts catalogue generated from <code>*.block.json</code> definitions.</p>
    </header>
    <main class="grid">
      ${cardsHtml}
    </main>
  </div>
</body>
</html>`;

  const outDir = path.join(root, config.output || 'vikki-cvp');
  const targetPath = path.join(outDir, 'catalogue.html');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(targetPath, catalogueHtml, 'utf8');

  console.log(`✅ Generated Block Catalogue at: ${path.relative(root, targetPath)}`);
  return targetPath;
}

if (require.main === module) {
  generateBlockCatalogue();
}

module.exports = {
  generateBlockCatalogue
};
