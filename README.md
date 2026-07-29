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
npm run check          # renders all 12 templates and asserts against the HTML
npm run check:html     # same, plus writes the rendered HTML to .render/
```

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

Exit code is non-zero on ERROR; WARN is advisory. `tools/render.js` stubs the
platform's filters (`assetUrl`, `shopUrl`, `hex_to_rgb`, …) and its two custom
tags (`render_component`, `render_snippet`). When the platform adds a filter,
stub it there or the render fails locally while working fine in production.

## Performance decisions

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
re-encode came out *larger* — so do not "optimise" them again in place.

## Editing content

- Prices, variants, stock: SellAuth dashboard, not the theme.
- Section copy: `settings.json` under `templates.<route>.components`.
- Status incidents: the dated log is hardcoded in
  `components/status-page.njk`. It is append-only by intent — entries are
  never edited or removed, which is the whole point of the page.
- Contact address: `support@zazacheats.net`. Do not reintroduce a personal
  Gmail; it appears in the footer, terms, trust pledge, buy FAQ and the
  Organization JSON-LD.

## Not in this repo

The theme cannot reach these — they are platform or DNS level:

- HTTP response headers (CSP, HSTS, cache-control)
- `robots.txt` and `sitemap.xml`
- checkout, payment capture and automated key delivery
- rate limiting and any server-side validation
- the affiliate application endpoint (a separate Cloudflare Worker). It
  receives `customer_id` and `email` in the POST body from the client, so it
  must verify identity server-side rather than trusting them.
