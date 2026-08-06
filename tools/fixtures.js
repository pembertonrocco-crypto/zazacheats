/**
 * Mock SellAuth render context. Values only need to be shaped like the real
 * ones — the checks assert on structure, not on copy.
 */

const product = {
  id: 1,
  name: 'Zaza Rust Private Cheat',
  path: 'zaza-rust-private-cheat',
  description: '<p>Private Rust internal.</p>',
  meta_title: 'Zaza Rust Private Cheat',
  meta_description: 'Private Rust internal cheat with instant automated key delivery.',
  meta_image_url: 'https://cdn.example/og-product.jpg',
  meta_twitter_card: 'summary_large_image',
  min_price: 12.99,
  currency: 'USD',
  stock: 42,
  image_url: 'https://cdn.example/product.jpg',
  images: [{ url: 'https://cdn.example/product.jpg' }],
  /* The real tier names and prices from the live store. The names matter:
     product-form.njk switches its merchandising badges ("Most Popular",
     "Best Value") and its per-day / savings chips on exact variant names, so
     placeholder names like "30 Days" render a far narrower row than reality
     and hide layout bugs. Prices are the live ones, which is what makes the
     savings chips ("Save 67% vs daily", "Pays for itself in 9 weeks")
     actually appear. */
  variants: [
    { id: 11, name: '1 Day', price: 4.99, stock: 25, currency: 'USD' },
    { id: 12, name: '1 Week Key', price: 22.99, stock: 17, currency: 'USD' },
    { id: 13, name: '1 Month Key', price: 49.99, stock: 12, currency: 'USD' },
    { id: 14, name: 'Lifetime Key', price: 199.99, stock: 4, currency: 'USD' },
  ],
  groups: [],
};

/* The add-on row rendered under the quantity stepper on both product pages.
   It was missing from this file entirely, so neither browser suite had ever
   drawn one — which is how a `white-space: nowrap` on its description shipped
   and blew the whole buy box out past its container on desktop. The
   description is deliberately the real one, at its real length: a short
   placeholder wraps happily and hides exactly the bug this fixture exists to
   catch. */
const productAddons = [
  {
    id: 900,
    name: '6 Hours Warranty',
    currency: 'USD',
    description:
      'If it dies on arrival, we replace it. UP TO 3 TIMES. If the account is locked, ' +
      'banned, or unusable within 6 hours of purchase, open a Discord ticket and we\'ll ' +
      'swap it. After 6 hours the warranty ends — that\'s the window the market gives, ' +
      'and it\'s the window we honor. No warranty disputes over accounts you\'ve already ' +
      'played on for days.',
    image_urls: [],
    is_mandatory: false,
    variants: [{ id: 901, name: '6 Hours', price: 0.5, stock: -1, currency: 'USD' }],
  },
];

const shop = {
  id: 257236,
  name: 'Zaza Cheats',
  url: 'https://zazacheats.net',
  meta_title: 'Zaza Cheats',
  meta_description: 'Private Rust cheat and NFA accounts with instant delivery.',
  meta_image_url: 'https://cdn.example/og.jpg',
  meta_twitter_card: 'summary_large_image',
  favicon_url: 'https://cdn.example/favicon.png',
  logo_url: 'https://cdn.example/logo.png',
  average_rating: 4.9,
  background_image_url: null,
  recaptcha_key: null,
};

const global_ = {
  properties: {
    theme_color: '#BF40BF',
    primary_background_color: '#06091a',
    secondary_background_color: '#141414',
    primary_border_color: '#ffffff0d',
    font: 'Poppins',
    snow: false,
    smooth_scroll: true,
  },
};

/* settings.json keys its components by instance id ("feedbacks-1776878048349"),
   but a template asks for them by file name. Key on `type` so the lookup in
   render.js matches the {% render_component %} argument, and drop the hero's
   dashboard title so its own two-line headline is what gets measured — that
   headline is the fallback the live site does not use today, but it is the
   only thing in the theme that renders .hero-title-line--accent. */
function settingsProperties(templateName) {
  let settings;
  try {
    settings = require('../settings.json');
  } catch { return {}; }
  const components = ((settings.templates || {})[templateName] || {}).components || {};
  const out = {};
  for (const cfg of Object.values(components)) {
    if (cfg && cfg.type) out[cfg.type] = Object.assign({}, cfg.properties);
  }
  if (out.hero) out.hero.title = null;
  return out;
}

function baseContext(templateName, extra = {}) {
  return Object.assign(
    {
      templateName,
      shop,
      product,
      productAddons,
      products: [product],
      // products-page.njk switches layout on `items`, not `products`
      items: [product, Object.assign({}, product, { id: 2, name: 'Rust NFA', path: 'rust-nfa' })],
      filters: { keyword: '', price: { from: null, to: null } },
      global: global_,
      properties: {
        title: 'Frequently Asked Questions',
        alignment: 'center',
        height: 'large',
        /* The FAQ component renders from properties.items, which nothing here
           supplied — so every measurement of the homepage was taken with the
           FAQ section empty, and the real page is taller than the numbers
           said. Five entries, matching settings.json, at realistic length. */
        items: [
          { question: 'What payment methods do you accept?',
            answer: 'Card, Apple Pay, PayPal and several cryptocurrencies. Options are shown at checkout.' },
          { question: 'How do I contact support?',
            answer: 'Discord or a ticket. We typically respond within 10 minutes while we are online.' },
          { question: 'Are your products safe to use?',
            answer: 'Every product is tested before listing, and the live status page shows whether the build is currently undetected, updating or detected.' },
          { question: 'Do you offer any discounts?',
            answer: 'We run occasional promotions. Follow our socials or join the Discord to hear about them.' },
          { question: 'Can I use the product on multiple PCs?',
            answer: 'Each purchase is licensed to a single PC HWID, which keeps key sharing down and the detection rate low.' },
        ],
      },
      /* Per-component properties, read out of the theme's own settings.json
         and merged over `properties` by render.js. Before this there was one
         shared `properties` object, so every component on the homepage
         rendered the FAQ's title — the hero included, which meant the
         hardcoded two-line headline and its accent line were never rendered
         by any check, and every line-length measurement was taken against
         copy nobody will ever see. */
      componentProperties: settingsProperties(templateName),
      componentId: 'hero',
      components_order: [],
      currency: 'USD',
      currency_rates_usd: { usd: 1, eur: 0.92 },
      currency_symbols: { usd: '$', eur: '€' },
      shop_customer: null,
      isBuilder: false,
      altcha: false,
      altcha_shop_customer: false,
      categories: [],
      category: null,
      blogPost: { path: 'first-post', meta_title: 'First Post', meta_description: 'Hello', image_url: null },
      blogPosts: [],
      feedbacks: [],
      feedbacks_paginator: { total: 38, data: [], current_page: 1, last_page: 1 },
      ticket: { subject: 'Test' },
      tickets: [],
      invoices: [],
      custom_page: null,
      name: 'Custom Page',
      faqs: [],
      cart: { items: [] },
      statusVerifiedISO: '2026-07-27T12:00:00Z',
      schemaOrg: null,
      liveStats: { sales: 128, views: 4210 },
      templateContent: '<p>content</p>',
    },
    extra
  );
}

module.exports = { baseContext, shop, product, productAddons, global_ };
