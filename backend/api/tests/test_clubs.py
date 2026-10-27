"""To'garaklar: darsdan keyingi mashg'ulotlar, o'quv yili davomida haftalik takrorlanadi."""
from datetime import date, datetime, time

from django.test import TestCase
from rest_framework.test import APITestCase

from api.models import Club, ClubSession, Exam, Group, Subject, Teacher
from api.services import room_day

from .factories import make_admin, make_calendar, make_lesson, make_periods, make_room, make_school

MONDAY = date(2025, 10, 20)


def make_club_session(school, year, room, weekday=0, start=time(14, 0), end=time(15, 30), name='Shaxmat'):
    leader, _ = Teacher.objects.get_or_create(school=school, full_name='Rahimov S.')
    club, _ = Club.objects.get_or_create(school=school, name=name, defaults={'leader': leader})
    return ClubSession.objects.create(
        school=school, club=club, academic_year=year, weekday=weekday,
        start_time=start, end_time=end, room=room,
    )


class ClubRoomDayTests(TestCase):
    def setUp(self):
        self.school = make_school()
        self.year, self.term, self.session = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)
        make_lesson(self.school, self.term, self.room, self.periods[4], weekday=0, subject_name='Fizika')

    def test_club_appears_after_lessons_on_lesson_day(self):
        make_club_session(self.school, self.year, self.room)
        entries = room_day(self.room, MONDAY)['entries']
        self.assertEqual([(e['kind'], e['title']) for e in entries][-2:], [('lesson', 'Fizika'), ('club', 'Shaxmat')])
        club = entries[-1]
        self.assertEqual(club['start_time'], '14:00')
        self.assertEqual(club['end_time'], '15:30')
        self.assertEqual(club['teacher'], 'Rahimov S.')
        self.assertIsNone(club['group'])

    def test_club_in_other_room_or_weekday_is_hidden(self):
        make_club_session(self.school, self.year, make_room(self.school, '102'), weekday=0)
        make_club_session(self.school, self.year, self.room, weekday=2, name='Robototexnika')
        kinds = [e['kind'] for e in room_day(self.room, MONDAY)['entries']]
        self.assertNotIn('club', kinds)

    def test_club_is_active_during_its_time(self):
        make_club_session(self.school, self.year, self.room)
        now = datetime.combine(MONDAY, time(14, 30))
        day = room_day(self.room, MONDAY, now=now)
        self.assertEqual(day['current']['title'], 'Shaxmat')

    def test_club_hidden_on_exam_day(self):
        make_club_session(self.school, self.year, self.room)
        exam_day = date(2025, 12, 15)
        Exam.objects.create(
            school=self.school, exam_session=self.session,
            subject=Subject.objects.create(school=self.school, name='Ona tili'),
            group=Group.objects.create(school=self.school, name='9-B'),
            room=self.room, date=exam_day, start_time=time(9, 0), end_time=time(11, 0),
        )
        kinds = [e['kind'] for e in room_day(self.room, exam_day)['entries']]
        self.assertEqual(kinds, ['exam'])

    def test_club_hidden_on_holiday(self):
        make_club_session(self.school, self.year, self.room, weekday=2)
        self.assertEqual(room_day(self.room, date(2025, 11, 5))['entries'], [])


class ClubApiTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.year, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)
        self.leader = Teacher.objects.create(school=self.school, full_name='Rahimov S.')
        self.club = Club.objects.create(school=self.school, name='Shaxmat', leader=self.leader)
        # dushanba 3-dars 10:45–11:30 band
        make_lesson(self.school, self.term, self.room, self.periods[4], weekday=0)
        self.client.force_authenticate(self.admin)

    def payload(self, **over):
        data = {
            'club': self.club.id, 'academic_year': self.year.id, 'weekday': 0,
            'start_time': '14:00', 'end_time': '15:30', 'room': self.room.id,
        }
        data.update(over)
        return data

    def test_create_club_and_session(self):
        res = self.client.post('/api/schools/a/clubs/', {'name': 'Robototexnika', 'leader': self.leader.id})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['leader_name'], 'Rahimov S.')

        res = self.client.post('/api/schools/a/club-sessions/', self.payload(club=res.data['id']))
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['club_name'], 'Robototexnika')
        self.assertEqual(res.data['room_name'], self.room.name)

    def test_session_overlapping_a_lesson_in_same_room_is_rejected(self):
        res = self.client.post('/api/schools/a/club-sessions/', self.payload(start_time='11:00', end_time='12:00'))
        self.assertEqual(res.status_code, 400)
        self.assertIn('room', res.data)

    def test_session_touching_lesson_end_is_allowed(self):
        res = self.client.post('/api/schools/a/club-sessions/', self.payload(start_time='11:30', end_time='12:30'))
        self.assertEqual(res.status_code, 201, res.data)

    def test_session_overlapping_another_club_in_same_room_is_rejected(self):
        make_club_session(self.school, self.year, self.room, start=time(14, 0), end=time(15, 0), name='Rasm')
        res = self.client.post('/api/schools/a/club-sessions/', self.payload(start_time='14:30', end_time='16:00'))
        self.assertEqual(res.status_code, 400)
        self.assertIn('room', res.data)

    def test_updating_session_does_not_conflict_with_itself(self):
        s = make_club_session(self.school, self.year, self.room)
        res = self.client.patch(f'/api/schools/a/club-sessions/{s.id}/', {'end_time': '16:00'})
        self.assertEqual(res.status_code, 200, res.data)

    def test_end_before_start_is_rejected(self):
        res = self.client.post('/api/schools/a/club-sessions/', self.payload(start_time='15:00', end_time='14:00'))
        self.assertEqual(res.status_code, 400)

    def test_list_filters_by_club_weekday_room(self):
        make_club_session(self.school, self.year, self.room, weekday=0)
        make_club_session(self.school, self.year, self.room, weekday=3, name='Rasm')
        self.assertEqual(len(self.client.get('/api/schools/a/club-sessions/', {'weekday': 3}).data), 1)
        self.assertEqual(len(self.client.get('/api/schools/a/club-sessions/', {'club': self.club.id}).data), 1)
        self.assertEqual(len(self.client.get('/api/schools/a/club-sessions/', {'room': self.room.id}).data), 2)

    def test_other_school_cannot_see_clubs(self):
        other = make_school('b')
        make_admin(other, 'admin_b')
        self.client.force_authenticate(other.memberships.first().user)
        self.assertEqual(self.client.get('/api/schools/a/clubs/').status_code, 403)
