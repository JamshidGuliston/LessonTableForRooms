"""Demo maktab yaratadi: kalendar, qo'ng'iroq jadvali, xonalar va to'liq haftalik jadval.

    python manage.py seed_demo

Bugungi kunni o'z ichiga olgan chorak yaratiladi, shuning uchun planshet darhol
nimadir ko'rsatadi. Qayta ishga tushirilsa, mavjud demo maktab o'chirilib qayta yaratiladi.
"""
from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import (
    AcademicYear,
    Break,
    Club,
    ClubSession,
    Exam,
    ExamSession,
    Group,
    Lesson,
    Period,
    Room,
    School,
    SchoolMembership,
    Subject,
    Teacher,
    Term,
)

SLUG = 'demo-maktab'

PERIODS = [
    ('1-dars', Period.Kind.LESSON, time(8, 30), time(9, 15)),
    ('Tanaffus', Period.Kind.COFFEE_BREAK, time(9, 15), time(9, 25)),
    ('2-dars', Period.Kind.LESSON, time(9, 25), time(10, 10)),
    ('Tanaffus', Period.Kind.COFFEE_BREAK, time(10, 10), time(10, 20)),
    ('3-dars', Period.Kind.LESSON, time(10, 20), time(11, 5)),
    ('Tushlik', Period.Kind.LUNCH, time(11, 5), time(11, 45)),
    ('4-dars', Period.Kind.LESSON, time(11, 45), time(12, 30)),
    ('Tanaffus', Period.Kind.COFFEE_BREAK, time(12, 30), time(12, 40)),
    ('5-dars', Period.Kind.LESSON, time(12, 40), time(13, 25)),
    ('6-dars', Period.Kind.LESSON, time(13, 30), time(14, 15)),
]

SUBJECTS = [
    ('Matematika', '#2563eb'),
    ('Fizika', '#7c3aed'),
    ('Kimyo', '#059669'),
    ('Ona tili', '#d97706'),
    ('Ingliz tili', '#dc2626'),
    ('Tarix', '#92400e'),
    ('Biologiya', '#16a34a'),
    ('Informatika', '#0891b2'),
]

TEACHERS = [
    'Aliyev Anvar', 'Karimova Dilnoza', 'Rahimov Sardor', 'Yusupova Malika',
    'Toshmatov Bekzod', 'Nazarova Gulnora', 'Ergashev Jasur', 'Saidova Kamola',
]

GROUPS = ['7-A', '7-B', '8-A', '8-B', '9-A', '9-B']

# (nomi, rangi, hafta kunlari, boshlanish, tugash) — darslar 14:15 da tugaydi
CLUBS = [
    ('Shaxmat', '#a78bfa', [0, 2], time(14, 30), time(16, 0)),
    ('Robototexnika', '#f472b6', [1, 3], time(14, 30), time(16, 30)),
    ('Futbol', '#4ade80', [4], time(15, 0), time(16, 30)),
    ('Rasm', '#fb923c', [0, 4], time(14, 30), time(15, 30)),
]
ROOMS = ['101', '102', '103', '201', '202', '203']


class Command(BaseCommand):
    help = 'Demo maktab va to\'liq jadval yaratadi'

    @transaction.atomic
    def handle(self, *args, **options):
        # Lesson/Exam/ClubSession xona va fanni PROTECT bilan ushlab turadi —
        # avval ular, keyin maktab (qolganlari CASCADE bilan ketadi).
        for model in (Lesson, Exam, ClubSession):
            model.objects.filter(school__slug=SLUG).delete()
        School.objects.filter(slug=SLUG).delete()
        school = School.objects.create(name='Demo maktab', slug=SLUG)

        User = get_user_model()
        admin, created = User.objects.get_or_create(username='admin', defaults={'is_staff': True})
        if created:
            admin.set_password('admin123')
            admin.save()
        SchoolMembership.objects.create(user=admin, school=school, role=SchoolMembership.Role.ADMIN)

        periods = [
            Period.objects.create(school=school, order=i, name=n, kind=k, start_time=s, end_time=e)
            for i, (n, k, s, e) in enumerate(PERIODS, start=1)
        ]
        lesson_periods = [p for p in periods if p.kind == Period.Kind.LESSON]

        subjects = [Subject.objects.create(school=school, name=n, color=c) for n, c in SUBJECTS]
        teachers = [Teacher.objects.create(school=school, full_name=n) for n in TEACHERS]
        groups = [Group.objects.create(school=school, name=n) for n in GROUPS]
        rooms = [Room.objects.create(school=school, name=n, floor=n[0]) for n in ROOMS]

        term, session = self._calendar(school)
        self._lessons(school, term, lesson_periods, subjects, teachers, groups, rooms)
        self._exams(school, session, subjects, groups, rooms, teachers)
        self._clubs(school, term.academic_year, teachers, rooms)

        self.stdout.write(self.style.SUCCESS(f'Demo maktab yaratildi: {school.name} ({SLUG})'))
        self.stdout.write('Admin: admin / admin123')
        self.stdout.write('Planshet manzillari (frontend):')
        for room in rooms:
            self.stdout.write(f'  {room.name}: http://localhost:4200/tablet/{room.device_token}')

    def _calendar(self, school):
        """Bugun chorak ichida bo'lsin; bir haftadan keyin 7 kunlik ta'til, 2 oydan keyin imtihon."""
        today = date.today()
        year_start = date(today.year if today.month >= 9 else today.year - 1, 9, 1)
        year = AcademicYear.objects.create(
            school=school, name=f'{year_start.year}-{year_start.year + 1}',
            start_date=year_start, end_date=date(year_start.year + 1, 6, 30),
        )
        term = Term.objects.create(
            school=school, academic_year=year, name='1-yarim yillik',
            start_date=year_start, end_date=today + timedelta(days=90),
        )
        Break.objects.create(
            school=school, name='Kuzgi ta\'til',
            start_date=today + timedelta(days=7), end_date=today + timedelta(days=13),
        )
        session = ExamSession.objects.create(
            school=school, name='Yarim yillik imtihonlar', kind=ExamSession.Kind.MIDTERM,
            start_date=today + timedelta(days=60), end_date=today + timedelta(days=65),
        )
        return term, session

    def _lessons(self, school, term, periods, subjects, teachers, groups, rooms):
        """Har guruh har kuni 5 dars; xona = guruh raqami bo'yicha, o'qituvchi = fan bo'yicha."""
        for weekday in range(6):  # dushanba–shanba
            for gi, group in enumerate(groups):
                room = rooms[gi]
                for pi, period in enumerate(periods[:5]):
                    si = (gi + pi + weekday) % len(subjects)
                    Lesson.objects.create(
                        school=school, term=term, weekday=weekday, period=period,
                        room=room, subject=subjects[si], group=group, teacher=teachers[si],
                    )

    def _clubs(self, school, year, teachers, rooms):
        """Har to'garak o'z xonasida, darslardan keyin."""
        for i, (name, color, weekdays, start, end) in enumerate(CLUBS):
            club = Club.objects.create(school=school, name=name, color=color, leader=teachers[i])
            for weekday in weekdays:
                ClubSession.objects.create(
                    school=school, club=club, academic_year=year, weekday=weekday,
                    start_time=start, end_time=end, room=rooms[i],
                )

    def _exams(self, school, session, subjects, groups, rooms, teachers):
        day = session.start_date
        slots = [(time(9, 0), time(11, 0)), (time(12, 0), time(14, 0))]
        for i, group in enumerate(groups):
            for j, (start, end) in enumerate(slots):
                Exam.objects.create(
                    school=school, exam_session=session, date=day + timedelta(days=j),
                    start_time=start, end_time=end, room=rooms[i],
                    subject=subjects[(i + j) % len(subjects)], group=group,
                    invigilator=teachers[(i + j + 1) % len(teachers)],
                )
