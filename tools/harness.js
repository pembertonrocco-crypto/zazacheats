/**
 * Shared browser-measurement scaffolding for tools/mobile.js and
 * tools/desktop.js.
 *
 * Everything here is the part that is identical whatever viewport you are
 * measuring: render the templates, serve them, open a Chromium that behaves
 * like the real site. What differs between the two suites — the viewport
 * profiles, what gets measured, and how it is reported — stays in each file.
 *
 * Extracted when the desktop suite arrived, because the alternative was a
 * second copy of the serve/route/vendor plumbing, and the notes below (why
 * HTTP and not file://, why Alpine has to be real) are the kind of thing that
 * only gets fixed in one copy.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

process.env.ZZ_LOCAL_ASSETS = '1';
const { env, ROOT } = require('./render');
const { baseContext } = require('./fixtures');
const { chromium } = require('playwright');

const OUT = path.join(ROOT, '.render');

/* Both product branches are always rendered: product-page.njk gates snippets
   on product.path, so testing one path leaves the other half of the page —
   including the showcase video facade — completely unrendered. */
const PAGES = [
  /* The real homepage component list from settings.json. It used to omit
     `comparison` and `cta`, so every measurement of the longest, most-visited
     page on the site was taken against a shorter page than anyone actually
     gets — the same "fixture is the coverage" trap as the missing add-on. */
  ['shop', ['hero', 'products', 'comparison', 'feedbacks', 'faq', 'cta']],
  ['product', ['product-page']],
  ['product-nfa', ['product-page'], { product: { path: 'rust-nfa', name: 'Rust NFA' } }],
  ['products', ['products-page']],
  ['status', ['status-page']],
  ['feedback', ['feedback-page']],
  ['cart', ['cart-page']],
];

/* CDN URL -> local file, so the page runs with its real JS and CSS. */
const vendor = (p) => path.join(ROOT, 'node_modules', p);
const LOCAL_VENDOR = [
  [/bootstrap@[\d.]+\/dist\/css\/bootstrap\.min\.css/, vendor('bootstrap/dist/css/bootstrap.min.css'), 'text/css'],
  [/bootstrap@[\d.]+\/dist\/js\/bootstrap\.bundle\.min\.js/, vendor('bootstrap/dist/js/bootstrap.bundle.min.js'), 'text/javascript'],
  [/alpinejs@[\d.]+\/dist\/cdn\.min\.js/, vendor('alpinejs/dist/cdn.min.js'), 'text/javascript'],
];

function renderAll() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, components, overrides] of PAGES) {
    const real = name.replace(/-nfa$/, '');
    const ctx = baseContext(real, { components_order: components });
    if (overrides && overrides.product) Object.assign(ctx.product, overrides.product);
    const tpl = path.join(ROOT, 'templates', `${real}.njk`);
    ctx.templateContent = fs.existsSync(tpl)
      ? env.render(`templates/${real}.njk`, ctx)
      : '<p>content</p>';
    fs.writeFileSync(path.join(OUT, `${name}.html`), env.render('layouts/master.njk', ctx));
  }
}

/* Serve the repo over HTTP. file:// blocks the crossorigin="anonymous"
   script tags, which meant script.js never loaded, Alpine.data('app') was
   never registered, and every x-cloak'd element stayed display:none — so the
   product buy box measured zero and was silently never checked. */
function serve() {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.avif': 'image/avif', '.svg': 'image/svg+xml', '.json': 'application/json',
  };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/* Use the Chromium already present in the image rather than letting
   Playwright download a build matching its own version. */
function launchBrowser() {
  const CHROME = process.env.ZZ_CHROME || '/opt/pw-browsers/chromium';
  return chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});
}

/* Offline + deterministic, but NOT stripped-down: the CDN copies of Bootstrap
   and Alpine are served from node_modules instead of being blocked. This
   matters enormously — with Alpine missing, every x-cloak'd element stays
   display:none, which meant the entire product buy box (variant rows,
   quantity, buy button) measured zero and the most important component on the
   site was never checked at all. Everything else third-party (fonts,
   analytics, YouTube) is still blocked so runs stay hermetic. */
function routeOffline(ctx, base) {
  return ctx.route('**://**', (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    const local = LOCAL_VENDOR.find(([re]) => re.test(url));
    if (local) {
      return route.fulfill({ status: 200, contentType: local[2], body: fs.readFileSync(local[1]) });
    }
    return route.abort();
  });
}

module.exports = { ROOT, OUT, PAGES, renderAll, serve, launchBrowser, routeOffline };
