#!/usr/bin/env node
/**
 * Render benchmark. Each engine runs in a fresh child process (isolated memory/JIT),
 * repeated RUNS times; the median run is reported. Measures:
 *   cold   = require engine + create renderer (template load/compile; esbuild for preact) + first render of 4 pages
 *   warm   = median time to render the 4 pages (vi/en x landing/document) after warm-up
 *   scale  = time to render SCALE_PAGES landing+document pages (alternating locales) back to back
 *   rss    = resident memory after the scale run
 * Eleventy is measured as a full CLI build (process start -> files written).
 */
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const RUNS = Number(process.env.RUNS || 5);
const WARM_ITER = Number(process.env.WARM_ITER || 30);
const SCALE_PAGES = Number(process.env.SCALE_PAGES || 1000);
const ENGINES = ['handlebars', 'nunjucks', 'liquid', 'eta', 'preact'];

function child(engine) {
  const { performance } = require('perf_hooks');
  const t0 = performance.now();
  const { loadViewModels } = require('./run-all');
  const vms = loadViewModels();
  const tPrep = performance.now();
  return (async () => {
    const r = await require(`./engines/${engine}/render`).createRenderer();
    for (const vm of vms) { await r.renderLanding(vm); await r.renderDocument(vm); }
    const cold = performance.now() - tPrep;
    const warm = [];
    for (let i = 0; i < WARM_ITER; i++) {
      const s = performance.now();
      for (const vm of vms) { await r.renderLanding(vm); await r.renderDocument(vm); }
      warm.push(performance.now() - s);
    }
    warm.sort((a, b) => a - b);
    const s = performance.now();
    let bytes = 0;
    for (let i = 0; i < SCALE_PAGES / 2; i++) {
      const vm = vms[i % 2];
      bytes += (await r.renderLanding(vm)).length + (await r.renderDocument(vm)).length;
    }
    const scale = performance.now() - s;
    process.stdout.write(JSON.stringify({
      prepMs: tPrep - t0, coldMs: cold, warmMedianMs: warm[warm.length >> 1], warmP95Ms: warm[Math.floor(warm.length * 0.95)],
      scaleMs: scale, scaleMB: bytes / 1e6, rssMB: process.memoryUsage().rss / 1e6
    }));
  })();
}

if (process.argv[2] === '--child') {
  child(process.argv[3]);
} else {
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
  const f = (n) => n.toFixed(1);
  console.log(`Environment: Node ${process.version}, ${os.cpus()[0].model}, ${os.cpus().length} cores, ${(os.totalmem() / 2 ** 30).toFixed(0)} GB RAM, ${os.platform()} ${os.release()}`);
  console.log(`RUNS=${RUNS} (median reported), WARM_ITER=${WARM_ITER}, SCALE_PAGES=${SCALE_PAGES}\n`);
  const rows = [];
  for (const e of ENGINES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      runs.push(JSON.parse(execFileSync(process.execPath, [__filename, '--child', e], { cwd: __dirname, maxBuffer: 1e7 }).toString()));
    }
    const m = (k) => med(runs.map((r) => r[k]));
    rows.push({ engine: e, 'cold ms': f(m('coldMs')), 'warm 4 pages ms': f(m('warmMedianMs')), 'warm p95 ms': f(m('warmP95Ms')),
      [`${SCALE_PAGES} pages ms`]: f(m('scaleMs')), 'pages/s': Math.round(SCALE_PAGES / (m('scaleMs') / 1000)), 'output MB': f(m('scaleMB')), 'RSS MB': f(m('rssMB')) });
  }
  console.table(rows);

  const eleventyDir = path.join(__dirname, 'engines', 'eleventy');
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const s = process.hrtime.bigint();
    const r = spawnSync('npx', ['@11ty/eleventy', '--config=eleventy.config.js', '--quiet'], { cwd: eleventyDir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    times.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  console.log(`Eleventy 3 (Nunjucks templates) full CLI build of the same 4 pages, incl. process start: median ${f(med(times))} ms`);
  const s = process.hrtime.bigint();
  execFileSync(process.execPath, ['-e', `require('./engines/nunjucks/render')`], { cwd: __dirname });
  console.log(`Reference: bare "node + require nunjucks renderer" process: ${f(Number(process.hrtime.bigint() - s) / 1e6)} ms`);
}
