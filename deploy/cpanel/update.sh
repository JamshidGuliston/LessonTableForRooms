#!/usr/bin/env bash
# cPanel hostingda o'rnatish/yangilash:  bash ~/timetable.gulistanps.uz/app/deploy/cpanel/update.sh
set -euo pipefail

APP="${APP:-$HOME/timetable.gulistanps.uz}"
REPO="${REPO:-$APP/app}"
VENV="${VENV:-$HOME/virtualenv/timetable.gulistanps.uz/3.13}"
PY="$VENV/bin/python"

# git pull shu skriptni ham yangilashi mumkin — yangi versiyasini qaytadan ishga tushiramiz
if [ "${1:-}" != "--pulled" ]; then
    git -C "$REPO" pull --ff-only
    exec bash "$REPO/deploy/cpanel/update.sh" --pulled
fi

echo "== Backend"
cd "$REPO/backend"
[ -f .env ] || { echo "backend/.env yo'q — deploy/cpanel/env.example dan nusxa oling"; exit 1; }
[ -f "$REPO/.htaccess" ] || { echo "$REPO/.htaccess yo'q — kod internetga ochiq qolardi"; exit 1; }
"$PY" -m pip install -q -r requirements.txt
"$PY" manage.py migrate --noinput
"$PY" manage.py collectstatic --noinput
"$PY" manage.py check --deploy --fail-level ERROR

echo "== Frontend (tayyor build: deploy/cpanel/www)"
find "$APP" -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' \) -delete
cp -r "$REPO/deploy/cpanel/www/." "$APP/"

echo "== Passenger"
cp "$REPO/deploy/cpanel/passenger_wsgi.py" "$APP/passenger_wsgi.py"
"$PY" - "$APP/.htaccess" "$REPO/deploy/cpanel/htaccess.conf" <<'PYEOF'
import re, sys
path, block_path = sys.argv[1], sys.argv[2]
block = open(block_path, encoding='utf-8').read().strip() + '\n'
try:
    text = open(path, encoding='utf-8').read()
except FileNotFoundError:
    text = ''
text = re.sub(r'# BEGIN darsjadval.*?# END darsjadval\n?', '', text, flags=re.S)
open(path, 'w', encoding='utf-8').write(block + '\n' + text.lstrip('\n'))
PYEOF
mkdir -p "$APP/tmp"
touch "$APP/tmp/restart.txt"
echo "Tayyor: https://$(basename "$APP")/api/health/"
