# Serverga o'rnatish (Ubuntu/Debian + Nginx + Gunicorn)

Tuzilma: Nginx 80-portda Angular fayllarini beradi, `/api/` va `/admin/` ni
Gunicorn'ga (127.0.0.1:8001) uzatadi. Frontend va API bitta domenda, CORS kerak emas.

Kerak: Python 3.12+ (3.13 bo'ladi), Node.js 20.19+ yoki 22 (Angular build uchun), git, nginx.

## 1. Birinchi o'rnatish

```bash
sudo apt update && sudo apt install -y git nginx python3.13-venv
# Node 22 yo'q bo'lsa: https://nodejs.org yoki `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs`

sudo useradd --system --create-home --home-dir /srv/darsjadval --shell /bin/bash -g www-data darsjadval
sudo -u darsjadval git clone https://github.com/JamshidGuliston/LessonTableForRooms.git /srv/darsjadval
cd /srv/darsjadval

# Backend
sudo -u darsjadval python3.13 -m venv backend/.venv
sudo -u darsjadval cp deploy/env.example backend/.env
sudo -u darsjadval nano backend/.env          # SECRET_KEY, domen/IP ni yozing
sudo -u darsjadval deploy/update.sh            # pip, migrate, collectstatic, Angular build
sudo -u darsjadval bash -c 'cd backend && set -a && . ./.env && .venv/bin/python manage.py createsuperuser'

# Gunicorn xizmati
sudo cp deploy/gunicorn.service /etc/systemd/system/darsjadval.service
sudo systemctl daemon-reload
sudo systemctl enable --now darsjadval

# Nginx (server_name ni o'zingizning domen/IP ga almashtiring)
sudo cp deploy/nginx.conf /etc/nginx/sites-available/darsjadval
sudo nano /etc/nginx/sites-available/darsjadval
sudo ln -s /etc/nginx/sites-available/darsjadval /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Tekshirish: `curl http://<domen>/api/health/` → `{"status":"ok"}`.
Keyin `http://<domen>/admin/` → superuser bilan kirib, **Maktab** yarating va unga
admin foydalanuvchini a'zo qiling (yoki demo uchun: `manage.py seed_demo`).

## 2. HTTPS (domen bo'lsa)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jadval.example.uz
```

`.env` da `DJANGO_CSRF_TRUSTED_ORIGINS=https://...` bo'lsin. Faqat `http://IP` bilan
ishlasangiz `DJANGO_SECURE_COOKIES=0` qiling, aks holda `/admin/` ga kirib bo'lmaydi.

Planshetlar (Android 7.1.2) Let's Encrypt sertifikatini taniydi; ichki tarmoqda
`http://IP` ham ishlaydi.

## 3. Yangilash

```bash
sudo -u darsjadval /srv/darsjadval/deploy/update.sh && sudo systemctl restart darsjadval
```

## Foydali

- Loglar: `journalctl -u darsjadval -f`, `/var/log/nginx/error.log`
- Ma'lumotlar bazasi: `backend/db.sqlite3` — zaxira: `cp db.sqlite3 db-$(date +%F).sqlite3`
- Planshet ilovasi serverga `adb ... --es server http://<domen yoki IP>` bilan ulanadi (android/README.md)
