#!/usr/bin/env node
/**
 * Real desktop-layout measurement.
 *
 * The counterpart to tools/mobile.js. Everything above 768px had only ever
 * been judged by eye, which is how a desktop can sit on a stale review count
 * while a phone shows the right one — nothing was looking.
 *
 *   node tools/desktop.js
 *
 * Runs with hasTouch:false and a fine pointer, so this exercises the
 * desktop-only code paths specifically: the ESP canvas, the Locomotive
 * smooth-scroll import, and every :hover affordance. The mobile suite cannot
 * see any of those, because they are switched off on coarse pointers.
 *
 * Same hermetic setup as the mobile run (see tools/harness.js): real
 * Bootstrap and Alpine from node_modules, everything else third-party
 * blocked. Anything Bootstrap sizes is therefore the framework's business,
 * not the theme's.
 */

const path = require('path');

const { PAGES, renderAll, serve, launchBrowser, routeOffline } = require('./harness');

/* 1366 is still the most common laptop; 1920 is the modal desktop; 2560 is
   where a fluid layout stops being fluid and starts being stretched. */
const VIEWPORTS = [
  { name: 'Laptop', width: 1366, height: 768, dpr: 1 },
  { name: 'Desktop', width: 1920, height: 1080, dpr: 1 },
  { name: 'Wide', width: 2560, height: 1440, dpr: 1 },
];

const MAX_LINE_CH = 92;   // characters per line before prose gets hard to scan
const MIN_TEXT_LEN = 220; // only judge line length on real paragraphs
const IMG_WASTE = 2.2;    // intrinsic/rendered ratio worth re-encoding for

const MEASURE = ({ maxLineCh, minTextLen, imgWaste }) => {
  const out = { overflow: [], blowout: [], lines: [], focus: [], hover: [], images: [] };
  const vw = document.documentElement.clientWidth;

  const visible = (el, r) => {
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  const label = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (el.className || '').toString().slice(0, 60),
    id: el.id || '',
  });

  /* Bootstrap's own rules are not the theme's to fix — the same boundary the
     mobile suite draws when it skips anything .btn or .form-control sizes.
     Its reboot nulls the outline on :focus for components this theme does not
     even render (.form-range, .carousel-control-*), which is pure noise. */
  const ownSheets = () => {
    const list = [];
    for (const sheet of document.styleSheets) {
      if (sheet.href && /bootstrap/i.test(sheet.href)) continue;
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (rules) list.push(rules);
    }
    return list;
  };

  /* ---- horizontal overflow ----
     Identical reasoning to the mobile suite: "wider than the viewport" is the
     wrong test on this site, because marquees and carousels are deliberately
     thousands of pixels wide inside a clipping parent. The bug is spilling
     out of a parent that is NOT a scroller or clipper. */
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute') continue;
    if (el.closest('[aria-hidden="true"]')) continue;

    let parent = el.parentElement;
    while (parent && getComputedStyle(parent).display === 'contents') parent = parent.parentElement;
    if (!parent || parent === document.body) continue;
    if (getComputedStyle(parent).overflowX !== 'visible') continue;
    if (/\brow\b/.test(el.className || '')) continue;

    const spill = r.right - parent.getBoundingClientRect().right;
    if (spill > 2) {
      out.overflow.push({ ...label(el), spill: Math.round(spill), width: Math.round(r.width),
                          parent: (parent.className || parent.tagName || '').toString().slice(0, 40) });
    }
  }

  /* ---- container blowout ----
     The overflow check above cannot see this one. A CSS grid or flex track
     whose automatic minimum is min-content does not *spill* when something
     unbreakable lands in it — the track itself grows, so every element is
     still neatly inside its parent and nothing looks wrong locally. What
     actually breaks is further up: the capped container is exceeded and the
     siblings are crushed.

     That is exactly how the Rust NFA page shipped with its buy box at 1896px
     inside a 1120px layout, its media column squeezed to 42px and its variant
     cards running off the side of the screen, while the overflow check
     reported the page clean.

     So: measure against the nearest ancestor that actually caps its width.
     Anything wider than its own container has escaped. */
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'absolute') continue;
    if (el.closest('[aria-hidden="true"]')) continue;

    let cap = el.parentElement;
    let capWidth = 0;
    while (cap && cap !== document.body) {
      const ccs = getComputedStyle(cap);
      if (ccs.maxWidth && ccs.maxWidth !== 'none') {
        const m = parseFloat(ccs.maxWidth);
        if (m > 0) { capWidth = cap.getBoundingClientRect().width; break; }
      }
      if (ccs.overflowX !== 'visible') break;   // it clips on purpose
      cap = cap.parentElement;
    }
    if (!capWidth || !cap) continue;
    // Marquees and carousels are deliberately wider than everything.
    if (/marquee|carousel|track|rail|scroller/i.test((el.className || '').toString())) continue;

    const over = r.width - capWidth;
    if (over > 2) {
      out.blowout.push({
        ...label(el),
        width: Math.round(r.width),
        cap: Math.round(capWidth),
        over: Math.round(over),
        capCls: (cap.className || cap.tagName || '').toString().slice(0, 40),
      });
    }
  }

  /* ---- line length ----
     A mobile-first theme with no max-width caps turns a 2560px monitor into
     200-character lines, which is measurably harder to read. Measured as
     rendered width over the width of one character at the element's own font
     size (0.5em is the standard approximation for average glyph advance). */
  /* Measure the real advance width of "0" per font, which is exactly what the
     CSS `ch` unit is. An 0.5em approximation was close enough to flag the
     problem but disagreed with the stylesheet by ~25% — so a `max-width:74ch`
     fix still measured 94ch here, and the two numbers could never be
     reconciled. Cached per font shorthand; a canvas context is cheap. */
  const chCache = new Map();
  const chWidth = (font) => {
    if (chCache.has(font)) return chCache.get(font);
    const cv = chWidth.cv || (chWidth.cv = document.createElement('canvas'));
    const g = cv.getContext('2d');
    g.font = font;
    const w = g.measureText('0').width || 8;
    chCache.set(font, w);
    return w;
  };

  for (const el of document.querySelectorAll('p, li, blockquote, dd')) {
    const text = (el.textContent || '').trim();
    if (text.length < minTextLen) continue;
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    if (el.querySelector('p, li, div, section')) continue; // wrappers, not leaves

    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const ch = r.width / chWidth(cs.font || `${fs}px sans-serif`);
    if (ch > maxLineCh) {
      out.lines.push({ ...label(el), ch: Math.round(ch), px: Math.round(r.width),
                       fontSize: Math.round(fs), sample: text.slice(0, 40) });
    }
  }

  /* ---- keyboard focus ----
     master.njk ships a universal ring — `:focus-visible{outline:2px solid …}`
     — so the useful question is not "which elements have a focus style"
     (all of them do, and asking that way reported 107 phantom findings on the
     first run because a bare `:focus-visible` selector strips to an empty
     string and matches nothing). The question is which elements take that
     ring away again.

     So: find rules that null the outline in a genuinely focused state and put
     nothing back. `a:focus:not(:focus-visible){outline:none}` is the correct
     idiom for suppressing the ring on mouse clicks while keeping it for
     keyboards, and is explicitly not a finding. */
  const universal = (() => {
    for (const rules of ownSheets()) {
      for (const rule of rules) {
        if (!rule.selectorText || !rule.style) continue;
        const sel = rule.selectorText.replace(/\s+/g, '');
        if (sel !== ':focus-visible' && sel !== '*:focus-visible') continue;
        const o = rule.style.outline || rule.style.outlineWidth || rule.style.outlineStyle;
        if (o && o !== 'none' && o !== '0') return true;
      }
    }
    return false;
  })();
  if (!universal) {
    out.focus.push({ tag: 'html', cls: '', id: '', text: 'no universal :focus-visible ring' });
  }

  const norm = (t) => t.replace(/:focus-visible|:focus-within|:focus/g, '').replace(/\s+/g, ' ').trim();

  /* Every base that some rule gives a real :focus-visible ring to. A killer
     rule aimed at the same base is the paired idiom, not a defect — polish.njk
     writes it as `:focus{outline:none}` immediately followed by
     `:focus-visible{outline:2px …}`, which is the same thing as
     `:focus:not(:focus-visible)` and equally correct. */
  const ringed = new Set();
  for (const rules of ownSheets()) {
    for (const rule of rules) {
      if (!rule.selectorText || !rule.style) continue;
      if (rule.selectorText.indexOf('focus-visible') === -1) continue;
      const o = rule.style.outline || rule.style.outlineWidth || rule.style.outlineStyle;
      const shadow = rule.style.boxShadow && rule.style.boxShadow !== 'none';
      const real = (o && o !== 'none' && o !== '0' && o !== '0px') || shadow;
      if (!real) continue;
      for (const part of rule.selectorText.split(',')) ringed.add(norm(part));
    }
  }

  for (const rules of ownSheets()) {
    for (const rule of rules) {
      if (!rule.selectorText || !rule.style) continue;
      const sel = rule.selectorText;
      if (sel.indexOf('focus') === -1) continue;
      if (sel.indexOf(':not(:focus-visible)') > -1) continue;   // the correct idiom
      const o = rule.style.outline || rule.style.outlineStyle || rule.style.outlineWidth;
      const kills = o === 'none' || o === '0' || o === '0px';
      if (!kills) continue;
      const replaced = rule.style.boxShadow && rule.style.boxShadow !== 'none';
      const border = rule.style.border || rule.style.borderColor;
      if (replaced || border) continue;                          // ring swapped, not removed
      const unpaired = sel.split(',').map(norm).filter((b) => !ringed.has(b));
      if (!unpaired.length) continue;                            // paired with a real ring
      out.focus.push({ tag: 'css', cls: sel.slice(0, 70), id: '', text: 'outline removed on focus' });
    }
  }

  /* ---- oversized images ----
     The desktop mirror of the 1280w step the README describes for the NFA
     poster: a file whose intrinsic size dwarfs the box it paints into is
     bytes the visitor pays for and never sees. */
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    if (!visible(img, r) || !img.naturalWidth || r.width < 4) continue;
    const ratio = img.naturalWidth / (r.width * (window.devicePixelRatio || 1));
    if (ratio >= imgWaste) {
      out.images.push({
        src: (img.currentSrc || img.src || '').split('/').pop().slice(0, 44),
        natural: img.naturalWidth,
        rendered: Math.round(r.width),
        ratio: Math.round(ratio * 10) / 10,
      });
    }
  }

  out.scrollWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0
  );
  out.vw = vw;
  return out;
};

(async () => {
  renderAll();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();

  const findings = {
    overflow: new Map(), blowout: new Map(), lines: new Map(), focus: new Map(),
    hover: new Map(), images: new Map(),
  };
  let checked = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      // The whole point of this suite: a real desktop is a fine pointer with
      // no touch, so the canvas and smooth-scroll paths that mobile.js can
      // never reach are the ones running here.
      isMobile: false,
      hasTouch: false,
    });
    await routeOffline(ctx, base);

    for (const [name] of PAGES) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(`${base}/.render/${name}.html`, { waitUntil: 'load' });
      // Alpine boots on DOMContentLoaded and drops x-cloak; entrance
      // animations run transforms for ~1s. Measuring mid-flight turns a
      // transform into a phantom overflow that changes between runs.
      await page.waitForTimeout(1400);

      const r = await page.evaluate(MEASURE, {
        maxLineCh: MAX_LINE_CH, minTextLen: MIN_TEXT_LEN, imgWaste: IMG_WASTE,
      });
      checked++;

      const at = `${name}@${vp.width}`;
      const add = (map, key, val) => {
        if (!map.has(key)) map.set(key, { ...val, where: [] });
        map.get(key).where.push(at);
      };
      const key = (o) => `${o.tag || ''}.${o.cls || o.id || ''}`.replace(/\s+/g, '.');

      for (const o of r.overflow) add(findings.overflow, key(o), o);
      for (const o of r.blowout) add(findings.blowout, key(o), o);
      for (const o of r.lines) add(findings.lines, key(o) + '|' + o.sample, o);
      for (const o of r.focus) add(findings.focus, key(o) + '|' + o.text, o);
      for (const o of r.hover) add(findings.hover, o.sel, o);
      for (const o of r.images) add(findings.images, o.src + '|' + o.rendered, o);
      for (const e of errs) console.log(`  JS ERROR ${at}: ${e.split('\n')[0]}`);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  server.close();

  const show = (title, map, fmt) => {
    if (!map.size) return console.log(`\n✓ ${title}: none`);
    console.log(`\n\x1b[33m${title}\x1b[0m (${map.size})`);
    for (const v of map.values()) console.log('  ' + fmt(v) + `  [${v.where.slice(0, 3).join(', ')}]`);
  };

  show('Horizontal overflow', findings.overflow,
       (o) => `<${o.tag}> .${o.cls} spills ${o.spill}px out of .${o.parent}`);
  show('Wider than their container', findings.blowout,
       (o) => `<${o.tag}> .${o.cls} is ${o.width}px inside a ${o.cap}px .${o.capCls} (+${o.over})`);
  show(`Lines over ${MAX_LINE_CH} characters`, findings.lines,
       (o) => `${o.ch}ch (${o.px}px @ ${o.fontSize}px) <${o.tag}> .${o.cls} — "${o.sample}…"`);
  show('No visible focus indicator', findings.focus,
       (o) => `<${o.tag}> .${o.cls || o.id} "${o.text}"`);
  show('Hover-only reveal, no focus equivalent', findings.hover, (o) => o.sel);
  show('Images larger than their box', findings.images,
       (o) => `${o.src} — ${o.natural}px natural into ${o.rendered}px (${o.ratio}x)`);

  console.log(
    `\n${checked} page/viewport combinations measured across ` +
    `${VIEWPORTS.map((v) => v.width + 'px').join(', ')}`
  );

  /* Overflow is a defect — content is cut off or the page scrolls sideways.
     The rest is advisory: line length and image sizing are judgement calls,
     and focus/hover findings need a human to confirm the control is real. */
  process.exit(findings.overflow.size + findings.blowout.size ? 1 : 0);
})();
