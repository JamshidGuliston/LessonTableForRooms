# cPanel hostingga o'rnatish (timetable.gulistanps.uz)

Hostingda root yo'q (`sudo`, `apt`, nginx ishlatilmaydi). Django'ni cPanel'ning
**Setup Python App** (Passenger) ishga tushiradi, Angular esa tayyor build sifatida
shu domen papkasiga ko'chiriladi. Serverda Node.js kerak emas.

Hammasi domen papkasi `~/timetable.gulistanps.uz` ichida (u Python App root ham).
Kod shu papka ichidagi `app/` da; u internetdan yopiq — `app/.htaccess` (`Require all denied`)
va domen `.htaccess` idagi `RedirectMatch 404 ^/app`.

```
~/timetable.gulistanps.uz/         domen papkasi = Python App root
    app/                           git clone (kod, backend/.env) — internetdan yopiq
    passenger_wsgi.py              → app/backend ni yuklaydi
    .htaccess                      /api, /admin → Django; qolgani → index.html
    index.html, main-*.js, ...     Angular (deploy/cpanel/www dan)
    static/                        Django admin CSS/JS (collectstatic)
~/virtualenv/timetable.gulistanps.uz/3.13/   Python App virtualenv'i
```

## 1. Birinchi o'rnatish (SSH / cPanel Terminal)

Python App allaqachon yaratilgan (Python 3.13, root: `timetable.gulistanps.uz`, URL: `/`).

**Baza (PostgreSQL):** cPanel → **PostgreSQL Databases** → yangi baza (masalan
`gulistanps_timetable`) va foydalanuvchi yarating, foydalanuvchini bazaga qo'shing
(**Add User to Database**). Jadvallarni qo'lda yaratish shart emas — `migrate` o'zi yaratadi.
Talab: **PostgreSQL 15+** (Django 6.1). Versiya: `psql --version` yoki phpPgAdmin.
MySQL ishlatilmaydi — Django 6.1 MySQL 8.4+ talab qiladi, hostingda 8.0.

```bash
cd ~/timetable.gulistanps.uz
git clone https://github.com/JamshidGuliston/LessonTableForRooms.git app
cp app/deploy/cpanel/env.example app/backend/.env
nano app/backend/.env              # DJANGO_SECRET_KEY va DB_NAME / DB_USER / DB_PASSWORD
bash app/deploy/cpanel/update.sh
```

SECRET_KEY yaratish:
`~/virtualenv/timetable.gulistanps.uz/3.13/bin/python -c "import secrets; print(secrets.token_urlsafe(50))"`

Admin (superuser) yaratish:

```bash
cd ~/timetable.gulistanps.uz/app/backend
~/virtualenv/timetable.gulistanps.uz/3.13/bin/python manage.py createsuperuser
```

Tekshirish: https://timetable.gulistanps.uz/api/health/ → `{"status":"ok"}`;
https://timetable.gulistanps.uz/app/backend/.env → **404/403** bo'lishi shart; keyin
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
bash ~/timetable.gulistanps.uz/app/deploy/cpanel/update.sh
```

`update.sh`: git pull → pip install → migrate → collectstatic → Angular fayllari →
`passenger_wsgi.py` va `.htaccess` → ilovani qayta ishga tushirish (`tmp/restart.txt`).

## Muammo bo'lsa

- 500 / "Web application could not be started": `~/timetable.gulistanps.uz/stderr.log`
  yoki cPanel → Setup Python App → ilova → **Restart**.
- `.env` da qiymatlar qo'shtirnoqsiz yoziladi; parolda `)`, `$`, `#` bo'lishi mumkin.
- Sahifa ochiladi, lekin API 400 qaytaradi: `.env` dagi `DJANGO_ALLOWED_HOSTS` ni tekshiring.
- `/admin/` ga kirishda CSRF xatosi: `DJANGO_CSRF_TRUSTED_ORIGINS=https://timetable.gulistanps.uz`.
- `password authentication failed` / `permission denied`: foydalanuvchi bazaga qo'shilmagan yoki `DB_*` noto'g'ri.
- `PostgreSQL 15 or later is required`: hosting PostgreSQL'i eski — `.env` dan `DJANGO_DB_ENGINE` va `DB_*` ni o'chiring (SQLite).
- Zaxira: cPanel → **Backup** (PostgreSQL bazasi) yoki `pg_dump`.

Planshetlar: Android ilovada server manzili `https://timetable.gulistanps.uz`.
