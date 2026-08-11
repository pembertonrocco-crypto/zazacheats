# Zaza Cheats — SellAuth storefront theme

Nunjucks theme for zazacheats.net. **SellAuth renders these templates
server-side**; there is no build step, no bundler, and no client-side router.
Every page arrives as complete HTML, which is why the site is fast to first
paint and fully crawlable without any SSR work of our own.

## Layout

```
layouts/master.njk     the one layout — <head>, header, <main>, footer, scripts
templates/*.njk        one per route; each loops components_order
components/*.njk       dashboard-placeable blocks (hero, products, status-page…)
snippets/*.njk         fixed includes, rendered explicitly by name
assets/                CSS, JS and images served from the platform CDN
settings.json          which components each template shows, and their copy
schema.json            what the dashboard lets an editor configure
tools/                 local checks (never shipped)
```

A component is placeable from the SellAuth dashboard; a snippet is not.
Several components in `components/` are stock blocks this store does not
currently use — they are kept deliberately, because the owner can still add
them from the dashboard.

> **Platform quirk:** newly added `.njk` *snippet* files do not render on
> SellAuth. Anything genuinely new has to live in a file that is already
> being rendered — this is why the icon sprite sits in `layouts/master.njk`
> rather than in a snippet of its own.

## Checks

```bash
npm install
npm test               # both suites
npm run check          # renders all 13 templates and asserts against the HTML
npm run check:html     # same, plus writes the rendered HTML to .render/
npm run mobile         # real layout measurement in headless Chromium
npm run build:js       # assets/script.src.js -> assets/script.js
```

**`assets/script.js` is a build artifact.** It is `assets/script.src.js` run
through terser, and it is the file the layout actually loads. Editing the
source alone changes nothing on the site; run `npm run build:js` or the edit
does not ship.

`tools/check.js` renders every template through the layout against the mock
context in `tools/fixtures.js`, then asserts:

- templates render at all (a broken tag fails the run)
- every inline `<script>` parses — this theme leans on inline JS, where a
  syntax error is otherwise completely silent
- JSON-LD blocks are valid JSON with `@context` and `@type`
- exactly one `<h1>`, no skipped heading levels
- title / description / canonical / OG / Twitter coverage
- images have `alt`, and a loading hint and a reserved box
- `target="_blank"` always carries `rel="noopener"`
- skip link, `<main>`, `lang` are present
- no preconnect sits after the first external stylesheet, and no script is
  render-blocking

`tools/mobile.js` renders the same pages, opens them in headless Chromium at
320 / 375 / 393 / 768px with the real CSS applied, and measures what markup
alone cannot tell you: horizontal overflow, computed tap-target sizes, and
input font sizes. It found every touch fix listed below. Three things about
it:

- **320 comes first, and stays.** The suite used to start at 375, so nothing
  narrower had ever been measured — and 320 is where flex items with the
  default `min-width: auto` give up. The homepage scrolled sideways there,
  the buy box clipped its own prices, and the promo bar ellipsised its offer
  down to two characters, all invisible at 375. Anything that survives 320
  survives the rest.

- It blocks third-party CSS so runs are offline and deterministic, which
  means anything Bootstrap sizes (`.btn`, `.form-control`) is skipped — those
  are not the theme's to fix.
- All four viewport profiles run with `hasTouch: true`. A tablet is a coarse
  pointer too; gating that on width made the 768px run report every
  `(pointer:coarse)` rule as missing.

Both suites render **both product branches** — `product-page.njk` gates
snippets on `product.path`, so testing only one path leaves the NFA half of
the page (including the showcase video facade) completely unrendered.

Exit code is non-zero on ERROR; WARN is advisory. `tools/render.js` stubs the
platform's filters (`assetUrl`, `shopUrl`, `hex_to_rgb`, …) and its two custom
tags (`render_component`, `render_snippet`). When the platform adds a filter,
stub it there or the render fails locally while working fine in production.

Those two tags **forward keyword arguments**, and must keep doing so. They
did not until Aug 2026: `parseSignature` collected them but `run()` only
declared `(context, name)`, so `{% render_snippet "status-badge.njk",
pname=product.name %}` rendered with `pname` undefined. Every snippet that
takes arguments — `status-badge`, `feedback-card`, `product-form`,
`zaza-nfa-block`, `pagination` — was being rendered blank or half-empty, so
the checks were quietly passing over them.

## Performance decisions

**Nothing animates at 60fps, and nothing animates off-screen.** Three rules,
all measured rather than guessed:

- The two full-viewport fixed canvases (`snippets/polish.njk`'s atmosphere
  engine, `snippets/esp-field.njk`) run at **30fps**, paced by a timer that
  schedules the next `requestAnimationFrame`. Do not "fix" this by taking
  every rAF and returning early on the odd frames — that still wakes the main
  thread 60 times a second to decide to do nothing. Both are also
  desktop-only (`pointer: fine`): their content is deliberately biased to the
  screen edges to stay off the reading column, and a phone has no margin
  outside that column.
- Anything that pauses on tab-hide must **cancel** its rAF, not re-schedule
  and skip. Re-scheduling holds a callback the browser still has to consider.
- The animation warden in `assets/script.src.js` pauses **any** CSS animation
  with infinite iterations while its element is off-screen. It finds them via
  `document.getAnimations()` plus a bubbling `animationstart` listener, so
  nothing needs to be registered with it. One-shot entrance animations have
  finite iterations and are left alone, which is what makes it safe to apply
  blind. It replaced a hand-written list of six class names that matched none
  of the fourteen off-screen animations actually running on the homepage.

**No polling for state changes.** The cart summary and the sticky mobile buy
bar used `setInterval` at 600-700ms to notice that Alpine had re-rendered.
Both use a `MutationObserver` on the node they care about, coalesced through
rAF. If you need to react to Alpine, observe it; do not ask it twice a second
forever.

**Everything above the fold paints immediately.** The scroll-reveal effect
hides `.components > *` at `opacity:0`, and the first section of every page is
one of those. The in-viewport pass runs *synchronously* and tags those
elements `.zz-instant`, which suppresses the transition. Below-fold sections
keep the full entrance. Moving that pass into `requestAnimationFrame`, or
removing `.zz-instant`, puts a 0.9s fade back in front of the LCP element.

**Connection setup comes first in `<head>`.** Preconnects have to precede the
resources they warm; below the stylesheet links they do nothing.

**All five JS bundles are `defer`.** `defer` preserves execution order, which
the theme depends on: `script.js` registers `Alpine.data('app')` on
`alpine:init`, so it must run before Alpine. Inline scripts in the body run
*before* deferred bundles — so anything in a snippet that touches `Alpine`,
`bootstrap` or `Cookies` must guard with a `typeof` check and retry or fall
back. The existing call sites already do.

**Smooth scroll is opt-out by device.** Locomotive/Lenis owns the scroll
thread and is the largest INP liability here, so it loads only for fine
pointers, only without `prefers-reduced-motion`, and only at idle.

**Images.** Hero and showcase poster ship as AVIF/WebP with the original JPEG
as `<picture>` fallback. The source JPEGs are already well optimised — a q80
re-encode came out *larger* — so do not "optimise" them again in place. The
NFA showcase poster also carries a 1280w step: the frame measures ~330px on a
phone, so without it a phone downloads the full 1920px file to paint a third
of it.

## Mobile

Everything here is scoped to `(pointer: coarse)`, so the desktop design is
untouched — these rules only ever apply to fingers.

**Touch targets** live in one block in `layouts/master.njk`, not scattered
across components. Selectors are grouped by the display value the browser
actually computed, because that decides the fix: block-level controls need
centring alongside `min-height` or their label rides high in the taller box;
flex ones only need the height. Small icon buttons (the `×` closers) keep
their visual size and carry the hit area on an invisible centred
pseudo-element instead — a 44px `×` in a slim bar looks broken. That works
because all of them compute to `overflow: visible`, so it is never clipped.

**One deliberate exception:** the status page's 90-day uptime cells stay
small. At 44px the grid would be six screens wide and stop being a chart, and
WCAG 2.2 allows an undersized target where an equivalent exists — every cell
links into the full dated log directly below, which has full-width rows.

**Canvas loops are desktop-only.** `esp-field.njk` paints a full-viewport
canvas every frame for the whole homepage scroll. Its boxes are biased toward
the screen edges so they never sit under the reading column — but a phone has
no margin outside that column, so on touch devices it was a continuous
main-thread repaint for an effect nobody sees. The comparison slider's
particle loop now also pauses when the tab is hidden or the slider scrolls off
screen, and draws a single static frame under reduced motion.

**`min-height: 100vh` is always paired with `100dvh`.** On mobile the address
bar makes `vh` taller than the visible viewport; the `vh` line stays first as
the fallback for browsers without `dvh`.

**Inputs are 16px on touch.** Below that, iOS Safari zooms the whole page when
a field takes focus. Those rules need `!important`: component styles live in
`<style>` blocks rendered in the body, so at equal specificity they would win
on document order.

## Editing content

- Prices, variants, stock: SellAuth dashboard, not the theme.
- Section copy: `settings.json` under `templates.<route>.components`.
- Status incidents: the dated log is hardcoded in
  `components/status-page.njk`. It is append-only by intent — entries are
  never edited or removed, which is the whole point of the page.
- Contact address: `support@zazacheats.net`. Do not reintroduce a personal
  Gmail; it appears in the footer, terms, trust pledge, buy FAQ and the
  Organization JSON-LD.
- The 40 carried-over reviews: the `zzVouches` array at the top of the
  review block in `components/feedbacks.njk`. The same array is duplicated
  in `components/feedback-page.njk` and `snippets/zaza-product-block.njk`,
  and two of them are quoted as static HTML in `snippets/buy-faq.njk` and
  `snippets/store-conversion-strip.njk`. Change one, change all five —
  there is nowhere shared to put it, because a newly added snippet file
  does not render (see the platform quirk above). Reviews left through
  SellAuth after a purchase are separate: they come from the live feed and
  render above these automatically.

## Nothing on this site may be invented

The store has real evidence and does not need manufactured evidence. This
is a rule about the theme, not a style preference, and three things were
removed in August 2026 for breaking it:

- a "live activity" toast that generated a fake username, city and purchase
  from `Math.random()` every 20 seconds and labelled it LIVE and verified
- a footer stat strip whose "147 players online now" was a literal in
  `script.src.js`, animated on scroll as though it were being measured
- a review provenance line claiming the 40 imported reviews were carried
  over "word-for-word" after they had been re-typed

What is allowed is what can be checked: the platform's own feedback count
and average, the dated status log, SellAuth's real `latestOrders` feed
(which `components/product-page.njk` renders), and the published refund and
downtime terms. If a number cannot be traced to one of those, it does not
go on the page.

## Not in this repo

The theme cannot reach these — they are platform or DNS level:

- HTTP response headers (CSP, HSTS, cache-control)
- `robots.txt` and `sitemap.xml`
- checkout, payment capture and automated key delivery
- rate limiting and any server-side validation
- the affiliate application endpoint (a separate Cloudflare Worker). It
  receives `customer_id` and `email` in the POST body from the client, so it
  must verify identity server-side rather than trusting them.
