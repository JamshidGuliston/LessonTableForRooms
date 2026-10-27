# DarsJadval — xona plansheti (Android)

Xona eshigidagi planshet uchun kiosk ilova: xonaning bugungi jadvali, hozir davom etayotgan
dars/tanaffus/imtihon/to'garak, qolgan daqiqalar va keyingi mashg'ulot. Ekran sensorsiz —
hech qanday bosish talab qilinmaydi.

Mo'ljallangan qurilma: **RK3288, Android 7.1.2 (API 25), 1440×2560, 2 GB RAM, Wi-Fi**.
`minSdk 21`, shuning uchun eskiroq planshetlarda ham ishlaydi. Portret va landshaft — ikkalasiga moslashadi.

## Nima qiladi

- **Yoqilganda o'zi ochiladi** — `BOOT_COMPLETED` (va ba'zi xitoy proshivkalaridagi `QUICKBOOT_POWERON`).
- **Launcher (HOME) bo'la oladi** — ixtiyoriy, adb bilan yoqiladi.
- **Ekran doim yoqiq**, to'liq ekran, qulf ekrani ustida ko'rinadi.
- **Yiqilsa qayta ochiladi** — kutilmagan xatodan 3 soniya keyin.
- **Har 30 soniyada** serverdan jadval oladi; aloqa uzilsa eski jadval ko'rinib turadi, faol dars
  daqiqasida o'zi almashadi, yuqorida "Aloqa yo'q · oxirgi yangilanish 10:31" chiqadi.
- **Soat serverdan olinadi** — planshetning RTC soati noto'g'ri bo'lsa ham vaqt to'g'ri.
- Yarim tunda yangi kun jadvalini o'zi so'raydi.
- Ro'yxat uzun bo'lsa o'zi joriy darsga suriladi.

## Yig'ish

```bash
cd android
./gradlew assembleRelease          # app/build/outputs/apk/release/app-release.apk
./gradlew testDebugUnitTest        # unit testlar
```

Talab: JDK 17+, Android SDK (platform 35). Maktab uchun server manzilini APK ichiga yozib qo'yish mumkin:

```bash
./gradlew assembleRelease -PdefaultServer=http://192.168.1.10:8000
```

## Planshetga o'rnatish (bir marta, USB/adb orqali)

1. Planshetda *Settings → About tablet → Build number* ni 7 marta bosib, *Developer options → USB debugging* ni yoqing.
2. Kompyuterdan:

```bash
adb install -r app-release.apk

# Server va xona tokeni (token — admin paneldagi "Planshetlar" sahifasida yoki Django admin'da).
# Bu buyruq ilovani birinchi marta ochadi ham — ochilmagan ilova yoqilishda ishga tushmaydi.
adb shell am start -n uz.darsjadval.tablet/.MainActivity \
    --es server http://192.168.1.10:8000 \
    --es token XONA_TOKENI

# "Viewing full screen — Got it" oynasi chiqmasin (sensorsiz ekranda uni yopib bo'lmaydi).
# Bu ruxsatsiz ham ishlaydi, faqat pastki navigatsiya paneli ko'rinib turadi.
adb shell pm grant uz.darsjadval.tablet android.permission.WRITE_SECURE_SETTINGS

# Ekran o'chmasin
adb shell settings put system screen_off_timeout 2147483647
```

3. Tekshirish: `adb reboot` — planshet yoqilgach jadval o'zi chiqishi kerak.
   (`am start` dan keyin rebootdan oldin ~15 soniya kuting — Android paket holatini kechikib yozadi.)

**Android 10 va undan yangi planshetlar uchun** (7.1 da kerak emas) — fondan ochishga ruxsat:

```bash
adb shell appops set uz.darsjadval.tablet SYSTEM_ALERT_WINDOW allow
adb shell appops write-settings     # busiz ruxsat rebootda yo'qoladi
```

**Ixtiyoriy — ilovani launcher qilish** (Home bosilganda ham jadval chiqadi):

```bash
adb shell pm enable uz.darsjadval.tablet/.HomeAlias
adb shell cmd package set-home-activity uz.darsjadval.tablet/.HomeAlias
```

Diqqat: launcher yoqilib, lekin standart qilib belgilanmasa, Android yoqilishda "launcher tanlang"
oynasini chiqaradi va ekran shu yerda qoladi. Shuning uchun u standart holatda o'chiq.

Token almashtirilsa (admin "Tokenni yangilash" bossa) planshetda "Xona topilmadi" chiqadi —
2-qadamdagi `am start` buyrug'ini yangi token bilan qayta bering.

## Sinovdan o'tgan holatlar

Emulyatorda (1440×2560, 320 dpi — planshetning o'zi kabi) real backend bilan:
dars davom etmoqda (portret), imtihon kuni (landshaft), aloqa uzilishi, `adb reboot` dan keyin
avtomatik ochilish. Haqiqiy RK3288 planshetda hali sinalmagan.

Demo uchun serverni ma'lum vaqtda "to'xtatib" qo'yish mumkin (faqat DEBUG):
`DARSJADVAL_FAKE_NOW=2026-10-22T10:42 python manage.py runserver 0.0.0.0:8000`

## Server tomoni

Planshet `GET {server}/api/tablet/{token}/` ni so'raydi. Django serveri LAN'da ochiq bo'lishi kerak:

```bash
python manage.py runserver 0.0.0.0:8000
# production: DJANGO_ALLOWED_HOSTS=192.168.1.10 ...
```

## Tuzilma

```
app/src/main/java/uz/darsjadval/tablet/
  data/TabletJson.kt      server javobini parse qilish
  data/Schedule.kt        hozirgi vaqtga nisbatan past/active/upcoming, qolgan daqiqa, progress
  data/TabletApi.kt       HTTP (kutubxonasiz)
  data/TabletConfig.kt    server + token (SharedPreferences / BuildConfig)
  TabletViewModel.kt      30 s polling, server soati, yarim tun
  ui/TabletScreen.kt      Compose ekran (docs/design A1, faqat light mavzu)
  MainActivity.kt         kiosk oyna, adb orqali sozlash
  BootReceiver.kt         yoqilganda ochish
  TabletApp.kt            yiqilsa qayta ochish
```

Shrift: Inter (SIL Open Font License, `app/src/main/INTER_LICENSE.txt`).
