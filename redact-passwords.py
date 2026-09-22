#!/usr/bin/env python3
"""
Redacts passwords from Playwright report base64 zips embedded in index.html files.
Matches the pattern:  Fill "<value>" getByLabel('Password')
and replaces <value> with *** — no hardcoded password needed.
Usage: python3 redact-passwords.py [directory]   (defaults to current directory)
"""

import sys
import os
import re
import base64
import zipfile
import io

PATTERN = re.compile(
    r'(<template id="playwrightReportBase64">data:application/zip;base64,)([^<]+)(</template>)',
    re.DOTALL
)
# Matches: Fill "<anything>" getByLabel('Password')
# The password value is captured in group 1 so we never need to know it.
PASSWORD_RE = re.compile(r"""(Fill \\")(.*?)(\\" getByLabel\('Password'\))""")
REDACT_TO   = '***'


def process_html(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    m = PATTERN.search(html)
    if not m:
        print(f"[SKIP]  {html_path}  -- no embedded zip found")
        return False

    prefix, b64_data, suffix = m.group(1), m.group(2).strip(), m.group(3)

    # 1. Decode base64 -> zip bytes
    zip_bytes = base64.b64decode(b64_data)

    # 2. Re-pack zip with passwords redacted
    file_changed = False
    buf = io.BytesIO()

    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zin, \
         zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            data = zin.read(item.filename)

            try:
                text = data.decode('utf-8')
            except UnicodeDecodeError:
                # Binary file -- copy as-is
                zout.writestr(item, data)
                continue

            redacted, n = PASSWORD_RE.subn(
                lambda m: m.group(1) + REDACT_TO + m.group(3),
                text
            )
            if n > 0:
                zout.writestr(item, redacted.encode('utf-8'))
                file_changed = True
                print(f"  [REDACTED] {item.filename}")
            else:
                zout.writestr(item, data)

    if not file_changed:
        print(f"[SKIP]  {html_path}  -- password pattern not found in zip contents")
        return False

    # 3. Re-encode to base64
    new_b64 = base64.b64encode(buf.getvalue()).decode('ascii')

    # 4. Substitute back into the HTML
    new_html = PATTERN.sub(
        lambda _: f'{prefix}{new_b64}{suffix}',
        html
    )

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)

    print(f"[DONE]  {html_path}")
    return True


def main():
    search_dir = sys.argv[1] if len(sys.argv) > 1 else '.'

    html_files = []
    for root, _dirs, files in os.walk(search_dir):
        for fname in files:
            if fname == 'index.html':
                html_files.append(os.path.join(root, fname))

    if not html_files:
        print(f"No index.html files found in '{search_dir}'.")
        sys.exit(0)

    modified = sum(1 for p in html_files if process_html(p))
    print(f"\nFinished. {modified} file(s) updated.")


if __name__ == '__main__':
    main()
