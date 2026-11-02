const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const http = require('http');

// Register helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

const ROOT = __dirname;
const PAGES = path.join(ROOT, 'pages');
const OUT = path.resolve(ROOT, '../vikki-cvp');
const HOST = path.resolve(ROOT, '../');

/* ========= PARTIALS ========= */
function registerPartials(dir, namespace = '') {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // đệ quy + build namespace
      registerPartials(fullPath, namespace ? `${namespace}/${file}` : file);
    }

    if (file.endsWith('.hbs')) {
      const name = path.basename(file, '.hbs');
      const partialName = namespace ? `${namespace}/${name}` : name;

      Handlebars.registerPartial(
        partialName,
        fs.readFileSync(fullPath, 'utf8'),
      );

      console.log('✓ partial:', partialName);
    }
  });
}

registerPartials(path.join(ROOT, 'components'));
registerPartials(path.join(ROOT, 'layouts'));

Handlebars.registerHelper('json', function (context) {
  return new Handlebars.SafeString(
    JSON.stringify(context).replace(/</g, '\\u003c'),
  );
});

Handlebars.registerHelper('inc', function (value) {
  return value + 1;
});

Handlebars.registerHelper('assetPath', function (file, options) {
  const base = options.data.root.assetBase || './assets/';
  return `${base}${file}`;
});

function prepareNumOrder(data) {
  let counter = 1;

  data.forEach(item => {
    const children = item?.children
    children.forEach(child => {
      child.numOrder = counter++;
    })
  });

  return counter;
}

/* ========= BUILD ========= */

function loadData(pageName, templateName) {
  const candidates = [
    path.join(ROOT, 'data', pageName, `${templateName}.json`),

    path.join(ROOT, 'data', pageName, 'list.json'),
    path.join(ROOT, 'data', pageName, `${pageName}.json`),
    path.join(ROOT, 'data', pageName, 'index.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }

  return {};
}

function loadLocaleData(pageName, locale) {
  const dataPath = path.join(ROOT, 'data', pageName, `${locale}.json`);
  if (!fs.existsSync(dataPath)) return null;

  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function renderPage({ pageName, templateName, templatePath, data, outDir, outputName }) {
  if(data.qaGroup) {
    prepareNumOrder(data.qaGroup)
  }

  const tpl = Handlebars.compile(
    fs.readFileSync(templatePath, 'utf8'),
  );

  const body = tpl(data);
  const layoutPath = data.layout
    ? `layouts/${data.layout}.hbs`
    : 'layouts/base.hbs';
  const layoutTpl = Handlebars.compile(
    fs.readFileSync(path.join(ROOT, layoutPath), 'utf8'),
  );

  const html = layoutTpl({
    ...data,
    body,
    page: pageName,
    template: templateName,
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, outputName), html);
}

function buildPage(dir) {
  const pageName = path.basename(dir);
  const templates = fs.readdirSync(dir).filter((f) => f.endsWith('.hbs'));

  if (!templates.length) return;

  const locales = ['en', 'vi'];
  const localeData = locales
    .map((locale) => ({ locale, data: loadLocaleData(pageName, locale) }))
    .filter(({ data }) => data);

  // Locale builds are opt-in. Existing pages keep the original build path.
  if (localeData.length) {
    // Template filename defaults to the page name, but if the data opts
    // into a different output filename (via "filename"), that same name is
    // also accepted as the template's filename.
    const preferredFilename = localeData[0].data.filename;
    const templateCandidates = [
      path.join(dir, `${pageName}.hbs`),
      ...(preferredFilename ? [path.join(dir, `${preferredFilename}.hbs`)] : []),
    ];
    const templatePath = templateCandidates.find((p) => fs.existsSync(p));

    if (!templatePath) {
      throw new Error(`Missing locale template: pages/${pageName}/${pageName}.hbs`);
    }

    localeData.forEach(({ locale, data }) => {
      // Output filename defaults to the page name (matching every other
      // template's own name -> its own .html), but a page can opt into a
      // different filename (e.g. "index") via an explicit "filename" field.
      const outputBaseName = data.filename || pageName;

      renderPage({
        pageName,
        templateName: pageName,
        templatePath,
        data: {
          ...data,
          language: data.language || locale,
          htmlLanguage: data.language || locale,
        },
        outDir: path.join(OUT, pageName, locale),
        outputName: `${outputBaseName}.html`,
      });

      console.log(`✓ build ${pageName}/${locale}/${outputBaseName}.html`);

      if (Array.isArray(data.details) && data.details.length) {
        const detailIds = new Set();

        data.details.forEach((detail) => {
          const detailId = detail?.id;
          const detailTemplateName = detail?.template || 'detail';

          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(detailId || '')) {
            throw new Error(
              `Invalid detail id "${detailId}" in data/${pageName}/${locale}.json`,
            );
          }

          if (detailIds.has(detailId)) {
            throw new Error(
              `Duplicate detail id "${detailId}" in data/${pageName}/${locale}.json`,
            );
          }
          detailIds.add(detailId);

          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(detailTemplateName)) {
            throw new Error(
              `Invalid detail template "${detailTemplateName}" in data/${pageName}/${locale}.json`,
            );
          }

          const detailTemplatePath = path.join(dir, `${detailTemplateName}.hbs`);
          if (!fs.existsSync(detailTemplatePath)) {
            throw new Error(
              `Missing locale detail template: pages/${pageName}/${detailTemplateName}.hbs`,
            );
          }

          renderPage({
            pageName,
            templateName: detailTemplateName,
            templatePath: detailTemplatePath,
            data: {
              ...data,
              ...detail,
              language: detail.language || data.language || locale,
              htmlLanguage: detail.language || data.language || locale,
            },
            outDir: path.join(OUT, pageName, locale),
            outputName: `${detailId}.html`,
          });

          console.log(`✓ build ${pageName}/${locale}/${detailId}.html`);
        });
      }

      templates
        .filter((file) => ![path.basename(templatePath), 'detail.hbs'].includes(file))
        .forEach((file) => {
          const localizedTemplateName = path.basename(file, '.hbs');
          const localizedDataPath = path.join(
            ROOT,
            'data',
            pageName,
            `${localizedTemplateName}-${locale}.json`,
          );

          if (!fs.existsSync(localizedDataPath)) return;

          const localizedData = JSON.parse(
            fs.readFileSync(localizedDataPath, 'utf8'),
          );

          renderPage({
            pageName,
            templateName: localizedTemplateName,
            templatePath: path.join(dir, file),
            data: {
              ...localizedData,
              language: localizedData.language || locale,
              htmlLanguage: localizedData.language || locale,
            },
            outDir: path.join(OUT, pageName, locale),
            outputName: `${localizedTemplateName}.html`,
          });

          console.log(
            `✓ build ${pageName}/${locale}/${localizedTemplateName}.html`,
          );
        });
    });

    return;
  }

  const data = loadData(pageName);
  const outDir = path.join(OUT, pageName);
  fs.mkdirSync(outDir, { recursive: true });

  const layoutPath = data.layout
    ? `layouts/${data.layout}.hbs`
    : 'layouts/base.hbs';

  const layoutTpl = Handlebars.compile(
    fs.readFileSync(path.join(ROOT, layoutPath), 'utf8'),
  );

  /* ========= 1. BUILD PAGE BÌNH THƯỜNG (list, index, ...) ========= */
  templates.forEach((file) => {
    const templateName = path.basename(file, '.hbs');
    if (templateName === 'detail') return;

    const data = loadData(pageName, templateName); // ⭐ HERE


    if(data.qaGroup) {
      prepareNumOrder(data.qaGroup)
    }

    const tpl = Handlebars.compile(
      fs.readFileSync(path.join(dir, file), 'utf8'),
    );

    const body = tpl(data);

    const layoutPath = data.layout
      ? `layouts/${data.layout}.hbs`
      : 'layouts/base.hbs';

    const layoutTpl = Handlebars.compile(
      fs.readFileSync(path.join(ROOT, layoutPath), 'utf8'),
    );

    const html = layoutTpl({
      ...data,
      body,
      page: pageName,
      template: templateName,
    });

    fs.writeFileSync(path.join(outDir, `${templateName}.html`), html);

    console.log(`✓ build ${pageName}/${templateName}.html`);
  });

  /* ========= 2. BUILD DETAIL PER ITEM ========= */
  const detailTplPath = path.join(dir, 'detail.hbs');

  if (fs.existsSync(detailTplPath) && Array.isArray(data.items)) {
    const detailTpl = Handlebars.compile(
      fs.readFileSync(detailTplPath, 'utf8'),
    );

    data.items.forEach((item) => {
      if (!item.id) return;

      const body = detailTpl({
        ...data,
        item,
      });

      const html = layoutTpl({
        ...data,
        item,
        body,
        page: pageName,
        template: 'detail',
      });

      const output = path.join(outDir, `${item.id}.html`);
      fs.writeFileSync(output, html);

      console.log(`✓ build ${pageName}/${item.id}.html`);
    });
  }
}

function buildAll() {
  console.log('⚙️ rebuilding...');
  fs.readdirSync(PAGES).forEach((folder) => {
    const dir = path.join(PAGES, folder);
    if (fs.statSync(dir).isDirectory()) {
      buildPage(dir);
    }
  });
}

/* ========= WATCH + SERVER ========= */

function startDev() {
  buildAll();

  const watchDirs = [
    path.join(ROOT, 'pages'),
    path.join(ROOT, 'components'),
    path.join(ROOT, 'layouts'),
    path.join(ROOT, 'data'),
  ];
  watchDirs.forEach((dir) => {
    fs.watch(dir, { recursive: true }, () => {
      console.clear();
      buildAll();
    });
  });

  http
    .createServer((req, res) => {
      const reqPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(HOST, reqPath);

      const ext = path.extname(filePath).toLowerCase();

      const MIME = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.json': 'application/json',
      };

      // 1️⃣ serve file trực tiếp (asset + html)
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
        });
        return res.end(fs.readFileSync(filePath));
      }

      // 2️⃣ fallback html (append .html)
      const htmlPath = filePath.endsWith('.html')
        ? filePath
        : filePath + '.html';

      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(fs.readFileSync(htmlPath));
      }

      res.writeHead(404);
      res.end('Not found');
    })
    .listen(3000);

  console.log('🚀 http://localhost:3000/vikki-cvp');
}

/* ========= RUN ========= */
process.argv.includes('--watch') ? startDev() : buildAll();