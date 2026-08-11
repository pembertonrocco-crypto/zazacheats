/**
 * Offline renderer for the SellAuth theme.
 *
 * SellAuth renders these templates server-side with its own Nunjucks
 * environment, so nothing here runs in production. The point is to be able to
 * render every template locally against mock data and assert things about the
 * resulting HTML — otherwise the only way to find a broken tag, a malformed
 * JSON-LD block or a missing alt attribute is to deploy and look.
 *
 * It stubs the platform's custom filters and the two custom tags
 * ({% render_component %} / {% render_snippet %}).
 */

const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

const ROOT = path.join(__dirname, '..');

/* ------------------------------------------------------------------ *
 * Custom tags: {% render_component "navbar" %} / {% render_snippet %}
 * ------------------------------------------------------------------ */
function makeIncludeTag(tagName, dir) {
  return class {
    constructor() {
      this.tags = [tagName];
    }
    parse(parser, nodes) {
      const tok = parser.nextToken();
      const args = parser.parseSignature(null, true);
      parser.advanceAfterBlockEnd(tok.value);
      return new nodes.CallExtension(this, 'run', args);
    }
    /* Keyword arguments are forwarded.
     *
     * They used to be silently dropped: parseSignature collects them, but run()
     * only declared (context, name), so a call like
     *
     *   {% render_snippet "status-badge.njk", pname=product.name, pid=product.id %}
     *
     * rendered with pname and pid undefined. status-badge.njk only emits a
     * badge for a product it recognises, so it emitted nothing, and the
     * product page's status link came out as an anchor containing one
     * aria-hidden icon and no text — an unlabelled link in every audit, on a
     * page where the badge is fine in production. Every snippet that takes
     * arguments was affected the same way: feedback-card.njk (feedback=fb),
     * product-form.njk and zaza-nfa-block.njk (product=product),
     * pagination.njk (paginator=…). None of them were really being tested.
     *
     * Nunjucks passes keyword args as a final hash argument when the
     * signature has one, so the last argument is the kwargs object. */
    run(context, name) {
      const kwargs =
        arguments.length > 2 && arguments[arguments.length - 1] &&
        arguments[arguments.length - 1].__keywords
          ? arguments[arguments.length - 1]
          : null;

      if (!name) return new nunjucks.runtime.SafeString('');
      const file = String(name).endsWith('.njk') ? String(name) : `${name}.njk`;
      const full = path.join(ROOT, dir, file);
      if (!fs.existsSync(full)) {
        // A component listed in components_order that has no file is a real
        // problem on the platform too, so surface it rather than hiding it.
        return new nunjucks.runtime.SafeString(
          `<!-- MISSING ${dir}/${file} -->`
        );
      }
      const ctx = Object.assign({}, context.getVariables(), {
        componentId: String(name).replace(/\.njk$/, ''),
      });
      if (kwargs) {
        for (const k of Object.keys(kwargs)) {
          if (k !== '__keywords') ctx[k] = kwargs[k];
        }
      }
      return new nunjucks.runtime.SafeString(env.render(`${dir}/${file}`, ctx));
    }
  };
}

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(ROOT), {
  autoescape: true,
  throwOnUndefined: false,
});

env.addExtension('RenderComponent', new (makeIncludeTag('render_component', 'components'))());
env.addExtension('RenderSnippet', new (makeIncludeTag('render_snippet', 'snippets'))());

/* ------------------------------------------------------------------ *
 * Platform filters
 * ------------------------------------------------------------------ */
const hexToRgb = (hex) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(String(hex || '#000000'));
  return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)).join(', ') : '0, 0, 0';
};

/* Asset URLs resolve to the real local files when rendering to disk, so the
   dumped HTML can be opened in a browser with the actual CSS and images
   applied — that is what tools/mobile.js measures against. .render/ sits one
   level below the repo root, hence the ../. */
const LOCAL_ASSETS = process.env.ZZ_LOCAL_ASSETS === '1';
env.addFilter('assetUrl', (f) => (LOCAL_ASSETS ? `/assets/${f}` : `https://cdn.example/assets/${f}`));
env.addFilter('shopUrl', (p) => `https://zazacheats.net${p}`);
env.addFilter('apiInternalUrl', (p) => `https://api.example${p || ''}`);
env.addFilter('hex_to_rgb', hexToRgb);
env.addFilter('themeColor', () => '#BF40BF');
env.addFilter('json', (v) => new nunjucks.runtime.SafeString(JSON.stringify(v === undefined ? null : v)));
env.addFilter('renderString', (s) => new nunjucks.runtime.SafeString(String(s == null ? '' : s)));
env.addFilter('money', (v) => `$${Number(v || 0).toFixed(2)}`);
env.addFilter('date', (v) => String(v));
env.addFilter('markdown', (s) => new nunjucks.runtime.SafeString(String(s == null ? '' : s)));
env.addFilter('formatDate', (v) => String(v || '2026-07-27'));
env.addFilter('formatDateTime', (v) => String(v || '2026-07-27 12:00'));
env.addFilter('ytEmbedVideoId', (v) => String(v || 'dQw4w9WgXcQ'));

/* ------------------------------------------------------------------ *
 * Platform globals (`helpers.*`)
 * ------------------------------------------------------------------ */
env.addGlobal('formatPrice', (v, cur) => `${(cur || 'USD') === 'USD' ? '$' : ''}${Number(v || 0).toFixed(2)}`);
env.addGlobal('helpers', {
  numbers: {
    formatDecimal: (n, d = 2) => Number(n || 0).toFixed(d),
    formatCompact: (n) => {
      const v = Number(n || 0);
      return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
    },
  },
  components: {
    products: { getItemsByIds: () => [] },
  },
});

module.exports = { env, ROOT, nunjucks };
