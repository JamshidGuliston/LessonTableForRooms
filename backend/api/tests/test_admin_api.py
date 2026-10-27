"""Angular admin panel uchun qo'shimcha endpointlar."""
from datetime import date, datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Lesson, Room, School, SchoolMembership, Term

from .factories import make_admin, make_calendar, make_lesson, make_periods, make_room, make_school

User = get_user_model()

# 2025-10-20 dushanba, 1-chorak; 09:40 — 2-dars (09:30–10:15)
NOW = datetime(2025, 10, 20, 9, 40)


def at_now(fn):
    return mock.patch('api.views.school_now', return_value=NOW)(fn)


class TabletLastSeenTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.room = make_room(self.school)

    def test_tablet_poll_records_last_seen(self):
        self.assertIsNone(self.room.last_seen_at)
        self.client.get(f'/api/tablet/{self.room.device_token}/')
        self.room.refresh_from_db()
        self.assertIsNotNone(self.room.last_seen_at)

    def test_room_api_reports_tablet_status(self):
        self.client.force_authenticate(self.admin)
        other = make_room(self.school, '102')
        Room.objects.filter(pk=other.pk).update(last_seen_at=timezone.now() - timedelta(hours=3))
        self.client.get(f'/api/tablet/{self.room.device_token}/')
        make_room(self.school, '103')

        res = self.client.get('/api/schools/a/rooms/')
        status = {r['name']: r['tablet_status'] for r in res.data}
        self.assertEqual(status, {'101': 'online', '102': 'offline', '103': 'unpaired'})
        self.assertIsNotNone(res.data[0]['last_seen_at'])


class DashboardTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.r101 = make_room(self.school, '101')
        self.r102 = make_room(self.school, '102')
        make_lesson(self.school, self.term, self.r101, self.periods[2], weekday=0, subject_name='Fizika')
        make_lesson(self.school, self.term, self.r102, self.periods[4], weekday=0, subject_name='Kimyo',
                    group_name='8-B', teacher_name='Karimov B.')
        self.client.force_authenticate(self.admin)

    @at_now
    def test_stats_and_term(self, _):
        res = self.client.get('/api/schools/a/dashboard/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['stats'], {'rooms': 2, 'teachers': 2, 'groups': 2, 'lessons_today': 2})
        self.assertEqual(res.data['term'], '1-chorak')
        self.assertEqual(res.data['day_status'], 'lesson')
        self.assertEqual(res.data['now'], '2025-10-20T09:40:00')

    @at_now
    def test_rooms_now_shows_current_or_next(self, _):
        rooms = {r['name']: r for r in self.client.get('/api/schools/a/dashboard/').data['rooms']}
        self.assertEqual(rooms['101']['current']['title'], 'Fizika')
        self.assertIsNone(rooms['102']['current'])
        self.assertEqual(rooms['102']['next']['title'], 'Kimyo')
        self.assertEqual(rooms['101']['tablet_status'], 'unpaired')

    @at_now
    def test_alerts_for_offline_tablets_and_upcoming_break(self, _):
        Room.objects.filter(pk=self.r101.pk).update(last_seen_at=timezone.now() - timedelta(hours=3))
        # make_calendar: kuzgi ta'til 3-noyabr — 14 kun ichida
        alerts = self.client.get('/api/schools/a/dashboard/').data['alerts']
        kinds = {a['kind']: a for a in alerts}
        self.assertEqual(kinds['tablets_offline']['count'], 1)
        self.assertEqual(kinds['break_soon']['title'], "Kuzgi ta'til")
        self.assertEqual(kinds['break_soon']['days'], 14)

    def test_staff_can_view_dashboard(self):
        staff = User.objects.create_user('staff', password='x')
        SchoolMembership.objects.create(user=staff, school=self.school, role=SchoolMembership.Role.STAFF)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get('/api/schools/a/dashboard/').status_code, 200)


class SchoolSettingsTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.client.force_authenticate(self.admin)

    def test_get_and_update_settings(self):
        res = self.client.get('/api/schools/a/settings/')
        self.assertEqual(res.data['primary_color'], '#2563EB')
        res = self.client.patch('/api/schools/a/settings/', {
            'name': 'Yangi nom', 'primary_color': '#059669', 'working_days': '0,1,2,3,4',
        })
        self.assertEqual(res.status_code, 200, res.data)
        self.school.refresh_from_db()
        self.assertEqual(self.school.name, 'Yangi nom')
        self.assertEqual(self.school.primary_color, '#059669')
        self.assertEqual(self.school.working_weekdays, {0, 1, 2, 3, 4})

    def test_slug_cannot_be_changed(self):
        self.client.patch('/api/schools/a/settings/', {'slug': 'b'})
        self.assertTrue(School.objects.filter(slug='a').exists())

    def test_invalid_color_and_days_rejected(self):
        self.assertEqual(self.client.patch('/api/schools/a/settings/', {'primary_color': 'blue'}).status_code, 400)
        self.assertEqual(self.client.patch('/api/schools/a/settings/', {'working_days': '0,9'}).status_code, 400)

    def test_me_includes_primary_color(self):
        me = self.client.get('/api/me/').data
        self.assertEqual(me['schools'][0]['primary_color'], '#2563EB')

    def test_staff_cannot_change_settings(self):
        staff = User.objects.create_user('staff', password='x')
        SchoolMembership.objects.create(user=staff, school=self.school, role=SchoolMembership.Role.STAFF)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.patch('/api/schools/a/settings/', {'name': 'X'}).status_code, 403)


class MembersTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.client.force_authenticate(self.admin)

    def test_list_members(self):
        res = self.client.get('/api/schools/a/members/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data[0]['username'], 'admin1')
        self.assertEqual(res.data[0]['role'], 'admin')

    def test_add_member_creates_user(self):
        res = self.client.post('/api/schools/a/members/', {
            'username': 'nilufar', 'full_name': 'Mirzayeva Nilufar', 'password': 'parol12345', 'role': 'staff',
        })
        self.assertEqual(res.status_code, 201, res.data)
        user = User.objects.get(username='nilufar')
        self.assertTrue(user.check_password('parol12345'))
        self.assertEqual(res.data['full_name'], 'Mirzayeva Nilufar')

    def test_add_existing_user_to_school(self):
        User.objects.create_user('doston', password='x')
        res = self.client.post('/api/schools/a/members/', {'username': 'doston', 'role': 'staff'})
        self.assertEqual(res.status_code, 201, res.data)

    def test_new_user_requires_password(self):
        res = self.client.post('/api/schools/a/members/', {'username': 'yangi', 'role': 'staff'})
        self.assertEqual(res.status_code, 400)

    def test_change_role_and_remove(self):
        res = self.client.post('/api/schools/a/members/', {'username': 'x1', 'password': 'parol12345', 'role': 'staff'})
        mid = res.data['id']
        self.assertEqual(self.client.patch(f'/api/schools/a/members/{mid}/', {'role': 'admin'}).data['role'], 'admin')
        self.assertEqual(self.client.delete(f'/api/schools/a/members/{mid}/').status_code, 204)

    def test_cannot_remove_yourself(self):
        mid = SchoolMembership.objects.get(user=self.admin).id
        self.assertEqual(self.client.delete(f'/api/schools/a/members/{mid}/').status_code, 400)


class CopyLessonsTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.year, self.term, _ = make_calendar(self.school)
        self.term2 = Term.objects.create(
            school=self.school, academic_year=self.year, name='2-chorak',
            start_date=date(2026, 1, 10), end_date=date(2026, 3, 20),
        )
        periods = make_periods(self.school)
        room = make_room(self.school)
        make_lesson(self.school, self.term, room, periods[0], weekday=0)
        make_lesson(self.school, self.term, room, periods[2], weekday=1, subject_name='Fizika')
        self.client.force_authenticate(self.admin)

    def test_copies_all_lessons_to_empty_term(self):
        res = self.client.post('/api/schools/a/lessons/copy/', {'from_term': self.term.id, 'to_term': self.term2.id})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['copied'], 2)
        self.assertEqual(Lesson.objects.filter(term=self.term2).count(), 2)

    def test_refuses_non_empty_target(self):
        self.client.post('/api/schools/a/lessons/copy/', {'from_term': self.term.id, 'to_term': self.term2.id})
        res = self.client.post('/api/schools/a/lessons/copy/', {'from_term': self.term.id, 'to_term': self.term2.id})
        self.assertEqual(res.status_code, 400)

    def test_rejects_term_of_other_school(self):
        other = make_school('b')
        _, other_term, _ = make_calendar(other)
        res = self.client.post('/api/schools/a/lessons/copy/', {'from_term': other_term.id, 'to_term': self.term2.id})
        self.assertEqual(res.status_code, 400)


class ProtectedDeleteTests(APITestCase):
    def test_deleting_room_used_in_timetable_is_400_with_message(self):
        school = make_school('a')
        admin = make_admin(school)
        _, term, _ = make_calendar(school)
        periods = make_periods(school)
        room = make_room(school)
        make_lesson(school, term, room, periods[0], weekday=0)
        self.client.force_authenticate(admin)
        res = self.client.delete(f'/api/schools/a/rooms/{room.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('ishlatilmoqda', str(res.data))
        self.assertTrue(Room.objects.filter(pk=room.pk).exists())
