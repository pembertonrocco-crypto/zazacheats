# Setup checklist

Do these in order. The whole thing takes about ten minutes.

## Why a page can come out blank — or 404

The nav links to `/pages/vouches`, `/pages/faq` and `/pages/about`. Those
pages do not exist until you create them, and their templates are
**alternate templates** that Shopify never applies automatically.

Two different symptoms, two different causes:

| What you see | What it means |
| --- | --- |
| **404 — page not found** | The page has not been created. Step 2. |
| Page title and nothing else | The page exists but is on "Default page". Step 2, the template dropdown. |

Both are admin-side. Nothing in the theme can create a page or detect that
one is missing.

## Fix the store name first

The header currently reads **ZC Community** on the live site, because that
is still the store's name in Shopify. The theme now overrides the wordmark
to "Resell Plug", but `shop.name` also drives:

- the browser tab and Google result titles
- the Organization structured data
- order confirmation emails and the checkout header

**Settings → Store details → Store name → Resell Plug.** Worth doing before
anything else, because it touches everything a customer sees after they
buy.

---

## 1. Upload and publish the theme

**Online Store → Themes → Add theme → Upload zip.** Preview it, then
**Publish**. Make sure the theme you are looking at is the published one —
previewing an older copy is an easy hour to lose.

## 2. Create the three pages

**Online Store → Pages → Add page**, three times. For each one, set the
**Theme template** dropdown on the right-hand side, then Save.

| Page title | URL handle must be | Theme template |
| --- | --- | --- |
| Vouches | `vouches` | **vouches** |
| FAQ | `faq` | **faq** |
| About | `about` | **about** |

The handle is under **Search engine listing → Edit** at the bottom of the
page editor. It has to match, because the navigation links to
`/pages/vouches`, `/pages/faq` and `/pages/about`.

Leave the page content itself empty. Everything on those pages comes from
the template.

**If the dropdown does not list `vouches`, `faq` and `about`:** you are
editing against a theme that does not have them. Publish the new theme
first, then come back.

## 3. Check the blog

The nav points at `/blogs/news`. Shopify creates a blog called **News** on
every store, so this usually works already — check under **Online Store →
Blog posts → Manage blogs**. If yours is named something else, either rename
it or change the nav link in **Theme editor → Header → Blog**.

## 4. Fill in the settings

**Theme editor → Theme settings → Resell Plug — funnel links.** The four
links and three numbers are already filled in. Confirm them.

## 5. Two things only you can do

- **Homepage → RP · Featured product → Featured product** — pick the
  Private Group Chat. It shows a placeholder until you do.
- **Homepage → RP · Who runs this** — your photo and name.

## 6. Products

Import `products-fix.csv` (**Products → Import**, tick *Overwrite any current
products that have the same handle*). Then paste the descriptions from
`PRODUCT-DESCRIPTIONS.md`.

## 7. Shopify branding — the three admin-side ones

The theme no longer shows any Shopify branding (see *Shopify branding* in the
README for the full list). Three pieces are outside the theme and need you:

**Shop Pay at the checkout itself.** The theme no longer shows the purple
*Buy with Shop Pay* button, but the checkout page is not part of the theme —
Shop Pay still appears there until you turn it off in **Settings → Payments →
Shop Pay → Deactivate**. Think before you do: it is a one-tap checkout for
anyone who has used it on another store, and losing it costs sales. Off in the
theme and on at the checkout is a reasonable place to stop.

**The `.myshopify.com` address.** Your store answers on
`<something>.myshopify.com` forever and that cannot be removed. What you can
do is make sure it never gets seen: **Settings → Domains** — `resell-plug.uk`
set as **primary**, with the myshopify address redirecting to it. Then every
link, email and share preview uses your domain.

**Order and shipping emails.** These come from **Settings → Notifications**,
not the theme, and they carry your *store name* — which is why the store name
matters (top of this file). Open the templates and check them once.

### What you may still see, and can ignore

- **The bar across the top with a bag icon, the theme name and a country
  picker** — that is the theme *preview* bar. It only appears while you are
  previewing an unpublished theme. Customers never see it.
- **`Shopify` in the page source.** Shopify injects its own analytics and
  checkout tokens into every page. It is invisible, it cannot be removed, and
  removing it would break the cart.

---

## Checking a page is right

Open `/pages/vouches`. You should see, top to bottom:

1. a band saying *The vouches channel is public* with a Telegram button
2. **20 screenshots in a grid**
3. *"That's 20 of them…"* and a green **See more vouches on Telegram**
4. the link tiles, then a shop CTA

If you see only a title, or an empty page — the template is not assigned.
Go back to step 2.

If you see *"Add screenshots to this section in the theme editor"* — the
template **is** assigned and working, but the images did not come across.
Open **Theme editor → Vouches page → RP · Proof slider** and re-add them.
