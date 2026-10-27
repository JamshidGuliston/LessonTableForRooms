#!/usr/bin/env bash
# cPanel hostingda o'rnatish/yangilash:  bash ~/darsjadval/deploy/cpanel/update.sh
set -euo pipefail

REPO="${REPO:-$HOME/darsjadval}"
APP="${APP:-$HOME/timetable.gulistanps.uz}"
VENV="${VENV:-$HOME/virtualenv/timetable.gulistanps.uz/3.13}"
PY="$VENV/bin/python"

cd "$REPO"
git pull --ff-only

echo "== Backend"
cd "$REPO/backend"
[ -f .env ] || { echo "backend/.env yo'q — deploy/env.example dan nusxa oling"; exit 1; }
"$PY" -m pip install -q -r requirements.txt
set -a; . ./.env; set +a
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
