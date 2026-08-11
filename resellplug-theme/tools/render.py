#!/usr/bin/env python3
"""Render every rp-* section through a real Liquid engine and assert on the
HTML that comes out.

    python3 tools/render.py

tools/check.py can only see that the tags balance. This actually evaluates
them, which is what catches a mistyped filter name, a variable that is never
defined, or JSON-LD that stops being valid JSON once the values are in it.

The platform's filters and tags are stubbed below. They are stubs, not
reimplementations — the point is to exercise this theme's own logic, not to
be Shopify. When a section starts using a filter that isn't here, add it, or
the render fails locally while working fine in production.
"""
import glob
import json
import os
import re
import sys

from liquid import Environment
from liquid.builtin.tags.include_tag import IncludeTag
from liquid.exceptions import LiquidError

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SCHEMA_RE = re.compile(r'\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}', re.S)

# --------------------------------------------------------------------------
# Platform stubs
# --------------------------------------------------------------------------


class Img(dict):
    """Stands in for a Shopify image drop; `| image_url` returns a path."""

    def __init__(self, src='//cdn.shopify.com/x.jpg', alt='', width=1200, height=1200):
        super().__init__(src=src, alt=alt, width=width, height=height)
        self.src, self.alt, self.width, self.height = src, alt, width, height

    def __str__(self):
        return self.src

    def __bool__(self):
        return bool(self.src)


def f_image_url(value, *args, **kwargs):
    return str(value) if value else ''


def f_image_tag(value, *args, **kwargs):
    attrs = ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in kwargs.items() if v not in (None, ''))
    return f'<img src="{value}" {attrs}>'


def f_asset_url(value, *a, **k):
    return f'//cdn.shopify.com/assets/{value}'


def f_stylesheet_tag(value, *a, **k):
    return f'<link rel="stylesheet" href="{value}">'


def f_money(value, *a, **k):
    try:
        return f'£{int(value) / 100:.2f}'
    except (TypeError, ValueError):
        return '£0.00'


def f_json(value, *a, **k):
    if isinstance(value, Img):
        value = value.src
    return json.dumps(value)


def f_t(value, *a, **k):
    return str(value)


def f_placeholder_svg_tag(value, *a, **k):
    return '<svg class="placeholder"></svg>'


def f_inline_asset_content(value, *a, **k):
    return '<svg></svg>'


def f_handle(value, *a, **k):
    return re.sub(r'[^a-z0-9]+', '-', str(value).lower()).strip('-')


def f_url_encode(value, *a, **k):
    from urllib.parse import quote
    return quote(str(value), safe='')


def f_money_without_currency(value, *a, **k):
    return f_money(value).lstrip('£')


FILTERS = {
    'image_url': f_image_url, 'image_tag': f_image_tag, 'asset_url': f_asset_url,
    'stylesheet_tag': f_stylesheet_tag, 'script_tag': f_stylesheet_tag,
    'money': f_money, 'money_without_currency': f_money_without_currency,
    'json': f_json, 't': f_t, 'placeholder_svg_tag': f_placeholder_svg_tag,
    'inline_asset_content': f_inline_asset_content, 'handle': f_handle,
    'handleize': f_handle, 'url_encode': f_url_encode, 'link_to': f_t,
    'font_face': f_t, 'font_url': f_t, 'font_modify': f_t,
    'payment_button': f_t, 'weight_with_unit': f_t, 'highlight': f_t,
}


class SchemaTag(IncludeTag):
    """{% schema %} … {% endschema %} emits nothing at render time."""


# --------------------------------------------------------------------------
# Mock context
# --------------------------------------------------------------------------


def product(pid, title, price, compare=None, available=True):
    variant = {'id': pid * 10, 'price': price, 'compare_at_price': compare,
               'available': available, 'title': 'Default'}
    return {
        'id': pid, 'title': title, 'url': f'/products/{f_handle(title)}',
        'price': price, 'compare_at_price': compare,
        'description': '<p>Supplier contact plus the full catalogue.</p>',
        'featured_image': Img(alt=title), 'available': available,
        'selected_or_first_available_variant': variant,
        'variants': [variant], 'vendor': 'Resell Plug',
    }


PRODUCTS = [
    product(1, 'Yupoo Vault Tier 1', 2499, 4999),
    product(2, 'Footwear Supplier Pack', 1999),
    product(3, 'Private Community', 3499, 7999),
    product(4, 'Sold Out Vault', 999, None, available=False),
]

SETTINGS = {
    'rp_group_url': 'https://t.me/repsreselling',
    'rp_group_platform': 'Telegram',
    'rp_vouches_url': 'https://t.me/resellplugvouches',
    'rp_tiktok_url': '',
    'rp_stat_members': '1,200+', 'rp_stat_vouches': '112', 'rp_stat_suppliers': '20+',
    'rp_share_image': Img(),
    'logo': Img(), 'social_tiktok_link': '', 'social_instagram_link': '',
    'social_youtube_link': '', 'social_twitter_link': '', 'social_facebook_link': '',
}

BASE = {
    'settings': SETTINGS,
    'shop': {'name': 'Resell Plug UK', 'description': 'UK reselling community'},
    'request': {'page_type': 'index', 'origin': 'https://resellplug.co.uk'},
    'routes': {'root_url': '/', 'cart_url': '/cart', 'search_url': '/search'},
    'cart': {'item_count': 2, 'currency': {'iso_code': 'GBP'}},
    'collections': {'homepage': {'products': PRODUCTS}},
    'product': PRODUCTS[0],
    'page': {'url': '/'},
    'page_image': None,
    'page_title': 'Resell Plug UK',
    'page_description': 'Join the free UK reselling community.',
    'canonical_url': 'https://resellplug.co.uk/',
}


def defaults_from_schema(schema):
    """The theme editor fills unset settings from the schema defaults; a JSON
    template does not. Rendering with the defaults matches what an editor who
    just added the section from the picker actually sees."""
    out = {}
    for setting in schema.get('settings', []):
        if 'id' in setting:
            out[setting['id']] = setting.get('default', '')
    return out


def blocks_from_preset(schema):
    presets = schema.get('presets') or [{}]
    blocks = presets[0].get('blocks') or []
    if not blocks and schema.get('blocks'):
        blocks = [{'type': b['type'], 'settings': {}} for b in schema['blocks']]

    built = []
    for i, block in enumerate(blocks):
        block_schema = next(
            (b for b in schema.get('blocks', []) if b['type'] == block.get('type')), {}
        )
        settings = defaults_from_schema(block_schema)
        settings.update(block.get('settings') or {})
        built.append({
            'id': f'b{i}', 'type': block.get('type'),
            'settings': settings, 'shopify_attributes': f'data-block="{i}"',
        })
    return built


# --------------------------------------------------------------------------


def main():
    env = Environment(loader=None)
    env.filters.update(FILTERS)
    env.add_tag(SchemaTag)

    # {% form %} / {% render %} against real files
    from liquid import CachingFileSystemLoader
    env = Environment(loader=CachingFileSystemLoader(['snippets'], ext='.liquid'))
    env.filters.update(FILTERS)

    failures = []
    paths = sorted(glob.glob('sections/rp-*.liquid') + ['sections/angels-proof-slider.liquid'])

    for path in paths:
        source = open(path, encoding='utf-8').read()
        match = SCHEMA_RE.search(source)
        schema = json.loads(match.group(1)) if match else {}
        source = SCHEMA_RE.sub('', source)

        # {% form 'product', p, id: x %} … {% endform %} is a platform tag.
        source = re.sub(r'\{%-?\s*form\s+.*?-?%\}', '<form action="/cart/add" method="post">', source, flags=re.S)
        source = re.sub(r'\{%-?\s*endform\s*-?%\}', '</form>', source)

        settings = defaults_from_schema(schema)
        if path.endswith('rp-ladder.liquid'):
            settings['product'] = PRODUCTS[2]
        if path.endswith('rp-hero.liquid') or path.endswith('rp-header.liquid'):
            settings['image'] = Img()
            settings['logo'] = Img()

        context = dict(BASE)
        context['section'] = {
            'id': 'test-section', 'settings': settings,
            'blocks': blocks_from_preset(schema),
        }

        try:
            html = env.from_string(source).render(**context)
        except LiquidError as exc:
            failures.append(f'{path}: render failed — {exc}')
            continue
        except Exception as exc:  # noqa: BLE001 — surface anything at all
            failures.append(f'{path}: render failed — {type(exc).__name__}: {exc}')
            continue

        # -- assertions on the output ------------------------------------
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
            try:
                data = json.loads(block)
            except Exception as exc:  # noqa: BLE001
                failures.append(f'{path}: JSON-LD is not valid JSON — {exc}')
                continue
            if '@context' not in data or '@type' not in data:
                failures.append(f'{path}: JSON-LD missing @context/@type')

        if 'Add your community link' in html:
            failures.append(f'{path}: join button fell back to its placeholder')

        for orphan in re.findall(r'\{\{.*?\}\}|\{%.*?%\}', html):
            failures.append(f'{path}: unrendered Liquid left in output — {orphan[:60]}')

        if re.search(r'\shref="\s*"', html):
            failures.append(f'{path}: empty href in output')

        # every external link must be safe to open
        for tag in re.findall(r'<a\b[^>]*target="_blank"[^>]*>', html):
            if 'rel=' not in tag:
                failures.append(f'{path}: target=_blank without rel — {tag[:80]}')

        heads = re.findall(r'<(h[1-6])\b', html)
        if path.endswith('rp-hero.liquid') and heads[:1] != ['h1']:
            failures.append(f'{path}: hero should open with the page h1, got {heads[:1]}')
        if not path.endswith('rp-hero.liquid') and 'h1' in heads:
            failures.append(f'{path}: emits an <h1>; only the hero should')

        print(f'  ok  {path}  ({len(html)} bytes)')

    if failures:
        print()
        print('\n'.join(f'ERROR {f}' for f in failures))
        sys.exit(1)

    print('\nOK — every rp-* section renders, JSON-LD parses, no orphan Liquid.')


if __name__ == '__main__':
    main()
