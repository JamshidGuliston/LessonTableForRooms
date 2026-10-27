#!/usr/bin/env bash
# Kompyuterda (Node bor joyda) ishga tushiriladi: Angular build → deploy/cpanel/www, keyin commit + push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/frontend"
npm run build
rm -rf "$ROOT/deploy/cpanel/www"
cp -r dist/frontend/browser "$ROOT/deploy/cpanel/www"
echo "deploy/cpanel/www yangilandi — commit qilib push qiling"
