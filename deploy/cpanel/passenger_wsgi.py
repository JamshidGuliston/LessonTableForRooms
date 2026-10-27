"""cPanel "Setup Python App" (Passenger) kirish nuqtasi.

update.sh bu faylni ilova papkasiga (~/timetable.gulistanps.uz) nusxalaydi.
Kod shu papka ichidagi app/ da (git clone); app/backend/.env ni settings.py o'zi o'qiydi.
"""
import os
import sys
from pathlib import Path

BACKEND = Path(os.environ.get('DARSJADVAL_BACKEND', Path(__file__).resolve().parent / 'app' / 'backend'))
sys.path.insert(0, str(BACKEND))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

application = get_wsgi_application()
