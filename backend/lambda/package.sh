#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

# Clean build dir
rm -rf "$HERE/build"
mkdir -p "$HERE/build"

# Install deps into build/
pip3 install -r "$HERE/requirements.txt" -t "$HERE/build"

# Copy lambda source
cp "$HERE/handler.py" "$HERE/build/"

echo "Build done at $HERE/build"
