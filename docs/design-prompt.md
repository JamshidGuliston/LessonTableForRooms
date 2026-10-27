# UI design prompt — DarsJadval

Paste the block below into an AI design tool (Google Stitch, Figma Make, v0, Lovable, Uizard…).
If the tool limits prompt length, send section 1 (context + design system) first, then one
surface (section 2, 3 or 4) per follow-up message.

---

## 1. Project context and design system

You are designing the complete UI for **DarsJadval**, a multi-school class-timetable platform used in Uzbekistan. One backend serves many schools; every school has its own admin, its own branding, and its own apps. Design three surfaces that share one design system:

1. **Room Door Tablet** (highest priority) — a 10" Android tablet in landscape, mounted at the door of every classroom, running in kiosk mode 24/7. Viewed from 1–3 metres away by students and teachers passing by. No touch interaction is required (read-only), but it may be tapped to see the full day.
2. **School Admin Web Panel** — desktop web app (Angular) used by one or two staff members per school to enter and maintain all data.
3. **School Mobile App** — Android phone app for teachers, students and parents; each school ships its own branded build (logo + primary color).

**Language:** all UI text is Uzbek (Latin script). Use the sample strings given below verbatim. Do not translate to English or Russian.

**Visual direction:** calm, precise, highly legible, "institutional but modern" — think a good transit departures board, not a children's app. Generous whitespace, strong typographic hierarchy, restrained color. No illustrations, no mascots, no gradients heavier than a subtle surface tint. Rounded corners 12–16 px, soft 1 px borders, minimal shadows.

**Theming:** every school gets its own `primary` color and logo. Build the system on tokens so the primary color can be swapped without redesigning. Show the mockups with a default primary of deep blue `#2563EB`, and show one alternate variant with green `#059669` to prove theming works.

**Typography:** Inter (or Manrope) for everything. Times are always shown with tabular (monospaced) numerals. The tablet uses very large sizes: room number 72–96 px, current subject 56–64 px, clock 64 px, list rows 20–22 px. Admin panel 14–16 px body. Mobile 15–17 px body.

**Color coding (must be consistent across all three surfaces):**
- Lesson → school primary color
- Coffee break (tanaffus) → green `#34D399`
- Lunch (tushlik) → teal `#2DD4BF`
- Club (to'garak — after-school activity such as chess or robotics, led by a teacher, open to any group) → violet `#A78BFA`
- Exam (imtihon) → amber `#F59E0B`, with a stronger, more urgent treatment than lessons
- Holiday / weekend / no-school → neutral grey
- Entry status: **past** = 40 % opacity, **active** = filled card with 2 px primary outline and a thin progress bar, **upcoming** = normal
- Each subject can also have its own small color dot (teacher-chosen hex) — show it as an 8–12 px dot, not as a background.

**Both light and dark themes are required.** The tablet defaults to dark (it is on all day, dark saves power and glare). Admin panel defaults to light. Mobile follows the system.

**Domain glossary (use these concepts exactly):**
- *Maktab* — school (tenant)
- *Fan* — subject; *O'qituvchi* — teacher; *Xona* — room; *Guruh / Sinf* — class/group (e.g. "7-A")
- *Dars vaqti* — bell-schedule period (1-dars 08:30–09:15 …), *Tanaffus* — coffee break, *Tushlik* — lunch
- *O'quv yili* — academic year; *Chorak* — term; *Ta'til* — break (can be 7 days or 2 months)
- *Imtihon davri* — exam session (semester or annual); during it all lessons are suspended and rooms show *Imtihon* entries instead
- *To'garak* — club; has a leader (teacher), its own color, and weekly sessions (weekday + start/end time + room) that run for the whole academic year, usually after the last lesson
- *Dars jadvali* — weekly timetable: term + weekday + period + room + subject + group + teacher
- *Planshet tokeni* — per-room device token used by the door tablet

---

## 2. Surface A — Room Door Tablet (landscape 1280×800, also 1920×1200)

Design these states as separate frames:

**A1. Lesson in progress (the default, most important frame).**
Layout: top bar with huge room number on the left ("101"), school name + date in the middle ("Demo maktab" / "Payshanba, 22-oktabr"), big live clock on the right ("10:42"). Below it a **hero card** for the current entry: small uppercase label "DARS · 10:20–11:05", subject in 56–64 px ("Tarix"), then group and teacher on one line ("9-A" bold, "Nazarova Gulnora" muted), a thin progress bar showing elapsed time, and a footer line "23 daqiqa qoldi" on the left and "Keyingi: Tushlik · 11:05" on the right. Under the hero, the full day as a vertical list of rows: time column (start bold, end small below), subject color dot, title + "group · teacher" subline, and a right-aligned kind label ("DARS", "TANAFFUS", "TUSHLIK"). Past rows faded, the active row outlined, breaks drawn as dashed-border rows. The list should fit ~8 rows without scrolling at 1280×800.

**A2. Break in progress** — same layout, hero card uses the green break accent, title "Tanaffus", footer "Keyingi: Ingliz tili · 09:25".

**A2b. Club in progress** — after the last lesson (e.g. 14:30–16:00) the hero card uses the violet club accent: label "TO'GARAK · 14:30–16:00", title "Shaxmat", leader name "Rahimov Sardor", no group line, progress bar, footer "Keyingi: Bugun boshqa mashg'ulot yo'q". In the day list, club rows sit after the lessons with the kind label "TO'GARAK".

**A3. Room is free** (between entries, before first or after last) — hero card with neutral border, label "HOZIR", title "Xona bo'sh" in muted color, footer "Keyingi: Biologiya · 11:45" or "Bugun boshqa mashg'ulot yo'q".

**A4. Exam day** — a full-width amber banner under the top bar: "Imtihon davri: Yarim yillik imtihonlar". Hero card uses the amber exam treatment: label "IMTIHON · 09:00–11:00", title "Matematika", group "7-A", invigilator name, progress bar. The list contains only exams for this room. Make it unmistakable from 3 metres that this is an exam.

**A5. Holiday / weekend / no-term** — the top bar stays, then a large quiet centered state: "Ta'til: Kuzgi ta'til" (or "Dam olish kuni", "O'quv davri emas"), with a one-line hint of when school resumes ("Darslar 10-noyabrdan davom etadi"). No list.

**A6. Offline / stale** — the last known schedule is still shown, the clock turns muted and a small pill appears in the top bar: "Aloqa yo'q · oxirgi yangilanish 10:31".

**A7. Invalid token** — a setup screen: "Xona topilmadi", short explanation "Planshet tokeni noto'g'ri yoki bekor qilingan. Maktab adminiga murojaat qiling.", and a QR/token input area for re-pairing.

Also show A1 in **light theme** and in the **green-primary school variant**.

---

## 3. Surface B — School Admin Web Panel (desktop 1440×900, light theme default)

Shell: left sidebar with the school logo + name on top, navigation (Boshqaruv paneli, Dars jadvali, Imtihonlar, To'garaklar, Kalendar, Qo'ng'iroq jadvali, Fanlar, O'qituvchilar, Xonalar, Guruhlar, Planshetlar, Sozlamalar), user menu at the bottom ("admin · Chiqish"). Top bar with page title, a school switcher (for users who administer several schools), and the primary action button. Tables use 14 px text, zebra-free, with hover rows and inline actions.

Frames to design:

**B1. Login** — centered card: school logo, "DarsJadval", fields "Foydalanuvchi nomi", "Parol", button "Kirish". Error state "Login yoki parol noto'g'ri".

**B2. Dashboard (Boshqaruv paneli)** — today at a glance: current term and date, small stat tiles (Xonalar 24 · O'qituvchilar 38 · Guruhlar 18 · Bugungi darslar 112), an alert list ("3 ta xona plansheti 2 soatdan beri aloqada emas", "Kuzgi ta'til 7 kundan keyin boshlanadi"), and a live grid of rooms showing what is in each room right now (mini versions of the tablet hero: room number, subject, group, status color).

**B3. Weekly timetable editor (Dars jadvali)** — the core screen. Filters at the top: term selector, then a segmented view switch "Guruh bo'yicha / O'qituvchi bo'yicha / Xona bo'yicha" and the entity picker ("7-A"). Below, a grid: columns = weekdays (Dush, Sesh, Chor, Pay, Jum, Shan), rows = bell periods with times; break rows are thin, grey and span all columns. Each cell is a lesson chip showing subject, teacher (or group/room depending on view) with the subject color dot. Empty cells show a faint "+" on hover. Clicking a cell opens a side panel "Dars qo'shish" with selects for Fan, O'qituvchi, Xona, Guruh; show the conflict error state inline: "Bu vaqtda 101-xona band (8-B · Fizika)" in red under the Xona field. Include a "Nusxalash" action to copy a week from another term.

**B4. Exams (Imtihonlar)** — exam session selector ("Yarim yillik imtihonlar · 21–26 dek"), then a day-by-day list or a rooms × time grid; "Imtihon qo'shish" side panel with Sana, Boshlanish, Tugash, Xona, Fan, Guruh, Nazoratchi. Show the validation message "Sana imtihon davri ichida bo'lishi kerak".

**B4b. Clubs (To'garaklar)** — list of clubs as cards (name, color dot, leader, "3 ta mashg'ulot / hafta", active toggle); clicking a card opens its weekly sessions table (Hafta kuni, Boshlanish, Tugash, Xona) with "Mashg'ulot qo'shish" side panel: Hafta kuni, Boshlanish, Tugash, Xona. Show the conflict error "Bu vaqtda xona band: Robototexnika 14:30–16:30" under the Xona field.

**B5. Calendar (Kalendar)** — academic year as a horizontal timeline (Sep → Jun) with colored spans: terms in primary, breaks in grey, exam sessions in amber; below it, three simple tables (Choraklar, Ta'tillar, Imtihon davrlari) with "Qo'shish" buttons. Date-range editing form.

**B6. Bell schedule (Qo'ng'iroq jadvali)** — ordered list of periods with drag handles: order, name ("1-dars", "Tanaffus", "Tushlik"), kind chip, start–end time inputs; validation "Boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak".

**B7. Simple entity lists** — one shared pattern for Fanlar (name, short name, color swatch), O'qituvchilar (full name, phone, email), Guruhlar (name), Xonalar (name, floor, capacity). Search field, add button, row edit/delete, empty state "Hali fan qo'shilmagan".

**B8. Tablets (Planshetlar)** — table of rooms with pairing status (online / offline / not paired), last seen time, and per-row actions "QR ko'rsatish" (modal with a large QR + the tablet URL) and "Tokenni yangilash" (confirm dialog: "Eski token darhol ishlamay qoladi. Davom etasizmi?"). Include a "Ko'rish" action that previews the live tablet screen for that room in a modal.

**B9. Settings (Sozlamalar)** — school name, logo upload, primary color picker with live preview of a tablet hero card, timezone, working days as toggle chips (Dush … Yak), admin users list with roles ("Admin", "Xodim").

Show B3 also in dark theme and at a 1024-px-wide tablet breakpoint.

---

## 4. Surface C — School Mobile App (Android, 390×844, light + dark)

Each school's build carries its own logo and primary color on the splash and header. Bottom navigation: "Bugun", "Hafta", "Imtihonlar", "Profil".

**C1. Onboarding** — pick role ("Men o'qituvchiman" / "Men o'quvchiman / ota-onaman"), then pick teacher name or group ("7-A") from a searchable list. No password for students; teachers log in with username/password.

**C2. Today (Bugun)** — header with date and term; a compact "now" card (same visual language as the tablet hero, scaled down): current lesson, room, teacher/group, minutes left, progress bar; then the day's list with breaks and lunch; past entries faded. For teachers, each row shows the room prominently ("101").

**C3. Week (Hafta)** — horizontal weekday selector chips, vertical list for the selected day; a "Jadval" button opens a compact weekly grid (periods × days) that fits the phone in landscape.

**C4. Exams (Imtihonlar)** — upcoming exams for my group/teacher grouped by day, amber accents, countdown "3 kundan keyin"; empty state "Hozircha imtihon rejalashtirilmagan".

**C5. Holiday / weekend state** on the Today tab — quiet full-screen state like the tablet's A5.

**C6. Profile (Profil)** — school name and logo, selected role/group/teacher, notifications toggles ("Dars boshlanishidan 5 daqiqa oldin eslatish", "Jadval o'zgarganda xabar berish"), dark-mode switch, "Chiqish".

---

## 5. Deliverables

- All frames above, light and dark, with the default blue primary; A1 and C2 additionally in the green variant.
- A components sheet: top bar, hero/now card (lesson, break, club, exam, free), day-list row (5 kinds × 3 statuses), timetable grid cell chip, side panel form, table row, status pills (online/offline/past/active/upcoming), banner (exam/holiday), empty state, error toast.
- Design tokens: colors (primary, surfaces, text, the four entry kinds, statuses), spacing scale (4/8/12/16/24/32), radii, type scale, both themes.
- Keep every layout implementable with plain CSS grid/flex (the web panel and tablet are Angular; the mobile app is native Android). Avoid effects that need canvas or heavy motion; the only motion is the progress bar advancing and a gentle crossfade when the active entry changes.
