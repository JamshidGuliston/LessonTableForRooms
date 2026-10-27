# cPanel hostingga o'rnatish (timetable.gulistanps.uz)

Hostingda root yo'q (`sudo`, `apt`, nginx ishlatilmaydi). Django'ni cPanel'ning
**Setup Python App** (Passenger) ishga tushiradi, Angular esa tayyor build sifatida
shu domen papkasiga ko'chiriladi. Serverda Node.js kerak emas.

```
~/darsjadval/                      git clone (kod, .env, db.sqlite3 — veb-papkadan tashqarida)
~/timetable.gulistanps.uz/         domen papkasi = Python App root
    passenger_wsgi.py              → ~/darsjadval/backend ni yuklaydi
    .htaccess                      /api, /admin → Django; qolgani → index.html
    index.html, main-*.js, ...     Angular (deploy/cpanel/www dan)
    static/                        Django admin CSS/JS (collectstatic)
~/virtualenv/timetable.gulistanps.uz/3.13/   Python App virtualenv'i
```

## 1. Birinchi o'rnatish (SSH / cPanel Terminal)

Python App allaqachon yaratilgan (Python 3.13, root: `timetable.gulistanps.uz`, URL: `/`).

```bash
cd ~
git clone https://github.com/JamshidGuliston/LessonTableForRooms.git darsjadval
cp darsjadval/deploy/cpanel/env.example darsjadval/backend/.env
nano darsjadval/backend/.env       # DJANGO_SECRET_KEY ni almashtiring
bash darsjadval/deploy/cpanel/update.sh
```

SECRET_KEY yaratish:
`~/virtualenv/timetable.gulistanps.uz/3.13/bin/python -c "import secrets; print(secrets.token_urlsafe(50))"`

Admin (superuser) yaratish:

```bash
cd ~/darsjadval/backend && set -a && . ./.env && set +a
~/virtualenv/timetable.gulistanps.uz/3.13/bin/python manage.py createsuperuser
```

Tekshirish: https://timetable.gulistanps.uz/api/health/ → `{"status":"ok"}`, keyin
https://timetable.gulistanps.uz/admin/ → **Schools** da maktab yarating va
**School memberships** da foydalanuvchini `admin` qilib biriktiring
(sinash uchun: `manage.py seed_demo` — demo maktab, `admin` / `admin123`; keyin parolni almashtiring).

## 2. Yangilash

Kompyuterda (frontend o'zgargan bo'lsa):

```bash
bash deploy/cpanel/build-frontend.sh   # Angular build → deploy/cpanel/www
git add -A && git commit -m "..." && git push
```

Serverda:

```bash
bash ~/darsjadval/deploy/cpanel/update.sh
```

`update.sh`: git pull → pip install → migrate → collectstatic → Angular fayllari →
`passenger_wsgi.py` va `.htaccess` → ilovani qayta ishga tushirish (`tmp/restart.txt`).

## Muammo bo'lsa

- 500 / "Web application could not be started": `~/timetable.gulistanps.uz/stderr.log`
  yoki cPanel → Setup Python App → ilova → **Restart**.
- Sahifa ochiladi, lekin API 400 qaytaradi: `.env` dagi `DJANGO_ALLOWED_HOSTS` ni tekshiring.
- `/admin/` ga kirishda CSRF xatosi: `DJANGO_CSRF_TRUSTED_ORIGINS=https://timetable.gulistanps.uz`.
- Zaxira: `cp ~/darsjadval/backend/db.sqlite3 ~/db-$(date +%F).sqlite3`

Planshetlar: Android ilovada server manzili `https://timetable.gulistanps.uz`.
