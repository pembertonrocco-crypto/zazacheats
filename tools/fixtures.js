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

function baseContext(templateName, extra = {}) {
  return Object.assign(
    {
      templateName,
      shop,
      product,
      products: [product],
      // products-page.njk switches layout on `items`, not `products`
      items: [product, Object.assign({}, product, { id: 2, name: 'Rust NFA', path: 'rust-nfa' })],
      filters: { keyword: '', price: { from: null, to: null } },
      global: global_,
      properties: {
        title: 'Frequently Asked Questions',
        alignment: 'center',
        height: 'large',
      },
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

module.exports = { baseContext, shop, product, global_ };
