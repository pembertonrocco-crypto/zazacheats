#!/usr/bin/env node
/**
 * Synthetic-font-weight audit.
 *
 *   node tools/fonts.js
 *
 * NOT part of `npm test`, deliberately: this is the one check that needs the
 * real webfonts, so it hits the network and is not hermetic like the other
 * suites. Run it after touching type.
 *
 * What it catches: a stylesheet asking for a weight the loaded font does not
 * have. The browser does not fail — it stretches the nearest weight it does
 * have and paints a smeared approximation. That is invisible to every static
 * check and to any reasonable eye on a screenshot, and it is the single most
 * recognisable "cheap web page" tell.
 *
 * It was worth writing: the theme asked for Satoshi 800 in 146 places while
 * loading only 400/500/700, so the price, the buy button and most headings on
 * the whole site were synthetic bold. Some of it lived in CSS the platform
 * build had compiled into assets/script.js, where no amount of grepping the
 * templates would ever have found it.
 *
 * Keep LOADED in step with the Fontshare request in layouts/master.njk.
 */

const { PAGES, renderAll, serve, launchBrowser } = require('/home/user/zazacheats/tools/harness');
const fs=require('fs'), path=require('path');
const LOADED = { 'Satoshi':[300,400,500,700,900], 'Clash Display':[400,500,600,700] };
(async () => {
  renderAll();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport:{width:1440,height:1000}, hasTouch:false });
  await ctx.route('**://**', (route) => {
    const u=route.request().url();
    if (u.startsWith(base) || /fontshare|gstatic|googleapis/.test(u)) return route.continue();
    const V=[[/bootstrap@[\d.]+\/dist\/css\/bootstrap\.min\.css/,'bootstrap/dist/css/bootstrap.min.css','text/css'],
             [/bootstrap@[\d.]+\/dist\/js\/bootstrap\.bundle\.min\.js/,'bootstrap/dist/js/bootstrap.bundle.min.js','text/javascript'],
             [/alpinejs@[\d.]+\/dist\/cdn\.min\.js/,'alpinejs/dist/cdn.min.js','text/javascript']];
    const m=V.find(([re])=>re.test(u));
    if(m) return route.fulfill({status:200,contentType:m[2],body:fs.readFileSync(path.join('/home/user/zazacheats/node_modules',m[1]))});
    return route.abort();
  });
  const bad = new Map(); const fams = new Map();
  for (const [name] of PAGES) {
    const page = await ctx.newPage();
    await page.goto(`${base}/.render/${name}.html`, { waitUntil:'load' });
    await page.waitForTimeout(2200);
    const r = await page.evaluate((LOADED) => {
      const out=[], seen={};
      document.querySelectorAll('body *').forEach(el=>{
        if(!el.textContent || !el.textContent.trim()) return;
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden') return;
        const fam=(cs.fontFamily||'').split(',')[0].replace(/["']/g,'').trim();
        const w=parseInt(cs.fontWeight,10);
        seen[fam]=(seen[fam]||0)+1;
        if(!(fam in LOADED)) return;             // system/mono faces are fine
        if(LOADED[fam].indexOf(w)===-1){
          out.push({fam,w,cls:(el.className||el.tagName).toString().split(' ')[0]});
        }
      });
      return {out,seen};
    }, LOADED);
    r.out.forEach(o=>{ const k=`${o.fam} ${o.w} .${o.cls}  [${name}]`; bad.set(k,(bad.get(k)||0)+1); });
    Object.entries(r.seen).forEach(([f,n])=>fams.set(f,(fams.get(f)||0)+n));
    await page.close();
  }
  await browser.close(); server.close();
  console.log('\n  families rendering on the site:');
  [...fams.entries()].sort((a,b)=>b[1]-a[1]).forEach(([f,n])=>console.log(`    ${String(n).padStart(5)}  ${f}`));
  console.log(`\n  synthetic weights: ${bad.size}`);
  [...bad.keys()].slice(0,20).forEach(k=>console.log(`    ${k}`));
  process.exit(bad.size?1:0);
})();
