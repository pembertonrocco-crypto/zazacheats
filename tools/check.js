#!/usr/bin/env node
/**
 * Theme checks. Renders every template through the layout and asserts the
 * things that are easy to break silently and expensive to notice in
 * production: template syntax, JSON-LD validity, metadata coverage, image
 * attributes, heading order, and link safety.
 *
 *   node tools/check.js          # run all checks
 *   node tools/check.js --html   # also dump rendered HTML to .render/
 *
 * Exit code is non-zero if any ERROR-level check fails. WARN-level findings
 * are reported but do not fail the run.
 */

const fs = require('fs');
const path = require('path');
const { env, ROOT } = require('./render');
const { baseContext } = require('./fixtures');

const DUMP = process.argv.includes('--html');
const errors = [];
const warns = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warns.push(`${page}: ${msg}`);

/* Which templates to render, and the component set each one shows. */
/* Both product branches: product-page.njk gates several snippets on
   product.path, so testing only one path leaves half the page unrendered. */
const PAGES = [
  ['shop', ['hero', 'products', 'feedbacks', 'faq']],
  ['product', ['product-page']],
  ['product-nfa', ['product-page'], { product: { path: 'rust-nfa', name: 'Rust NFA' } }],
  ['products', ['products-page']],
  ['status', ['status-page']],
  ['feedback', ['feedback-page']],
  ['faq', ['faq']],
  ['cart', ['cart-page']],
  ['terms', ['terms-page']],
  ['privacy-policy', ['privacy-policy-page']],
  ['refund-policy', ['refund-policy-page']],
  ['blog', ['blog-posts']],
  ['blog-post', ['blog-post-page']],
];

function renderPage(templateName, componentsOrder, overrides) {
  const real = templateName.replace(/-nfa$/, '');
  const ctx = baseContext(real, { components_order: componentsOrder });
  if (overrides && overrides.product) Object.assign(ctx.product, overrides.product);
  const tplFile = path.join(ROOT, 'templates', `${real}.njk`);
  ctx.templateContent = fs.existsSync(tplFile)
    ? env.render(`templates/${real}.njk`, ctx)
    : '<p>content</p>';
  return env.render('layouts/master.njk', ctx);
}

/* ---------------------------------------------------------------- checks */

function checkJsonLd(page, html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    n++;
    try {
      const data = JSON.parse(m[1]);
      if (!data['@context']) err(page, `JSON-LD block ${n} has no @context`);
      if (!data['@type']) err(page, `JSON-LD block ${n} has no @type`);
    } catch (e) {
      err(page, `JSON-LD block ${n} is not valid JSON — ${e.message}`);
    }
  }
  return n;
}

function checkMeta(page, html) {
  const one = (re, label) => {
    const hits = html.match(re) || [];
    if (hits.length === 0) return null;
    if (hits.length > 1) err(page, `${hits.length} ${label} tags (must be exactly 1)`);
    return hits[0];
  };

  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  if (!title || !title.trim()) err(page, 'missing or empty <title>');
  else if (title.length > 65) warn(page, `<title> is ${title.length} chars (>65 truncates in SERPs)`);

  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
  if (!desc || !desc.trim()) err(page, 'missing meta description');
  else if (desc.length > 165) warn(page, `meta description is ${desc.length} chars (>165 truncates)`);

  one(/<title>/gi, '<title>');
  one(/<link rel="canonical"/gi, 'canonical');

  const indexable = !/name="robots" content="noindex/i.test(html);
  if (indexable && !/<link rel="canonical"/i.test(html)) {
    warn(page, 'indexable page with no canonical');
  }
  for (const p of ['og:title', 'og:description', 'og:type', 'og:site_name']) {
    if (!html.includes(`property="${p}"`)) err(page, `missing ${p}`);
  }
  if (!html.includes('name="twitter:card"')) err(page, 'missing twitter:card');
}

/* Classes whose box is already reserved by a CSS aspect-ratio, so the image
   cannot shift layout and needs no width/height attributes. Verified against
   assets/pro.css and the per-component <style> blocks. */
const ASPECT_RESERVED = [
  'pp-carousel__img',
  'tp-card__img',
  'sp-card__img',
  'aspect-product-card-image',
  'aspect-group-card-image',
  'zaza-showcase__thumb',
];

function checkImages(page, html) {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgs) {
    if (!/\balt=/.test(tag)) {
      err(page, `<img> with no alt attribute: ${tag.slice(0, 110)}`);
    }
    // An empty/absent src is a placeholder that JS fills in later (lightboxes)
    // — it fetches nothing and occupies no flow, so loading/size hints are moot.
    const src = (tag.match(/\bsrc="([^"]*)"/) || [])[1];
    if (!src) continue;

    const reserved = ASPECT_RESERVED.some((c) => tag.includes(c));
    const decorative = /\balt=""/.test(tag);

    if (!/\bloading=/.test(tag) && !/fetchpriority="high"/.test(tag)) {
      warn(page, `<img> without loading hint: ${tag.slice(0, 90)}`);
    }
    if (!decorative && !reserved && !/\bwidth=/.test(tag)) {
      warn(page, `content <img> without width/height or CSS aspect-ratio (CLS risk): ${tag.slice(0, 90)}`);
    }
  }
  return imgs.length;
}

function checkHeadings(page, html) {
  // Headings inside a modal/dialog start their own labelling context (the
  // dialog is referenced by aria-labelledby), so they are not part of the
  // page outline. Bootstrap's own markup uses h5 for .modal-title; counting
  // those would flag every page for a jump that no reader experiences.
  const outline = html.replace(/<div[^>]*class="[^"]*\bmodal\b[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '');
  const hs = [...outline.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const h1 = hs.filter((h) => h === 1).length;
  if (h1 === 0) err(page, 'no <h1>');
  if (h1 > 1) err(page, `${h1} <h1> elements (must be exactly 1)`);
  let prev = 0;
  for (const h of hs) {
    if (prev && h > prev + 1) {
      warn(page, `heading level jumps h${prev} -> h${h}`);
      break;
    }
    prev = h;
  }
}

function checkLinks(page, html) {
  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) {
    if (!/rel="[^"]*noopener/.test(tag)) {
      err(page, `target="_blank" without rel="noopener": ${tag.slice(0, 100)}`);
    }
  }
}

function checkA11y(page, html) {
  if (!/class="zz-skip"/.test(html)) err(page, 'no server-rendered skip link');
  if (!/<main\b/.test(html)) err(page, 'no <main> landmark');
  if (!/<html lang=/.test(html)) err(page, 'no lang on <html>');
  for (const tag of html.match(/<button\b[^>]*>/gi) || []) {
    if (!/\btype=/.test(tag)) {
      warn(page, `<button> without explicit type (submits by default in forms): ${tag.slice(0, 80)}`);
    }
  }
}

/* This theme carries a lot of inline <script>. A syntax error in any of them
   silently kills that block on the live site, so parse every one. */
function checkInlineJs(page, html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const body = m[2];
    if (/\bsrc=/.test(attrs)) continue;
    if (/type=["'](application\/ld\+json|text\/template)["']/.test(attrs)) continue;
    if (!body.trim()) continue;
    n++;
    try {
      // Module scripts may use import/export, which `new Function` rejects.
      if (/type=["']module["']/.test(attrs)) new (require('vm').Script)(body, { filename: page });
      else new Function(body);
    } catch (e) {
      err(page, `inline <script> #${n} has a syntax error — ${e.message}`);
    }
  }
  return n;
}

function checkPerf(page, html) {
  const head = html.slice(0, html.indexOf('</head>'));
  // Every preconnect must precede the first external stylesheet to be useful.
  const firstExternalCss = head.search(/<link[^>]+rel="stylesheet"[^>]*href="https?:\/\//i);
  const lastPreconnect = head.lastIndexOf('rel="preconnect"');
  if (firstExternalCss > -1 && lastPreconnect > firstExternalCss) {
    err(page, 'a preconnect appears after the first external stylesheet (has no effect)');
  }
  for (const tag of html.match(/<script\b[^>]*\bsrc=[^>]*>/gi) || []) {
    if (!/\b(defer|async|type="module")/.test(tag)) {
      warn(page, `render-blocking script: ${tag.slice(0, 100)}`);
    }
  }
}

/* ------------------------------------------------------------------ run */

if (DUMP) fs.mkdirSync(path.join(ROOT, '.render'), { recursive: true });

let totalImgs = 0;
let totalLd = 0;
let totalJs = 0;

for (const [name, components, overrides] of PAGES) {
  let html;
  try {
    html = renderPage(name, components, overrides);
  } catch (e) {
    err(name, `render failed — ${e.message.split('\n')[0]}`);
    continue;
  }

  if (DUMP) fs.writeFileSync(path.join(ROOT, '.render', `${name}.html`), html);
  if (html.includes('<!-- MISSING ')) {
    for (const m of html.match(/<!-- MISSING [^>]+ -->/g)) err(name, m.replace(/<!--|-->/g, '').trim());
  }

  totalLd += checkJsonLd(name, html);
  totalImgs += checkImages(name, html);
  totalJs += checkInlineJs(name, html);
  checkMeta(name, html);
  checkHeadings(name, html);
  checkLinks(name, html);
  checkA11y(name, html);
  checkPerf(name, html);
}

/* --------------------------------------------------------------- report */

const byPage = (list) => {
  const grouped = {};
  for (const line of list) {
    const [page, ...rest] = line.split(': ');
    (grouped[page] = grouped[page] || []).push(rest.join(': '));
  }
  return grouped;
};

if (warns.length) {
  console.log(`\n\x1b[33mWARN\x1b[0m (${warns.length})`);
  const g = byPage(warns);
  for (const page of Object.keys(g)) {
    // Collapse repeats — 40 identical img warnings is noise, the count is signal.
    const counts = {};
    for (const w of g[page]) {
      const key = w.replace(/: <.*/, '');
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log(`  ${page}`);
    for (const [k, c] of Object.entries(counts)) {
      console.log(`    ${c > 1 ? `${c}x ` : ''}${k}`);
    }
  }
}

if (errors.length) {
  console.log(`\n\x1b[31mERROR\x1b[0m (${errors.length})`);
  const g = byPage(errors);
  for (const page of Object.keys(g)) {
    console.log(`  ${page}`);
    for (const e of [...new Set(g[page])]) console.log(`    ${e}`);
  }
}

console.log(
  `\n${PAGES.length} pages rendered · ${totalLd} JSON-LD blocks · ${totalImgs} images · ` +
    `${totalJs} inline scripts parsed · ` +
    `${errors.length} errors · ${warns.length} warnings`
);
process.exit(errors.length ? 1 : 0);
