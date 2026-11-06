const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const http = require('http');

// Register helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

const ROOT = __dirname;
// CVP_DATA_DIR / CVP_OUT_DIR / CVP_PAGES_DIR point a build at another copy of data/, another
// output folder and another copy of pages/ (the admin's preview and publish, admin/src/cvp), so
// the repo's own stay untouched. CVP_ONLY_PAGE builds that one page folder and no other.
const PAGES = process.env.CVP_PAGES_DIR ? path.resolve(process.env.CVP_PAGES_DIR) : path.join(ROOT, 'pages');
const DATA = process.env.CVP_DATA_DIR ? path.resolve(process.env.CVP_DATA_DIR) : path.join(ROOT, 'data');
const OUT = process.env.CVP_OUT_DIR ? path.resolve(process.env.CVP_OUT_DIR) : path.resolve(ROOT, '../vikki-cvp');
const ONLY_PAGE = process.env.CVP_ONLY_PAGE || '';
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
    path.join(DATA, pageName, `${templateName}.json`),

    path.join(DATA, pageName, 'list.json'),
    path.join(DATA, pageName, `${pageName}.json`),
    path.join(DATA, pageName, 'index.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }

  return {};
}

// ?lang=vi|en|ko (runtime/README.md). A page is built in each language it has a
// data/<page>/<lang>.json for; `en` stays first because the first file found
// decides the template's filename (buildPage).
const LOCALES = ['en', 'vi', 'ko'];
const DEFAULT_LOCALE = 'vi';
const FALLBACK_LOCALE = 'en';

function loadLocaleData(pageName, locale) {
  const dataPath = path.join(DATA, pageName, `${locale}.json`);
  if (!fs.existsSync(dataPath)) return null;

  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

const KNOWN_BLOCK_TYPES = new Set([
  'activation',
  'imageSection',
  'flex',
  'qa',
  'safePlusOverview',
  'safePlusPlanDetails',
  'slider',
  'list',
  'paragraph',
  'subheading',
  'table',
  'title',
  'tooltip',
  'topMenu',
  'video'
]);

function validateComponents(data, pageName, templateName) {
  if (data && Array.isArray(data.components)) {
    data.components.forEach((component, idx) => {
      if (!component || typeof component !== 'object' || !component.type) {
        throw new Error(
          `[Build Error] Missing or invalid "type" for component at index ${idx} in page "${pageName}/${templateName}"`
        );
      }
      if (!KNOWN_BLOCK_TYPES.has(component.type)) {
        throw new Error(
          `[Build Error] Unknown block type "${component.type}" at component index ${idx} in page "${pageName}/${templateName}". ` +
          `Registered types are: ${Array.from(KNOWN_BLOCK_TYPES).join(', ')}`
        );
      }
    });
  }
}

function renderPage({ pageName, templateName, templatePath, data, outDir, outputName }) {
  validateComponents(data, pageName, templateName);

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

/**
 * What the localeRedirect partial needs on a file built in several languages:
 * where each language's copy is, from the page's root (current = null) or from
 * the copy of `current` in <page>/<current>/.
 */
function localeRedirect(locales, outputName, current = null) {
  const prefix = current ? '../' : '';
  return {
    current,
    defaultLocale: DEFAULT_LOCALE,
    fallbackLocale: FALLBACK_LOCALE,
    variants: Object.fromEntries(
      locales.map((locale) => [locale, `${prefix}${locale}/${outputName}`]),
    ),
  };
}

const localeIndexTpl = Handlebars.compile(`<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>{{title}}</title>
  {{> localeRedirect}}
  <noscript><meta http-equiv="refresh" content="0; url={{noscriptHref}}" /></noscript>
</head>
<body></body>
</html>
`);

/**
 * Writes each file of a page built per language to <page>/<lang>/<file>, and
 * <page>/<file> as the file's one address: it opens the copy in the language
 * ?lang asks for (components/localeRedirect.hbs). A copy whose file exists in
 * other languages too carries the same redirect, for a ?lang naming another one.
 */
function buildLocalePage(pageName, files) {
  const localesByOutput = new Map();
  files.forEach(({ locale, outputName }) => {
    const locales = localesByOutput.get(outputName) || [];
    if (!locales.includes(locale)) locales.push(locale);
    localesByOutput.set(outputName, locales);
  });

  files.forEach(({ locale, outputName, templateName, templatePath, data }) => {
    const locales = localesByOutput.get(outputName);
    renderPage({
      pageName,
      templateName,
      templatePath,
      data:
        locales.length > 1
          ? { ...data, localeRedirect: localeRedirect(locales, outputName, locale) }
          : data,
      outDir: path.join(OUT, pageName, locale),
      outputName,
    });

    console.log(`✓ build ${pageName}/${locale}/${outputName}`);
  });

  localesByOutput.forEach((locales, outputName) => {
    const redirect = localeRedirect(locales, outputName);
    const shown = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0];
    const shownFile = files.find(
      (file) => file.locale === shown && file.outputName === outputName,
    );

    fs.writeFileSync(
      path.join(OUT, pageName, outputName),
      localeIndexTpl({
        lang: shown,
        title: shownFile.data.title,
        noscriptHref: redirect.variants[shown],
        localeRedirect: redirect,
      }),
    );

    console.log(`✓ build ${pageName}/${outputName} (?lang: ${locales.join(', ')})`);
  });
}

function buildPage(dir) {
  const pageName = path.basename(dir);
  const templates = fs.readdirSync(dir).filter((f) => f.endsWith('.hbs'));

  if (!templates.length) return;

  const localeData = LOCALES
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

    // Every file of the page in every language, written by buildLocalePage
    const files = [];

    localeData.forEach(({ locale, data }) => {
      // Output filename defaults to the page name (matching every other
      // template's own name -> its own .html), but a page can opt into a
      // different filename (e.g. "index") via an explicit "filename" field.
      const outputBaseName = data.filename || pageName;

      files.push({
        locale,
        outputName: `${outputBaseName}.html`,
        templateName: pageName,
        templatePath,
        data: {
          ...data,
          language: data.language || locale,
          htmlLanguage: data.language || locale,
        },
      });

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

          files.push({
            locale,
            outputName: `${detailId}.html`,
            templateName: detailTemplateName,
            templatePath: detailTemplatePath,
            data: {
              ...data,
              ...detail,
              language: detail.language || data.language || locale,
              htmlLanguage: detail.language || data.language || locale,
            },
          });
        });
      }

      templates
        .filter((file) => ![path.basename(templatePath), 'detail.hbs'].includes(file))
        .forEach((file) => {
          const localizedTemplateName = path.basename(file, '.hbs');
          const localizedDataPath = path.join(
            DATA,
            pageName,
            `${localizedTemplateName}-${locale}.json`,
          );

          if (!fs.existsSync(localizedDataPath)) return;

          const localizedData = JSON.parse(
            fs.readFileSync(localizedDataPath, 'utf8'),
          );

          files.push({
            locale,
            outputName: `${localizedTemplateName}.html`,
            templateName: localizedTemplateName,
            templatePath: path.join(dir, file),
            data: {
              ...localizedData,
              language: localizedData.language || locale,
              htmlLanguage: localizedData.language || locale,
            },
          });
        });
    });

    buildLocalePage(pageName, files);
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

    validateComponents(data, pageName, templateName);

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
    if (ONLY_PAGE && folder !== ONLY_PAGE) return;
    const dir = path.join(PAGES, folder);
    if (fs.statSync(dir).isDirectory()) {
      buildPage(dir);
    }
  });
}

/* ========= WATCH + SERVER ========= */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDirListing(dirPath, reqPath) {
  const base = reqPath.endsWith('/') ? reqPath : reqPath + '/';
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .filter((e) => e.isDirectory() || e.name.endsWith('.html'))
    .sort((a, b) =>
      a.isDirectory() === b.isDirectory()
        ? a.name.localeCompare(b.name)
        : a.isDirectory()
          ? -1
          : 1,
    );

  const parentPath = path.posix.dirname(base.slice(0, -1));
  const parent =
    base !== '/'
      ? `<li><a href="${escapeHtml(parentPath === '/' ? '/' : parentPath + '/')}">../</a></li>`
      : '';
  const items = entries
    .map((e) => {
      // thư mục có dấu "/" cuối để không bị fallback sang <name>.html
      const label = e.isDirectory() ? `${e.name}/` : e.name;
      const href = encodeURI(base + label);
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(base)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:24px 16px;line-height:1.7}
h1{font-size:1.25rem;margin:0 0 12px}ul{list-style:none;padding:0;margin:0}a{color:#0000ff;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><h1>${escapeHtml(base)}</h1><ul>
${parent}
${items}
</ul></body></html>`;
}

function startDev() {
  buildAll();

  const watchDirs = [
    path.join(ROOT, 'pages'),
    path.join(ROOT, 'components'),
    path.join(ROOT, 'layouts'),
    DATA,
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

      // 3️⃣ directory: index.html hoặc danh sách trang (dev only)
      const insideHost =
        filePath === HOST || filePath.startsWith(HOST + path.sep);
      if (
        insideHost &&
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isDirectory()
      ) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end(fs.readFileSync(indexPath));
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(renderDirListing(filePath, reqPath));
      }

      res.writeHead(404);
      res.end('Not found');
    })
    .listen(3000);

  console.log('🚀 http://localhost:3000/vikki-cvp');
}

/* ========= RUN ========= */
process.argv.includes('--watch') ? startDev() : buildAll();