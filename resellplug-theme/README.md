# Resell Plug UK — conversion rebuild

Shopify theme (Dawn 15.4.1) for the Resell Plug store, rebuilt around one
job: turn a TikTok viewer into a member of the free Telegram community, and
sell the private community to the people who stay.

## What was wrong

The export this started from had four structural problems, and they explain
the conversion rate better than any copy change would have:

1. **No headline.** `templates/index.json` contained a disabled image banner
   and four empty `_blocks` sections — nothing else. A visitor arriving from
   a video landed on a scrolling ticker and then straight into a grid of paid
   supplier cards, with no sentence anywhere on the page saying what the
   business is or what to do next.
2. **The whole site lived in the header group.** Every section — the product
   grid, the FAQ, the proof slider, the "don't trust it?" CTA — was a
   `custom-liquid` block inside `sections/header-group.json`. A header group
   renders on *every* page, so the full homepage was also printed on every
   product page and on the cart.
3. **Dawn's header was switched off.** No logo, no navigation, no cart icon.
   Once someone left the homepage there was no way back and no way to check
   out except the drawer.
4. **Every section fought the theme.** Colour schemes were still Dawn's white
   defaults, so each custom block shipped a "white box killer" rule forcing
   `background: #000 !important` onto `.shopify-section`, `.page-width`,
   `body` and more. Five copies of Montserrat were `@import`ed from Google
   inside `<style>` blocks in the body.

There was also a fake "live viewers" counter seeded from `Math.random()` and
a "price increasing in 59:54" timer that reset to 60:00 forever. Both are
gone — see *Honest numbers* below.

## What the site is now

**Homepage** (`templates/index.json`), in scroll order:

| Section | File | Job |
| --- | --- | --- |
| Ticker | `rp-announcement` | Real numbers, no invented urgency |
| Header | `rp-header` | Brand, anchors, join button, working cart |
| Hero | `rp-hero` | The headline, the free CTA, the proof numbers |
| What's free | `rp-value` | What actually lands in the chat |
| How it works | `rp-steps` | Makes step one look trivial |
| Proof | `angels-proof-slider` | Members' screenshots (all 20 carried over) |
| Who runs this | `rp-founder` | A face and a name — the one thing a scam page never has |
| Free vs private | `rp-ladder` | Sells the paid tier without hiding the free one |
| Products | `rp-products` | The supplier vault |
| FAQ | `rp-faq` | Kills the scam objection first, then the rest |
| Final CTA | `rp-cta` | Last screen is the join button |
| Sticky bar | `rp-sticky-cta` | Join button in thumb reach on every page |

The primary action everywhere is the **free** community, not a product.
Someone who has watched one video will not send money, but they will join a
group — and the group is where the paid tier actually gets sold.

Product and collection pages now end with the FAQ and the free-group CTA, so
a visitor who is not ready to buy has somewhere to go other than back. So do
the cart and the 404 page — both were dead ends.

**Link previews.** `og:image` only ever rendered when Shopify had set
`page_image`, which it does on product, collection and article pages and not
on the homepage. So the one URL that gets pasted into group chats and TikTok
bios previewed as a bare line of text while `twitter:card` claimed
`summary_large_image`. `snippets/meta-tags.liquid` now falls back to
**Theme settings → Default share image**, and emits `twitter:image` and
`og:image:alt` alongside it. Upload a 1200×630 image with the store name and
the free-group offer on it.

**Structured data.** The Organization and WebSite JSON-LD lived in Dawn's
`header.liquid` — disabled on this store, so neither had been reaching
Google. Both now render from `rp-header`, and `sameAs` lists the community
and vouches channels. Dawn's version printed every social setting whether set
or not, so an untouched store published an array of nulls; this one only
lists links that exist.

## The bio link: `/pages/free`

`templates/page.free.json` is a second landing page with **no product grid
and no paid tier**. Hero, what's free, proof, who runs this, four questions,
join. Every action on it goes to the same place.

That is what belongs in your TikTok bio. The homepage has to serve people who
arrived to buy as well as people who arrived from a video, so it carries a
supplier grid and a price comparison; this one carries one decision. Set it
up once:

1. **Online Store → Pages → Add page.** Title it whatever you like — *Free
   community* works.
2. In **Theme template** on the right, pick **free**.
3. Save, then put `yourstore.com/pages/free` in your TikTok bio.

Leave the homepage as the link you give people who ask what you sell.

## Knowing what works

Every join button carries `data-rp-cta` naming the section it sits in
(`hero`, `sticky`, `proof`, `founder`, `faq`…), and clicking one fires two
neutral signals:

- a `window.dataLayer` push of `rp_cta_click` — Google Tag Manager reads this
  with no extra code
- a `rp:cta` DOM event on `document`, for anything else

No third-party script is loaded and nothing personal is collected. If you
have neither GTM nor a listener, both are silent no-ops. Without this there
is no way to know which section sends people to the group, because the click
leaves for Telegram and Shopify's analytics never see it.

To watch it live, open the site, press F12, and paste into the console:

```js
document.addEventListener('rp:cta', (e) => console.log(e.detail));
```

## Setting it up

1. Shopify admin → **Online Store → Themes → Add theme → Upload zip**.
2. **Preview it first.** Check the homepage, one product page and the cart.
3. Publish.
4. Open the customiser → **Theme settings → Resell Plug — funnel links** and
   confirm the four links and three numbers. Everything on the site reads
   from here; there are no hardcoded links in any section.
5. **Theme settings → Resell Plug — funnel links → Private community
   product** does not exist — that one lives on the section. Open the
   homepage → *RP · Free vs private* → **Private community product** and pick
   the real product. Until you do, that column shows a placeholder price.
6. Homepage → *RP · Hero* → **Image**: upload a screenshot of the group chat,
   a delivered haul, or a payout. Without one the hero centres itself and
   still looks deliberate, so this is an upgrade rather than a blocker.
7. Homepage → *RP · Who runs this*: add your photo and your name. This is the
   highest-value box on the list — see below.

### The one setting that matters most

`Theme settings → Resell Plug — funnel links → Free community link`, set to
`https://t.me/repsreselling`. Every join button on the site — hero, ticker,
value section, ladder, proof, FAQ, footer CTA and the sticky bar — points at
it. Change it once and all nine move.

Each button appends a different `?src=` value (`hero`, `sticky`, `faq`,
`proof`…). Telegram ignores unknown parameters, but if you ever swap to a
link that reports join sources, that tells you which section is doing the
work.

## The TikTok funnel

The site is built to sit in the middle of this, not at the end of it:

```
TikTok video  →  /pages/free  →  free Telegram  →  private community
                     ↑
      homepage, for people who ask what you sell
```

Two things follow from that, and they are the reason the homepage is shaped
the way it is:

- **The bio link should be `/pages/free`**, never a product page. It is the
  only page with exactly one thing to do on it.
- **Send video traffic to a claim, not a catalogue.** If a video is about one
  supplier, `/#suppliers` still lands on the hero first — that is deliberate.

## Why there is a face on the page

Every other section answers "is this a scam" with other people's
screenshots. `rp-founder` answers it with a person, and it is the only
section that does. In a niche where the default assumption is that the seller
is anonymous and will disappear, a name, a photo and a link to the TikTok
account are the cheapest trust available — and the one thing a scam page
almost never has, because a scammer will not attach an identity to it.

The TikTok link earns its place twice: someone who arrived from a video can
confirm it is the same person, and someone who arrived from a forwarded link
can go and watch the videos.

## Honest numbers

The old ticker ran a viewer count that drifted randomly every 3.5 seconds and
a countdown that reset to 60:00 forever. They are both gone, and nothing in
this theme fabricates a number. Three reasons, in order of how much they cost
you:

1. The audience for a reselling group is the single most scam-aware audience
   on the internet. A timer they can watch reset is read as proof the whole
   site is fake — it works directly against the vouches wall two sections
   down.
2. A countdown implying a price rise that never happens is a misleading
   time-limited offer under the CAP Code, which applies to UK sites.
3. Shopify's Acceptable Use Policy covers deceptive practices.

The three numbers in `Theme settings` (`1,200+` members, `112` vouches, `20+`
suppliers) are placeholders **carried over from the old copy** — set them to
what you can screenshot, or blank them out. They print in the hero and in the
ticker via `{members}`, `{vouches}` and `{suppliers}`.

## Files added

```
assets/rp.css                    design system for every rp-* section
assets/rp.js                     FAQ, dialogs, sticky bar, marquee filling
snippets/rp-icon.liquid          inline icon set
snippets/rp-group-button.liquid  the join CTA — one definition, nine call sites
sections/rp-*.liquid             the nine funnel sections
sections/angels-proof-slider.liquid   rebuilt in place, blocks preserved
```

`config/settings_data.json` now carries dark colour schemes, so no section
needs to override the theme's background any more. Dawn's own sections
(cart, search, customer accounts, policies) inherit them and are dark too.

## Checking changes

There is no build step. Two checks, neither of which needs Shopify:

```bash
python3 tools/check.py      # JSON, {% schema %} blocks, tag balance, wiring
python3 tools/render.py     # renders every rp-* section through real Liquid
pip install python-liquid   # the one dependency, for render.py only
```

`check.py` is structural: it catches a template naming a section that does
not exist, or setting an id the section's schema never declares — Shopify
drops both silently, which is how a page ends up rendering blank.

`render.py` actually evaluates the Liquid against a mock context and asserts
on the HTML: JSON-LD parses and carries `@context`/`@type`, no `{{ }}` is
left unrendered, no empty `href`, no `target="_blank"` without `rel`, and
only the hero emits an `<h1>`. Shopify's filters and tags are stubbed at the
top of the file — when a section starts using one that isn't there, add it,
or the render fails locally while working fine in production.

It has already earned its keep. Three things it caught that reading the code
did not:

- `{% for product in products limit: section.settings.limit %}` — `limit` is
  a keyword in the `for` tag's own argument list, so a setting named `limit`
  cannot be read there. Dawn calls its equivalents `products_to_show` and
  `post_limit` for exactly this reason; so does this theme now.
- `{% if a != blank and a > b %}` does not guard anything. Liquid evaluates
  `and`/`or` **right to left**, so the comparison runs first and still gets
  handed the nil. The sale-badge tests are nested and computed once into an
  `on_sale` boolean instead.
- `!= blank` against nil is not consistent between Liquid implementations.
  Plain truthiness is, and is what those guards use.

The design itself was measured in headless Chromium at 393px and 1280px:
no horizontal overflow, hero CTA above the fold on a phone, sticky bar 67px
and publishing its own height so it never covers the footer. That pass found
the FAQ accordion never opening, a header that wrapped to two lines on a
phone, and a sticky bar eating 94px.
