"""Test uchun tayyor ma'lumotlar: bitta maktab, uning kalendari va jadvali."""
from datetime import date, time

from django.contrib.auth import get_user_model

from api.models import (
    AcademicYear,
    Break,
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

User = get_user_model()


def make_school(slug='maktab-1', **kwargs):
    defaults = {'name': f'Maktab {slug}', 'working_days': '0,1,2,3,4,5'}
    defaults.update(kwargs)
    return School.objects.create(slug=slug, **defaults)


def make_admin(school, username='admin1'):
    user = User.objects.create_user(username=username, password='pass12345')
    SchoolMembership.objects.create(user=user, school=school, role=SchoolMembership.Role.ADMIN)
    return user


def make_calendar(school):
    """2025-26 o'quv yili: 1-chorak sentabr-oktabr, 1 haftalik ta'til, imtihon sessiyasi."""
    year = AcademicYear.objects.create(
        school=school, name='2025-2026', start_date=date(2025, 9, 1), end_date=date(2026, 6, 30)
    )
    term = Term.objects.create(
        school=school,
        academic_year=year,
        name='1-chorak',
        start_date=date(2025, 9, 1),
        end_date=date(2025, 12, 28),
    )
    Break.objects.create(
        school=school, name='Kuzgi ta\'til', start_date=date(2025, 11, 3), end_date=date(2025, 11, 9)
    )
    session = ExamSession.objects.create(
        school=school,
        name='Yarim yillik imtihonlar',
        kind=ExamSession.Kind.MIDTERM,
        start_date=date(2025, 12, 15),
        end_date=date(2025, 12, 20),
    )
    return year, term, session


def make_periods(school):
    """1-dars, tanaffus, 2-dars, tushlik, 3-dars."""
    kinds = Period.Kind
    rows = [
        ('1-dars', kinds.LESSON, time(8, 30), time(9, 15)),
        ('Tanaffus', kinds.COFFEE_BREAK, time(9, 15), time(9, 30)),
        ('2-dars', kinds.LESSON, time(9, 30), time(10, 15)),
        ('Tushlik', kinds.LUNCH, time(10, 15), time(10, 45)),
        ('3-dars', kinds.LESSON, time(10, 45), time(11, 30)),
    ]
    return [
        Period.objects.create(
            school=school, order=i, name=name, kind=kind, start_time=start, end_time=end
        )
        for i, (name, kind, start, end) in enumerate(rows, start=1)
    ]


def make_room(school, name='101'):
    return Room.objects.create(school=school, name=name)


def make_lesson(school, term, room, period, weekday, subject_name='Matematika', group_name='7-A',
                teacher_name='Aliyev A.'):
    subject, _ = Subject.objects.get_or_create(school=school, name=subject_name)
    group, _ = Group.objects.get_or_create(school=school, name=group_name)
    teacher, _ = Teacher.objects.get_or_create(school=school, full_name=teacher_name)
    return Lesson.objects.create(
        school=school,
        term=term,
        room=room,
        period=period,
        weekday=weekday,
        subject=subject,
        group=group,
        teacher=teacher,
    )
