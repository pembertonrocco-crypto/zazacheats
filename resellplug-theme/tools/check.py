#!/usr/bin/env python3
"""Static checks for this theme. No build step, no Liquid engine — these are
the mistakes that are silent on Shopify until a page renders blank.

    python3 tools/check.py

Exit code is non-zero if anything fails. This directory is excluded from the
packaged zip; see tools/package.sh.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

errors = []

# Liquid tags that open a block, and the tag that closes them.
PAIRS = {
    'if': 'endif', 'unless': 'endunless', 'for': 'endfor', 'case': 'endcase',
    'form': 'endform', 'comment': 'endcomment', 'schema': 'endschema',
    'style': 'endstyle', 'capture': 'endcapture', 'paginate': 'endpaginate',
    'tablerow': 'endtablerow', 'raw': 'endraw', 'javascript': 'endjavascript',
    'stylesheet': 'endstylesheet',
}

SCHEMA_RE = re.compile(r'\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}', re.S)
COMMENT_RE = re.compile(r'\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}', re.S)

# Section types Shopify provides rather than the theme.
PLATFORM_SECTIONS = {'_blocks', 'apps'}


def check_json_parses():
    for path in glob.glob('**/*.json', recursive=True):
        if path.startswith('tools' + os.sep):
            continue
        try:
            json.load(open(path, encoding='utf-8'))
        except Exception as exc:
            errors.append(f'{path}: invalid JSON — {exc}')


def read_schema(path):
    match = SCHEMA_RE.search(open(path, encoding='utf-8').read())
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except Exception as exc:
        errors.append(f'{path}: {{% schema %}} is not valid JSON — {exc}')
        return None


def check_schemas():
    for path in glob.glob('sections/*.liquid') + glob.glob('blocks/*.liquid'):
        read_schema(path)


def check_tag_balance():
    """Only over files this repo authored — Dawn's own are known good, and a
    few of them use tags this simple scanner does not model."""
    paths = glob.glob('sections/rp-*.liquid') + glob.glob('snippets/rp-*.liquid')
    paths.append('sections/angels-proof-slider.liquid')
    for path in paths:
        src = open(path, encoding='utf-8').read()
        src = SCHEMA_RE.sub('', src)
        src = COMMENT_RE.sub('', src)
        stack = []
        for tag in re.findall(r'\{%-?\s*(\w+)', src):
            if tag in PAIRS:
                stack.append(PAIRS[tag])
            elif tag.startswith('end'):
                if not stack:
                    errors.append(f'{path}: stray {{% {tag} %}}')
                elif stack[-1] != tag:
                    errors.append(f'{path}: expected {{% {stack.pop()} %}}, found {{% {tag} %}}')
                else:
                    stack.pop()
        if stack:
            errors.append(f'{path}: unclosed {stack}')


def check_wiring():
    """Every section a JSON template names must exist, and every setting it
    sets must be declared in that section's schema. Shopify silently drops
    both, which is how a template ends up rendering an empty page."""
    available = {
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob('sections/*.liquid')
    } | PLATFORM_SECTIONS

    targets = (
        glob.glob('templates/*.json')
        + glob.glob('templates/customers/*.json')
        + glob.glob('sections/*-group.json')
    )

    for path in targets:
        doc = json.load(open(path, encoding='utf-8'))
        sections = doc.get('sections') or {}

        for key in doc.get('order') or []:
            if key not in sections:
                errors.append(f'{path}: order lists "{key}" but no such section')

        for key, section in sections.items():
            stype = section.get('type')
            if stype and stype not in available:
                errors.append(f'{path}: "{key}" needs sections/{stype}.liquid, which is missing')
                continue

            section_path = f'sections/{stype}.liquid'
            if not os.path.exists(section_path):
                continue
            schema = read_schema(section_path)
            if not schema:
                continue

            declared = {s['id'] for s in schema.get('settings', []) if 'id' in s}
            for setting_id in section.get('settings') or {}:
                if setting_id not in declared:
                    errors.append(
                        f'{path}: "{key}" sets "{setting_id}", which {stype} does not declare'
                    )

            block_types = {b['type'] for b in schema.get('blocks', [])}
            for block_key, block in (section.get('blocks') or {}).items():
                if block_types and block.get('type') not in block_types:
                    errors.append(
                        f'{path}: "{key}" block "{block_key}" is type '
                        f'"{block.get("type")}", which {stype} does not define'
                    )


def check_funnel_links():
    """Every join button reads settings.rp_group_url. If it is blank the CTA
    renders as a disabled placeholder, which is worth failing loudly on."""
    data = json.load(open('config/settings_data.json', encoding='utf-8'))
    current = data.get('current', {})
    if not current.get('rp_group_url'):
        errors.append('config/settings_data.json: rp_group_url is empty — every join button is dead')


check_json_parses()
check_schemas()
check_tag_balance()
check_wiring()
check_funnel_links()

if errors:
    print('\n'.join(f'ERROR {e}' for e in errors))
    sys.exit(1)

print('OK — JSON, schemas, tag balance, template wiring and funnel links all check out.')
