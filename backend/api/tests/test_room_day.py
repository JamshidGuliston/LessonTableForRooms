"""Xona uchun bir kunlik jadvalni hisoblash (planshet ko'rsatadigan narsa)."""
from datetime import date, datetime, time

from django.test import TestCase

from api.models import Exam, Subject, Group
from api.services import room_day

from .factories import make_calendar, make_lesson, make_periods, make_room, make_school

# 2025-10-20 — dushanba, 1-chorak ichida, ta'til yoki imtihon yo'q
MONDAY = date(2025, 10, 20)


class RoomDayStatusTests(TestCase):
    def setUp(self):
        self.school = make_school()
        self.year, self.term, self.session = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)

    def test_weekend_has_no_entries(self):
        sunday = date(2025, 10, 19)
        day = room_day(self.room, sunday)
        self.assertEqual(day['status'], 'weekend')
        self.assertEqual(day['entries'], [])

    def test_break_day_reports_break_name(self):
        day = room_day(self.room, date(2025, 11, 5))
        self.assertEqual(day['status'], 'holiday')
        self.assertEqual(day['title'], "Kuzgi ta'til")
        self.assertEqual(day['entries'], [])

    def test_break_day_reports_next_working_day_after_break(self):
        # Ta'til 3–9 noyabr (yakshanba bilan tugaydi) → 10-noyabr dushanba
        day = room_day(self.room, date(2025, 11, 5))
        self.assertEqual(day['resumes_on'], '2025-11-10')

    def test_lesson_day_has_no_resumes_on(self):
        self.assertIsNone(room_day(self.room, MONDAY)['resumes_on'])

    def test_date_outside_any_term_is_no_term(self):
        day = room_day(self.room, date(2026, 1, 5))
        self.assertEqual(day['status'], 'no_term')
        self.assertEqual(day['entries'], [])

    def test_lesson_day_lists_room_lessons_and_breaks_in_time_order(self):
        make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0, subject_name='Matematika')
        make_lesson(self.school, self.term, self.room, self.periods[4], weekday=0, subject_name='Fizika')
        # boshqa xonadagi dars ko'rinmasligi kerak
        other_room = make_room(self.school, name='102')
        make_lesson(self.school, self.term, other_room, self.periods[2], weekday=0, subject_name='Kimyo')
        # boshqa kundagi dars ham ko'rinmasligi kerak
        make_lesson(self.school, self.term, self.room, self.periods[2], weekday=1, subject_name='Tarix')

        day = room_day(self.room, MONDAY)

        self.assertEqual(day['status'], 'lesson')
        self.assertEqual(
            [(e['kind'], e['title']) for e in day['entries']],
            [
                ('lesson', 'Matematika'),
                ('coffee_break', 'Tanaffus'),
                ('free', "Xona bo'sh"),  # 2-dars: bu xonada dars yo'q
                ('lunch', 'Tushlik'),
                ('lesson', 'Fizika'),
            ],
        )

    def test_lesson_entry_carries_group_teacher_and_times(self):
        make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0,
                    group_name='7-A', teacher_name='Aliyev A.')
        entry = room_day(self.room, MONDAY)['entries'][0]
        self.assertEqual(entry['group'], '7-A')
        self.assertEqual(entry['teacher'], 'Aliyev A.')
        self.assertEqual(entry['start_time'], '08:30')
        self.assertEqual(entry['end_time'], '09:15')

    def test_exam_session_suspends_lessons_and_shows_room_exams(self):
        make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0, subject_name='Matematika')
        subject = Subject.objects.create(school=self.school, name='Ona tili')
        group = Group.objects.create(school=self.school, name='9-B')
        exam_day = date(2025, 12, 15)  # dushanba, sessiya ichida
        Exam.objects.create(
            school=self.school, exam_session=self.session, subject=subject, group=group,
            room=self.room, date=exam_day, start_time=time(9, 0), end_time=time(11, 0),
        )
        # boshqa xonadagi imtihon
        Exam.objects.create(
            school=self.school, exam_session=self.session, subject=subject, group=group,
            room=make_room(self.school, '102'), date=exam_day, start_time=time(9, 0), end_time=time(11, 0),
        )

        day = room_day(self.room, exam_day)

        self.assertEqual(day['status'], 'exam')
        self.assertEqual(day['title'], 'Yarim yillik imtihonlar')
        self.assertEqual(len(day['entries']), 1)
        self.assertEqual(day['entries'][0]['kind'], 'exam')
        self.assertEqual(day['entries'][0]['title'], 'Ona tili')
        self.assertEqual(day['entries'][0]['group'], '9-B')
        self.assertEqual(day['entries'][0]['start_time'], '09:00')


class RoomDayNowTests(TestCase):
    """Hozirgi vaqtga nisbatan har bir yozuv: past / active / upcoming."""

    def setUp(self):
        self.school = make_school()
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)
        make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0)
        make_lesson(self.school, self.term, self.room, self.periods[2], weekday=0, subject_name='Fizika')

    def statuses(self, now_time):
        now = datetime.combine(MONDAY, now_time)
        return [e['status'] for e in room_day(self.room, MONDAY, now=now)['entries']]

    def test_entry_in_progress_is_active(self):
        # 09:35 — 2-dars (09:30–10:15) davom etmoqda; oxirgisi — bo'sh 3-dars
        self.assertEqual(self.statuses(time(9, 35)), ['past', 'past', 'active', 'upcoming', 'upcoming'])

    def test_start_time_is_inclusive_end_time_exclusive(self):
        self.assertEqual(self.statuses(time(8, 30)), ['active', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
        self.assertEqual(self.statuses(time(9, 15)), ['past', 'active', 'upcoming', 'upcoming', 'upcoming'])

    def test_current_and_next_entries_are_exposed_at_top_level(self):
        now = datetime.combine(MONDAY, time(9, 35))
        day = room_day(self.room, MONDAY, now=now)
        self.assertEqual(day['current']['title'], 'Fizika')
        self.assertEqual(day['next']['title'], 'Tushlik')

    def test_between_entries_current_is_none(self):
        now = datetime.combine(MONDAY, time(7, 0))
        day = room_day(self.room, MONDAY, now=now)
        self.assertIsNone(day['current'])
        self.assertEqual(day['next']['title'], 'Matematika')

    def test_after_last_entry_both_are_none(self):
        now = datetime.combine(MONDAY, time(12, 0))
        day = room_day(self.room, MONDAY, now=now)
        self.assertIsNone(day['current'])
        self.assertIsNone(day['next'])


class FreePeriodTests(TestCase):
    """Darsi yo'q dars soati — "Xona bo'sh"; lekin u "hozir"/"keyingi" emas."""

    def setUp(self):
        self.school = make_school()
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)
        make_lesson(self.school, self.term, self.room, self.periods[2], weekday=0)

    def test_free_period_is_not_current_or_next(self):
        day = room_day(self.room, MONDAY, now=datetime.combine(MONDAY, time(8, 40)))
        free = day['entries'][0]
        self.assertEqual((free['kind'], free['status']), ('free', 'active'))
        self.assertIsNone(day['current'])
        self.assertEqual(day['next']['title'], 'Tanaffus')

    def test_club_in_lesson_period_is_not_free(self):
        from api.models import Club, ClubSession
        club = Club.objects.create(school=self.school, name='Shaxmat')
        ClubSession.objects.create(school=self.school, club=club, academic_year=self.term.academic_year, weekday=0,
                                   start_time=time(10, 50), end_time=time(11, 20), room=self.room)
        kinds = [e['kind'] for e in room_day(self.room, MONDAY)['entries']]
        self.assertEqual(kinds, ['free', 'coffee_break', 'lesson', 'lunch', 'club'])


class LessonNumberTests(TestCase):
    """Dars soatlari 1, 2, 3 … deb raqamlanadi (vaqt bo'yicha); tanaffus/tushlik/to'garak — raqamsiz."""

    def setUp(self):
        self.school = make_school()
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)  # 1-dars, tanaffus, 2-dars, tushlik, 3-dars
        self.room = make_room(self.school)
        make_lesson(self.school, self.term, self.room, self.periods[2], weekday=0)

    def test_numbers_follow_lesson_periods_only(self):
        entries = room_day(self.room, MONDAY)['entries']
        got = [(e['kind'], e['start_time'], e['number']) for e in entries]
        self.assertEqual(got, [
            ('free', '08:30', 1),
            ('coffee_break', '09:15', None),
            ('lesson', '09:30', 2),
            ('lunch', '10:15', None),
            ('free', '10:45', 3),
        ])

    def test_number_follows_time_not_creation_order(self):
        from api.models import Period
        Period.objects.create(school=self.school, order=0, name='0-dars', kind=Period.Kind.LESSON,
                              start_time=time(7, 45), end_time=time(8, 25))
        lesson = next(e for e in room_day(self.room, MONDAY)['entries'] if e['kind'] == 'lesson')
        self.assertEqual(lesson['number'], 3)
