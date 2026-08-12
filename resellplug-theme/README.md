# Resell Plug UK — Shopify theme

Dawn 15.4.1, rebuilt. Most traffic arrives from TikTok, on a phone.

**The positioning.** This is not a supplier-list shop. Every competitor sells
a recycled list and goes quiet, which is why nobody scales off one. This one
sells access to someone who has ordered from what he sells and answers you
afterwards — a fixer, not a vendor. The homepage title says exactly that and
*Why I'm not like the other plugs* is the argument for it.

The free Telegram community is a **side goal** — members and views. It lives
in the nav, the link tiles and the footer. It never gets a hero.

## Pages

| URL | Template | What it does |
| --- | --- | --- |
| `/` | `index.json` | Title + flagship product, then proof, then everything else |
| `/collections/all` | `collection.json` | The shop |
| `/pages/about` | `page.about.json` | Who you're dealing with |
| `/pages/faq` | `page.faq.json` | How it works + the full question list |
| `/pages/vouches` | `page.vouches.json` | Every proof screenshot as a grid |
| `/blogs/news` | `blog.json` | Free guides listing |
| a post | `article.json` | The reading page |

The three `page.*` templates need a page created in **Online Store → Pages**
with **Theme template** set to `about`, `faq` or `vouches`.

### Homepage order

1. `rp-featured` — the `<h1>` and the flagship product, together
2. `angels-proof-slider` — proof, second, deliberately
3. `rp-value` — why this isn't the competition
4. `rp-products` — the vault
5. `rp-founder` — the person behind it
6. `rp-faq` — objections
7. `rp-cta` — close

Header, ticker and the sticky bar come from `header-group.json` and
`footer-group.json`, so they appear on every page.

## Sections

```
rp-featured      page title + flagship product, price from a real product
rp-products      the grid; collection is a setting, not a hardcoded handle
angels-proof-slider  proof, as a scrolling strip or a full grid
rp-value         three-card argument
rp-founder       photo, story, TikTok link
rp-faq           accordion + FAQPage JSON-LD
rp-linkhub       community / vouches / TikTok / Linktree tiles
rp-cta           closing call to action
rp-header        brand, nav, shop button, working cart, Organization JSON-LD
rp-announcement  ticker
rp-sticky-cta    persistent buy button
rp-hero          free-community hero — unused, kept for reuse
rp-ladder        free-vs-paid comparison — unused, kept for reuse
rp-steps         how it works, used on the FAQ page
```

Every button reads its link from **Theme settings → Resell Plug — funnel
links**. There are no hardcoded URLs in any section.

## Proof is the main argument

It sits second on the homepage because the objection in this niche is never
"what is it", it is "is this real". Screenshots render at 380px on a phone
and 480px on desktop — a 300px chat screenshot is a grey smudge and a smudge
proves nothing.

`angels-proof-slider` has two layouts: **scrolling strip** for a page with
other things on it, **full grid** for `/pages/vouches`, where someone has
arrived specifically to read the evidence and a marquee they cannot pause is
the wrong shape.

## The fold, on a phone

The buy button's position is measured, not eyeballed. Square product images
and source order originally put it **1089px down an 852px screen**. Three
changes brought it to ~717px:

- the featured image is a 2:1 crop under 750px — these are digital products,
  the image is a cover, and its height is purely distance between the visitor
  and the button
- price and buy button jump above the feature list on mobile
- tighter title margins and a lower `h1` floor

Verified at 393×852 and 360×780: above the fold on both, no horizontal
overflow, no tap target under 44px, exactly one `h1`.

## Uniform product cards

Dawn's grids shipped with `image_ratio: "adapt"`, which gives every card its
own image's aspect ratio — so a tall screenshot and a square logo in the same
row produced visibly different card sizes. Collection, search and related
products are all `square` now. **If cards ever look uneven again, that
setting is the first thing to check.**

## Product descriptions

Written in the admin as rich text, they arrive as raw HTML, and Dawn styles
`.rte` for a light page — so any description with a heading, list or quote
was unreadable on this theme. `.rp-rte` covers headings, both list types,
quotes, tables, links and images, and breaks long pasted supplier URLs rather
than letting them shove a 393px screen sideways. Applied to the product page
and the homepage details dialog.

## Honest numbers

**Theme settings → Resell Plug — funnel links.**

| Setting | Value | Source |
| --- | --- | --- |
| Years trading | 2 | owner |
| Free public group | 220 | owner |
| Private GC | 22 | owner |
| Vouches posted | 112 | **unverified** — from the old banner, not in any live copy |

The previous theme ran a "live viewers" counter seeded from `Math.random()`
and a "price increasing in 59:54" timer that reset to 60:00 forever. Both are
gone and nothing here fabricates a number. Beyond being an ASA/CAP problem
for a UK site, a timer a visitor can watch reset reads as proof the whole
thing is fake — which works directly against the proof section.

Type `{members}`, `{private}`, `{years}`, `{vouches}` or `{suppliers}` in any
ticker line and the setting drops in.

## Knowing what works

Every CTA carries `data-rp-cta` naming its section. A click fires two neutral
signals — a `window.dataLayer` push of `rp_cta_click` (GTM reads it natively)
and an `rp:cta` DOM event. No third-party script, nothing personal, silent
no-ops if nothing is listening. Without it there is no way to see which
section drives a sale, because outbound clicks leave the site entirely.

```js
document.addEventListener('rp:cta', (e) => console.log(e.detail));
```

## Link previews

`og:image` only renders when Shopify sets `page_image`, which it does on
product and collection pages and **not** on the homepage — so the URL that
gets pasted into chats previewed as a bare line of text while `twitter:card`
claimed `summary_large_image`. `meta-tags.liquid` falls back to **Theme
settings → Default share image**. Upload a 1200×630.

## Installing

1. **Online Store → Themes → Add theme → Upload zip**
2. **Preview first** — homepage, a product page, the cart
3. Publish
4. Create the three pages and set their templates (see *Pages*)

Then in the customiser:

- **Homepage → RP · Featured product → Featured product** — pick the Premium
  GC. Shows a placeholder until you do.
- **Homepage → RP · Who runs this** — your photo and name.
- **Theme settings** — confirm the four links and the counts.

## Checks

```bash
pip install python-liquid    # for render.py only
python3 tools/check.py       # JSON, schemas, tag balance, wiring, links
python3 tools/render.py      # renders every rp-* section through real Liquid
bash tools/package.sh        # runs both, then builds the uploadable zip
```

`check.py` catches a template naming a section that does not exist, a setting
the schema never declares, or an empty funnel link — Shopify drops all three
silently, which is how a page ends up blank.

`render.py` evaluates the Liquid and asserts on the HTML: JSON-LD parses, no
unrendered `{{ }}`, no empty `href`, no `target="_blank"` without `rel`, one
`h1`. Shopify's filters are stubbed at the top of the file; add to them when
a section starts using a new one.

Four things it caught that reading the code did not:

- `limit` is a keyword in the `for` tag's argument list, so a setting named
  `section.settings.limit` cannot be read there. Dawn calls its equivalents
  `products_to_show` and `post_limit` for the same reason.
- `{% if a != blank and a > b %}` guards nothing — Liquid evaluates `and`/`or`
  **right to left**, so the comparison runs first and still receives the nil.
- `!= blank` against nil is not consistent between Liquid implementations.
  Normalise to a string and test `.size`.
- An unset URL setting rendered a link tile with an empty `href`.

## Shopify branding

Every piece of Shopify branding a theme controls is off. What was there:

| Where | What it was | Now |
| --- | --- | --- |
| Footer, every page | "Powered by Shopify" (`powered_by_link`) | removed |
| Footer | "Follow on Shop" button | off, and the schema default flipped to `false` so it cannot come back |
| Product page | *Buy with Shop Pay* / PayPal / Apple Pay | off |
| Cart page | the same accelerated-checkout row | off, behind a new setting so it matches the product page |
| Login page | *Log in with Shop* | off |
| Password page | Shopify wordmark, "This shop will be powered by Shopify", and an "are you the store owner? log in" link | all three removed |
| Theme list in admin | "Dawn — Shopify" | "Resell Plug — Resell Plug UK" |
| `assets/` | `icon-shopify.svg` | deleted |

Two of these are toggles rather than deletions, because they are the ones
worth reconsidering: **Product → Buy buttons → Show Shop Pay / PayPal / Apple
Pay** and the matching setting on **Cart**. Accelerated checkout buttons
usually lift completion — this is the one bit of platform branding that pays
for itself. If you turn one back on, turn on the other; showing them on the
product page and not in the cart is worse than either choice alone.

The footer copyright now reads **Theme settings → Brand name** and only falls
back to `shop.name`, so it says "Resell Plug" whether or not the store name
in the admin has been changed yet.

Three things a theme cannot reach — Shop Pay at the checkout itself, the
`.myshopify.com` fallback domain, and the notification emails. All three are
admin settings and all three are in `SETUP.md` step 7.

## Not in this repo

Prices, product names and descriptions live in the Shopify admin. So do
policies, shipping and checkout.
