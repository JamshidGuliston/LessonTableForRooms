"""Xona uchun bir kunlik jadvalni hisoblash.

Planshet va boshqa frontendlar shu natijani ko'rsatadi. Kun holati:
  weekend  - dam olish kuni
  holiday  - ta'til (Break)
  exam     - imtihon davri: darslar to'xtatilgan, imtihonlar ko'rsatiladi
  lesson   - oddiy o'quv kuni: darslar + tanaffuslar + to'garaklar
  no_term  - kalendarda chorak yo'q
"""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings

from .models import Break, ClubSession, Exam, ExamSession, Lesson, Period, Term


def school_now(school):
    # Faqat DEBUG: demo va tekshiruv uchun soatni "to'xtatib" qo'yish, masalan
    # DARSJADVAL_FAKE_NOW=2026-10-22T10:42 python manage.py runserver
    fake = os.environ.get('DARSJADVAL_FAKE_NOW') if settings.DEBUG else None
    if fake:
        return datetime.fromisoformat(fake)
    return datetime.now(ZoneInfo(school.timezone)).replace(tzinfo=None)


def day_info(school, day):
    """Maktab uchun kun holati (xonaga bog'liq emas)."""
    info = {'status': 'lesson', 'title': '', 'resumes_on': None, 'term': None, 'session': None}
    if day.weekday() not in school.working_weekdays:
        info['status'] = 'weekend'
        return info
    holiday = Break.on(school, day)
    if holiday:
        info.update(status='holiday', title=holiday.name,
                    resumes_on=_next_working_day(school, holiday.end_date).isoformat())
        return info
    session = ExamSession.on(school, day)
    if session:
        info.update(status='exam', title=session.name, session=session)
        return info
    term = Term.on(school, day)
    if term is None:
        info['status'] = 'no_term'
        return info
    info.update(title=term.name, term=term)
    return info


def room_day(room, day, now=None, info=None):
    """`info` — bir nechta xona uchun hisoblanganda day_info() ni qayta ishlatish uchun."""
    school = room.school
    if now is None:
        now = school_now(school)
    if info is None:
        info = day_info(school, day)

    result = {
        'date': day.isoformat(),
        'weekday': day.weekday(),
        'status': info['status'],
        'title': info['title'],
        'resumes_on': info['resumes_on'],
        'entries': [],
        'current': None,
        'next': None,
    }

    if info['session']:
        entries = [_exam_entry(e) for e in _room_exams(room, info['session'], day)]
    elif info['term']:
        term = info['term']
        entries = [_lesson_entry(l) for l in _room_lessons(room, term, day)]
        entries += [_break_entry(p) for p in _break_periods(school)]
        entries += [_club_entry(c) for c in _room_clubs(room, term.academic_year_id, day)]
    else:
        return result

    entries.sort(key=lambda e: e['start_time'])
    _mark_statuses(entries, now if now.date() == day else None)
    result['entries'] = entries
    result['current'] = next((e for e in entries if e['status'] == 'active'), None)
    result['next'] = next((e for e in entries if e['status'] == 'upcoming'), None)
    return result


def _next_working_day(school, after):
    day = after + timedelta(days=1)
    for _ in range(7):
        if day.weekday() in school.working_weekdays:
            return day
        day += timedelta(days=1)
    return after + timedelta(days=1)


def _room_lessons(room, term, day):
    return (
        Lesson.objects.filter(room=room, term=term, weekday=day.weekday())
        .select_related('period', 'subject', 'group', 'teacher')
    )


def _break_periods(school):
    return Period.objects.filter(school=school).exclude(kind=Period.Kind.LESSON)


def _room_clubs(room, academic_year_id, day):
    return (
        ClubSession.objects.filter(
            room=room, academic_year_id=academic_year_id, weekday=day.weekday(), club__is_active=True
        )
        .select_related('club', 'club__leader')
    )


def _room_exams(room, session, day):
    return (
        Exam.objects.filter(room=room, exam_session=session, date=day)
        .select_related('subject', 'group', 'invigilator')
    )


def _entry(kind, title, start, end, **extra):
    base = {
        'kind': kind,
        'title': title,
        'start_time': start.strftime('%H:%M'),
        'end_time': end.strftime('%H:%M'),
        'group': None,
        'teacher': None,
        'subject_color': None,
        'status': 'upcoming',
    }
    base.update(extra)
    return base


def _lesson_entry(lesson):
    return _entry(
        'lesson',
        lesson.subject.name,
        lesson.period.start_time,
        lesson.period.end_time,
        group=lesson.group.name,
        teacher=lesson.teacher.full_name,
        subject_color=lesson.subject.color or None,
    )


def _break_entry(period):
    return _entry(period.kind, period.name, period.start_time, period.end_time)


def _club_entry(session):
    club = session.club
    return _entry(
        'club',
        club.name,
        session.start_time,
        session.end_time,
        teacher=club.leader.full_name if club.leader else None,
        subject_color=club.color or None,
    )


def _exam_entry(exam):
    return _entry(
        'exam',
        exam.subject.name,
        exam.start_time,
        exam.end_time,
        group=exam.group.name,
        teacher=exam.invigilator.full_name if exam.invigilator else None,
        subject_color=exam.subject.color or None,
    )


def _mark_statuses(entries, now):
    """now=None bo'lsa (boshqa kun ko'rilmoqda) hamma yozuv 'upcoming' qoladi."""
    if now is None:
        return
    now_hm = now.strftime('%H:%M')
    for e in entries:
        if now_hm < e['start_time']:
            e['status'] = 'upcoming'
        elif now_hm < e['end_time']:
            e['status'] = 'active'
        else:
            e['status'] = 'past'
