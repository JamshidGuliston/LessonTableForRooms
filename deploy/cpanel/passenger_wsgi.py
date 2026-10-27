"""cPanel "Setup Python App" (Passenger) kirish nuqtasi.

update.sh bu faylni ilova papkasiga (~/timetable.gulistanps.uz) nusxalaydi.
Kod esa ~/darsjadval da (veb-papkadan tashqarida), sozlamalar ~/darsjadval/backend/.env da.
"""
import os
import sys
from pathlib import Path

BACKEND = Path(os.environ.get('DARSJADVAL_BACKEND', Path(__file__).resolve().parent.parent / 'darsjadval' / 'backend'))
sys.path.insert(0, str(BACKEND))

env_file = BACKEND / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
