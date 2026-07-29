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
    run(context, name) {
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

env.addFilter('assetUrl', (f) => `https://cdn.example/assets/${f}`);
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
