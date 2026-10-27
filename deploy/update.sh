#!/usr/bin/env bash
# Serverda yangilash: sudo -u darsjadval /srv/darsjadval/deploy/update.sh && sudo systemctl restart darsjadval
set -euo pipefail
cd /srv/darsjadval
# git pull shu skriptni ham yangilashi mumkin — yangi versiyasini qaytadan ishga tushiramiz
if [ "${1:-}" != "--pulled" ]; then
    git pull --ff-only
    exec bash /srv/darsjadval/deploy/update.sh --pulled
fi

cd backend
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py check --deploy --fail-level ERROR

cd ../frontend
npm ci
npm run build
echo "Tayyor. Endi: sudo systemctl restart darsjadval"
