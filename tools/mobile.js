#!/usr/bin/env node
/**
 * Real mobile-layout measurement.
 *
 * Renders each template to .render/, opens it in headless Chromium at phone
 * and small-tablet viewports with the real CSS applied, and measures what
 * static analysis cannot: actual horizontal overflow, actual tap-target
 * sizes, and computed font sizes on inputs.
 *
 *   node tools/mobile.js
 *
 * Third-party CSS (Bootstrap, fonts) is blocked so runs are offline and
 * deterministic. That means Bootstrap's grid is absent, so this measures the
 * theme's own layout — which is where the theme's own bugs are.
 */

const fs = require('fs');
const path = require('path');

process.env.ZZ_LOCAL_ASSETS = '1';
const { env, ROOT } = require('./render');
const { baseContext } = require('./fixtures');
const { chromium } = require('playwright');

const OUT = path.join(ROOT, '.render');

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667, dpr: 2 },
  { name: 'iPhone 14 Pro', width: 393, height: 852, dpr: 3 },
  { name: 'iPad mini', width: 768, height: 1024, dpr: 2 },
];

const PAGES = [
  ['shop', ['hero', 'products', 'feedbacks', 'faq']],
  ['product', ['product-page']],
  // product-page.njk gates snippets on product.path — the NFA branch shows
  // the showcase video facade, which the default branch never renders.
  ['product-nfa', ['product-page'], { product: { path: 'rust-nfa', name: 'Rust NFA' } }],
  ['products', ['products-page']],
  ['status', ['status-page']],
  ['feedback', ['feedback-page']],
  ['cart', ['cart-page']],
];

const MIN_TAP = 44; // WCAG 2.2 AA target size (minimum)
const MIN_INPUT_FONT = 16; // below this iOS Safari auto-zooms on focus

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

const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: [], taps: [], inputs: [], scrollWidth: 0 };

  out.scrollWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0
  );

  const visible = (el, r) => {
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;

    // Horizontal overflow: something sticking out past the viewport.
    // Fixed/sticky decorative layers are positioned deliberately and do not
    // create a scrollbar, so they are not overflow.
    const cs = getComputedStyle(el);
    if (r.right > vw + 1 && cs.position !== 'fixed' && cs.position !== 'sticky') {
      const scrollParent = el.closest('[style*="overflow"],.overflow-auto');
      if (!scrollParent) {
        out.overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
  }

  const INTERACTIVE = 'a[href],button,input,select,textarea,[role="button"],[role="slider"],[role="tab"],[tabindex="0"]';
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    if (el.type === 'hidden') continue;
    // Bootstrap's CSS is blocked in this run, so modal bodies render that
    // would normally be display:none until opened. Their sizing is Bootstrap's
    // job, not the theme's.
    if (el.closest('.modal, [role="dialog"]')) continue;

    // WCAG 2.2 target-size exception: a link sitting inline in a sentence is
    // sized by the text around it, and enlarging it would break the prose.
    // Detect it as an inline-display <a> whose parent holds real text beyond
    // the link itself.
    const cs2 = getComputedStyle(el);
    if (el.tagName === 'A' && cs2.display === 'inline') {
      const parentText = (el.parentElement ? el.parentElement.textContent : '').trim();
      const ownText = (el.textContent || '').trim();
      if (parentText.length > ownText.length + 12) continue;
    }

    // The skip link is reached by Tab, never by touch — it is not a target.
    if (el.classList.contains('zz-skip')) continue;

    // Accepted exception. The uptime grid is 90 day-cells across; at 44px it
    // would be six screens wide and stop being a chart. WCAG 2.2 allows an
    // undersized target where an equivalent one exists on the same page —
    // every cell links to a log entry, and that full dated log sits directly
    // below with full-width rows. Keyboard access is unaffected (each cell is
    // focusable with Enter/Space).
    if (el.classList.contains('zs-hist__cell')) continue;

    // Bootstrap's stylesheet is blocked in this run, so anything Bootstrap
    // sizes (.btn, .form-control, …) renders without its padding and would
    // report a height the live site never shows. Not the theme's to fix.
    if (/\b(btn|form-control|form-select|btn-close|form-check-input)\b/.test(el.className || '')) continue;

    // A control may carry its hit area on a pseudo-element (an invisible
    // centred box) so the visual size can stay small. getBoundingClientRect
    // does not see that, so read the pseudo's own min-width/min-height and
    // treat it as the effective target.
    let ew = r.width;
    let eh = r.height;
    for (const pseudo of ['::after', '::before']) {
      const ps = getComputedStyle(el, pseudo);
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
      ew = Math.max(ew, parseFloat(ps.minWidth) || 0);
      eh = Math.max(eh, parseFloat(ps.minHeight) || 0);
    }

    // 0.5px tolerance: a 44px target measures 43.99 after subpixel layout.
    if (ew < 43.5 || eh < 43.5) {
      out.taps.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 50),
        text: (el.textContent || '').trim().slice(0, 28),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }

  for (const el of document.querySelectorAll('input,select,textarea')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    if (['hidden', 'checkbox', 'radio', 'range', 'submit', 'button'].includes(el.type)) continue;
    const fs_ = parseFloat(getComputedStyle(el).fontSize);
    if (fs_ < 16) {
      out.inputs.push({
        cls: (el.className || '').toString().slice(0, 50),
        id: el.id,
        fontSize: fs_,
      });
    }
  }
  return out;
};

(async () => {
  renderAll();
  // Use the Chromium already present in the image rather than letting
  // Playwright download a build matching its own version.
  const CHROME = process.env.ZZ_CHROME || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(
    fs.existsSync(CHROME) ? { executablePath: CHROME } : {}
  );
  const findings = { overflow: new Map(), taps: new Map(), inputs: new Map() };
  let checked = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      // All three profiles are touch devices — a tablet is a coarse pointer
      // just as much as a phone. Gating this on width made the 768px run
      // report every (pointer:coarse) rule as missing.
      isMobile: true,
      hasTouch: true,
    });
    // Offline + deterministic: no third-party CSS/JS/fonts.
    await ctx.route('**://**', (route) =>
      route.request().url().startsWith('file://') ? route.continue() : route.abort()
    );

    for (const [name] of PAGES) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto('file://' + path.join(OUT, `${name}.html`), { waitUntil: 'load' });
      await page.waitForTimeout(250);

      const r = await page.evaluate(MEASURE);
      checked++;

      const key = (o) => `${o.tag || ''}.${o.cls || o.id || ''}`.replace(/\s+/g, '.');
      if (r.scrollWidth > vp.width + 1) {
        for (const o of r.overflow) {
          const k = key(o);
          if (!findings.overflow.has(k)) findings.overflow.set(k, { ...o, where: [] });
          findings.overflow.get(k).where.push(`${name}@${vp.width}`);
        }
      }
      for (const o of r.taps) {
        const k = key(o) + `|${o.w}x${o.h}`;
        if (!findings.taps.has(k)) findings.taps.set(k, { ...o, where: [] });
        findings.taps.get(k).where.push(`${name}@${vp.width}`);
      }
      for (const o of r.inputs) {
        const k = key(o);
        if (!findings.inputs.has(k)) findings.inputs.set(k, { ...o, where: [] });
        findings.inputs.get(k).where.push(`${name}@${vp.width}`);
      }
      for (const e of errs) console.log(`  JS ERROR ${name}@${vp.width}: ${e.split('\n')[0]}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();

  const show = (title, map, fmt) => {
    if (!map.size) return console.log(`\n✓ ${title}: none`);
    console.log(`\n\x1b[33m${title}\x1b[0m (${map.size})`);
    for (const v of map.values()) console.log('  ' + fmt(v) + `  [${v.where.slice(0, 3).join(', ')}]`);
  };

  show('Horizontal overflow', findings.overflow, (o) => `<${o.tag}> .${o.cls} extends to ${o.right}px (w=${o.width})`);
  show(`Tap targets under ${MIN_TAP}px`, findings.taps, (o) => `<${o.tag}> ${o.w}x${o.h} "${o.text}" .${o.cls}`);
  show(`Inputs under ${MIN_INPUT_FONT}px (iOS zooms on focus)`, findings.inputs, (o) => `${o.fontSize}px  #${o.id} .${o.cls}`);

  console.log(`\n${checked} page/viewport combinations measured across ${VIEWPORTS.map((v) => v.width + 'px').join(', ')}`);
  const fail = findings.overflow.size + findings.inputs.size;
  process.exit(fail ? 1 : 0);
})();
