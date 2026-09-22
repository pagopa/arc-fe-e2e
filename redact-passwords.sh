#\!/usr/bin/env bash
# Redacts real password from Playwright report base64 zips embedded in index.html files.
# Usage: ./redact-passwords.sh [directory]   (defaults to current directory)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/redact-passwords.py" "${1:-.}"
