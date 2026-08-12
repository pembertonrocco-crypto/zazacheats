# Product descriptions — cleaned and rewritten

Descriptions live in the Shopify admin, not the theme, so these have to be
pasted in by hand: **Products → [product] → Description → `<>` (Show HTML) →
select all → paste.**

## What was actually wrong

Four things, and none of them were the words:

1. **Every line carried `<span style="color: #c6c3c3">`.** A mid-grey picked
   when the theme was white. Inline styles beat any stylesheet, so headings,
   bold text and list items all rendered the same flat grey — no hierarchy,
   low contrast on black. This is most of what "bugged" looked like. The
   theme now neutralises inline colours, but the rewrites below drop them so
   the markup is clean at the source.
2. **The 30-day description was entirely wrapped in one `<ul><li>`.** The
   whole product page sat inside a single bullet, indented, with a marker
   next to the heading.
3. **Stray empty tags** — an empty `<li>` at the end of the lifetime
   description rendered a bullet pointing at nothing, plus an empty
   `<strong></strong>`.
4. **`<h3>` used as a paragraph wrapper** with `<br><br>` inside it, so the
   opening block rendered at heading size.

Everything below is plain semantic HTML: `<h3>`, `<p>`, `<ul>`, `<strong>`.
No colours, no inline styles. The theme handles the appearance.

---

## 1. Private Group Chat — Lifetime Access (£174.99)

```html
<p><strong>Lifetime access. One payment, no subscription.</strong></p>

<p>A private, members-only reselling community for people who are serious
about it — real sourcing, products that are actually selling, and direct
help when you get stuck.</p>

<p>Most supplier lists are sold once and then the seller goes quiet. This
isn't that. Everything in here is sourcing I use myself, and you can message
me when something goes wrong.</p>

<h3>Make your mind up inside 15 minutes</h3>
<p>You get 15 minutes from the moment you enter the group chat to decide
whether you want to stay. If you'd rather leave, say so and you get a full
refund.</p>

<h3>What's included</h3>
<ul>
  <li><strong>150+ vetted supplier list, 10,000+ products</strong> — sorted
    by category so you can actually find things.</li>
  <li><strong>The products I'm currently selling</strong> — access to select
    products running in my own reselling business right now.</li>
  <li><strong>Winning product insights</strong> — what's moving, based on
    active reselling rather than guesswork.</li>
  <li><strong>Brand-specific sourcing</strong> — where to look for particular
    brands and categories.</li>
  <li><strong>Private freight forwarder access</strong> — introductions and
    the logistics side sorted.</li>
  <li><strong>Manufacturing and factory sourcing</strong> — how to find
    factories for private-label and wholesale, and how to talk to them.</li>
  <li><strong>Tools and software</strong> — what resellers actually use to
    automate and run the business.</li>
  <li><strong>Business documentation</strong> — invoices, email receipts and
    physical receipts for running things properly.</li>
  <li><strong>Members-only guides and updates</strong> — walkthroughs and
    strategies not posted publicly.</li>
</ul>

<h3>Worth knowing before you buy</h3>
<ul>
  <li>This is an educational, resource and networking community.</li>
  <li>No income is promised or guaranteed. What you get out depends entirely
    on what you put in.</li>
  <li>Access is delivered instantly after payment.</li>
</ul>
```

**Two changes to the copy, deliberately:**

- **"Discount for the next member!" is gone.** There is no compare-at price
  on this product, so the site shows no discount and never has — the line
  claims a saving that does not exist. If you want it back, set a
  compare-at price and it becomes true (and the theme will show a "Save £X"
  badge automatically).
- **The "easy methods for making money — refund methods" bullet is gone.**
  Refund methods means claiming refunds on goods you received and kept.
  That's fraud, and advertising it on a UK Shopify storefront puts the store
  itself at risk — it breaches Shopify's Acceptable Use Policy, and your
  payment processor will close the account if it's flagged. I'd take it out
  of the group as well, not just the listing.

---

## 2. Private Group Chat — 30 Days Access (£99.99)

Same content, correct structure, and an honest framing of what 30 days is
for. **Note the lifetime tier is only £75 more** — say so, and a good share
of these buyers will take the better one.

```html
<p><strong>30 days of access. Try the whole thing before committing.</strong></p>

<p>Everything in the private community for a month — the full supplier list,
the products I'm running, and direct access to me. If it earns its keep,
upgrade to lifetime.</p>

<h3>Make your mind up inside 15 minutes</h3>
<p>You get 15 minutes from the moment you enter the group chat to decide
whether you want to stay. If you'd rather leave, say so and you get a full
refund.</p>

<h3>What's included</h3>
<ul>
  <li><strong>150+ vetted supplier list, 10,000+ products</strong> — sorted
    by category.</li>
  <li><strong>The products I'm currently selling</strong> in my own business.</li>
  <li><strong>Winning product insights</strong> from active reselling.</li>
  <li><strong>Brand-specific sourcing information.</strong></li>
  <li><strong>Private freight forwarder access.</strong></li>
  <li><strong>Manufacturing and factory sourcing</strong> for private-label
    and wholesale.</li>
  <li><strong>Tools and software guidance.</strong></li>
  <li><strong>Business documentation</strong> — invoices and receipts.</li>
  <li><strong>Returns and refunds</strong> — handling customer returns
    properly and within platform rules.</li>
  <li><strong>Boutique store templates</strong> — ready-to-use storefront
    layouts.</li>
  <li><strong>Members-only guides and updates.</strong></li>
</ul>

<h3>Worth knowing before you buy</h3>
<ul>
  <li>Access runs for 30 days from purchase.</li>
  <li><strong>Lifetime access is £174.99</strong> — £75 more than this, and
    it never expires. If you already know you're staying, take that one.</li>
  <li>This is an educational, resource and networking community. No income is
    promised or guaranteed.</li>
</ul>
```

---

## 3. 150+ Supplier List (£24.99, was £49.99)

The original made the argument well but buried it in one `<h3>` with `<br>`
tags. Same argument, readable.

```html
<p><strong>150+ suppliers in one file. Stop paying £10 a time for them
individually.</strong></p>

<p>Every supplier shown on this website is in here — plus the rest of the
list that isn't public. The ones on the site are the specific ones I use as
my go-to.</p>

<p>Bought separately at £9.99 each, this list would run to roughly £1,500.</p>

<h3>What you get</h3>
<ul>
  <li><strong>150+ Yupoo suppliers</strong> across streetwear, footwear,
    eyewear, designer clothing and bags.</li>
  <li><strong>100,000+ products</strong> to pick from across the list.</li>
  <li><strong>A .docx spreadsheet</strong> of every supplier, plus a separate
    document covering the ones featured on this site.</li>
  <li><strong>The same list I use</strong> to find my own winning products.</li>
</ul>

<h3>Worth knowing before you buy</h3>
<ul>
  <li>Digital product — download link on screen the moment you pay, and by
    email.</li>
  <li>No income is promised or guaranteed.</li>
</ul>
```

---

## 4. Winning Products (£84.99)

The current description is three lines and gives a buyer nothing to judge at
£84.99 — it's the thinnest listing on the store relative to price. This needs
facts only you have. Fill the brackets and it's ready:

```html
<p><strong>The products actually generating the most revenue in my own
business right now.</strong></p>

<p>Not a list of ideas — the specific products I'm running and the numbers
behind them. Delivered as a private Telegram channel you keep access to.</p>

<h3>What you get</h3>
<ul>
  <li><strong>[X] winning products</strong>, each with the supplier attached.</li>
  <li><strong>Updated [how often]</strong> as products come and go.</li>
  <li><strong>Private Telegram channel</strong> — one-time payment, ongoing
    access.</li>
  <li><strong>[Margins / sell-through / whatever you can evidence]</strong></li>
</ul>

<h3>Worth knowing before you buy</h3>
<ul>
  <li>One-time payment. Access is delivered instantly.</li>
  <li>No income is promised or guaranteed.</li>
</ul>
```

**Three settings on this product need fixing in the admin — see below.**

---

## 5. R-Gen (£7.50)

I'm not writing marketing copy for this one. It generates receipts branded as
Nike, Apple, Gucci, StockX, Harrods and around a hundred other real
companies, including "eBay Authentication", "Vinted Authentication" and
"Moncler Authentication" — documents whose only use is convincing someone
that goods were bought somewhere they weren't, or authenticated when they
weren't. That's fraud and forgery of another company's documents, and writing
copy to sell it isn't something I'll do.

It's also the single biggest risk to the store. Shopify's Acceptable Use
Policy prohibits it outright, and a payment processor that spots it freezes
the account and holds the balance — which takes down the supplier lists and
both group chats with it. £7.50 a sale is not worth the other four products.

Happy to help with anything else on the store, including a genuine
receipt/invoice template product for a seller's *own* business, which is a
legitimate thing resellers need.

---

## Settings to fix in the admin

These are product settings, not descriptions, and two of them are actively
costing you sales:

| Product | Problem | Fix |
| --- | --- | --- |
| **Winning Products** | `Requires shipping` is **on**. It's a Telegram channel. | Uncheck it. Shopify is currently demanding a delivery address at checkout and may add shipping cost — on a digital product that reads as broken and loses the sale. |
| **Winning Products** | Inventory tracked, **qty 10**, policy `deny` | Untick "Track quantity". At 10 sales it goes out of stock and stops selling. |
| **Winning Products** | Vendor is `ZC Community` | Should be `Resell Plug`, like the other four. |
| **Private GC — Lifetime** | No compare-at price | If "Discount for the next member" is meant to be real, set one. Otherwise the claim has nothing behind it. |
| **All five** | Sit in collection `homepage` | Confirm all five are in it — the homepage grid reads that collection. |

## One more thing

The lifetime GC at £174.99 is the flagship and the site is built around it,
but £174.99 is a big first purchase from a TikTok viewer. The £24.99 supplier
list is the natural entry product — most people will buy that first, and the
GC second once it's paid for itself. The homepage supports both: flagship at
the top, the rest of the vault below it.
