# Setup checklist

Do these in order. The whole thing takes about ten minutes.

## Why a page can come out blank

Four of the pages are **alternate templates**. Shopify does not apply those
automatically — it only uses one when a page has been created *and* that
template picked from a dropdown. A page left on "Default page" renders its
title and its (empty) body, which looks like the page is broken when it is
actually just pointing at the wrong template.

This is the single most likely reason something looks empty.

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
