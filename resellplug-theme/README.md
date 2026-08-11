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
| Free vs private | `rp-ladder` | Sells the paid tier without hiding the free one |
| Products | `rp-products` | The supplier vault |
| FAQ | `rp-faq` | Kills the scam objection first, then the rest |
| Final CTA | `rp-cta` | Last screen is the join button |
| Sticky bar | `rp-sticky-cta` | Join button in thumb reach on every page |

The primary action everywhere is the **free** community, not a product.
Someone who has watched one video will not send money, but they will join a
group — and the group is where the paid tier actually gets sold.

Product and collection pages now end with the FAQ and the free-group CTA, so
a visitor who is not ready to buy has somewhere to go other than back.

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
   a delivered haul, or a payout. The hero has a visible empty state until
   you do.

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
TikTok video  →  bio link (this site)  →  free Telegram  →  private community
```

Two things follow from that, and they are the reason the homepage is shaped
the way it is:

- **The bio link should be the homepage**, not a product page. The homepage
  is the only page that explains what this is before it asks for anything.
- **Send video traffic to a claim, not a catalogue.** If a video is about one
  supplier, `/#suppliers` still lands on the hero first — that is deliberate.

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

There is no build step. To sanity-check edits before uploading:

```bash
python3 tools/check.py     # JSON, {% schema %} blocks, tag balance, wiring
```

The design itself was measured in headless Chromium at 393px and 1280px:
no horizontal overflow, hero CTA above the fold on a phone, sticky bar 67px
and publishing its own height so it never covers the footer.
