# Dars jadvali

Ko'p maktabli (multi-tenant) dars jadvali tizimi. Har bir maktab o'z ma'lumotlarini
o'z admini orqali yuritadi; xonalar eshigidagi planshetlar shu xonaning kunlik
jadvalini va hozir davom etayotgan dars/imtihonni ko'rsatadi.

```
backend/   Django + Django REST Framework (API, Django admin)
frontend/  Angular — maktab admin paneli (/s/<maktab>/...) va veb-planshet ekrani (/tablet/<token>)
android/   Xona eshigidagi planshet uchun kiosk ilova (Kotlin + Compose) — android/README.md
docs/      Dizayn (docs/design) va AI dizayn prompti
deploy/    Serverga o'rnatish: nginx, gunicorn, systemd — deploy/README.md
```

## Ishga tushirish

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # demo maktab + to'liq jadval (ixtiyoriy)
python manage.py runserver          # http://127.0.0.1:8000  (admin: /admin/)

# Frontend
cd frontend
npm install                         # npm 10.9.0 xato bersa: npx npm@11 install
npm start                           # http://localhost:4200
```

Admin panel: `http://localhost:4200` → `admin` / `admin123` (`seed_demo` yaratadi).
`seed_demo` xonalarning planshet manzillarini ham chiqaradi: `http://localhost:4200/tablet/<xona tokeni>`.
Superuser yaratish: `python manage.py createsuperuser`.

Planshetlar serverga LAN orqali ulanadi — `python manage.py runserver 0.0.0.0:8000`;
production'da `DJANGO_ALLOWED_HOSTS=192.168.1.10,...` bering.

## Admin panel (Angular)

Faqat kunduzgi (light) mavzu, maktab asosiy rangi bilan (Sozlamalar → Asosiy rang).

| Bo'lim | Nima qiladi |
|---|---|
| Boshqaruv paneli | statistika, xonalar hozir (30 s da yangilanadi), ogohlantirishlar: oflayn planshetlar, yaqinlashayotgan ta'til |
| Dars jadvali | chorak × guruh/o'qituvchi/xona bo'yicha to'r; katakni bosib qo'shish/tahrirlash; band bo'lsa aniq xabar ("Bu vaqtda 101-xona band (8-B · Fizika)"); boshqa chorakdan nusxalash |
| Imtihonlar | imtihon davri bo'yicha kunlarga bo'lingan ro'yxat; xona/guruh bandligi tekshiriladi |
| To'garaklar | to'garaklar va ularning haftalik mashg'ulotlari |
| Kalendar | o'quv yili chizig'i; choraklar, ta'tillar, imtihon davrlari |
| Qo'ng'iroq jadvali | dars/tanaffus/tushlik vaqtlari, oraliq va ustma-ustlikni ko'rsatadi |
| Fanlar, O'qituvchilar, Xonalar, Guruhlar | oddiy ro'yxatlar; jadvalda ishlatilayotganini o'chirib bo'lmaydi |
| Planshetlar | onlayn/oflayn/ulanmagan, oxirgi aloqa, QR + adb buyrug'i, tokenni yangilash, jonli ko'rinish |
| Sozlamalar | nom, rang, vaqt zonasi, ish kunlari, foydalanuvchilar (admin / xodim) |

`staff` (xodim) roli hamma narsani ko'radi, lekin o'zgartira olmaydi.

## Tuzilma

**Maktab (tenant).** Hamma ma'lumot `School` ga bog'langan. Foydalanuvchi maktabga
`SchoolMembership` orqali a'zo bo'ladi: `admin` (yozadi) yoki `staff` (faqat ko'radi).
Superuser hamma maktabni ko'radi.

**Kalendar.** `AcademicYear` → `Term` (chorak/semestr, darslar faqat shu oraliqda),
`Break` (ta'til: 1 hafta ham, 2 oy ham), `ExamSession` (imtihon davri — darslar
to'xtaydi, xonalarda `Exam` lar ko'rsatiladi).

**Qo'ng'iroq jadvali.** `Period` — dars vaqti, `coffee_break` yoki `lunch`.

**Jadval.** `Lesson` = chorak + hafta kuni + period + xona + fan + guruh + o'qituvchi.
Bir xona / o'qituvchi / guruh bir vaqtda ikki joyda bo'la olmaydi (DB darajasida).

**To'garaklar.** `Club` (nomi, rahbari, rangi) va `ClubSession` (o'quv yili + hafta kuni +
boshlanish/tugash vaqti + xona). Qo'ng'iroq jadvaliga bog'lanmaydi — odatda darslardan keyin.
Xona shu vaqtda dars yoki boshqa to'garak bilan band bo'lsa API 400 qaytaradi.
Planshetda oddiy o'quv kunlarida `club` yozuvi sifatida ko'rinadi; ta'til va imtihon kunlarida yo'q.

**Kun holati** (`api/services.py`, `room_day`): `weekend` → `holiday` → `exam` → `lesson` → `no_term`
tartibida aniqlanadi; har yozuv hozirgi vaqtga nisbatan `past | active | upcoming`.

## API

Autentifikatsiya: `POST /api/auth/token/` `{username, password}` → `{token}`,
keyin `Authorization: Token <token>`. `GET /api/me/` — foydalanuvchi va uning maktablari.

Maktab bo'yicha CRUD (`/api/schools/<slug>/...`), hammasi REST (`GET/POST`, `GET/PUT/PATCH/DELETE <id>/`):

| Manzil | Nima |
|---|---|
| `subjects/` | fanlar |
| `teachers/` | o'qituvchilar |
| `rooms/` | xonalar; `rooms/<id>/day/?date=` — xona jadvali; `POST rooms/<id>/rotate-token/` — planshet tokenini almashtirish |
| `groups/` | sinflar/guruhlar |
| `periods/` | qo'ng'iroq jadvali |
| `academic-years/`, `terms/?academic_year=` | o'quv yili, choraklar |
| `breaks/` | ta'tillar |
| `exam-sessions/` | imtihon davrlari |
| `lessons/?term=&weekday=&room=&group=&teacher=&subject=` | haftalik jadval |
| `exams/?exam_session=&date=&room=&group=` | imtihonlar |
| `clubs/?leader=&is_active=` | to'garaklar |
| `club-sessions/?club=&academic_year=&weekday=&room=` | to'garak mashg'ulotlari (haftalik) |
| `POST lessons/copy/` `{from_term, to_term}` | chorak jadvalini bo'sh chorakka nusxalash |
| `GET dashboard/` | boshqaruv paneli: statistika, xonalar hozir, ogohlantirishlar |
| `GET/PATCH settings/` | maktab nomi, rangi, vaqt zonasi, ish kunlari |
| `members/` | maktab foydalanuvchilari (yangi login bo'lsa yaratiladi) |

Xonalar javobida `tablet_status` (`online` — oxirgi 5 daqiqada so'ragan, `offline`, `unpaired`) va `last_seen_at` bor.

Planshet / Android ilova uchun (loginsiz, xona tokeni bilan):

```
GET /api/tablet/<device_token>/?date=YYYY-MM-DD
```

Javob: maktab, xona, maktab vaqti bo'yicha `now`, va `day` — holat, yozuvlar ro'yxati,
`current` (hozir davom etayotgan) va `next` (keyingi). `date` berilmasa — bugun.

## Testlar

```bash
cd backend && python manage.py test api        # 80 test
cd frontend && npm test                        # 23 test
cd android && ./gradlew testDebugUnitTest      # 14 test
```

Demo uchun soatni "to'xtatish" (faqat DEBUG): `DARSJADVAL_FAKE_NOW=2026-10-22T10:42 python manage.py runserver`.
