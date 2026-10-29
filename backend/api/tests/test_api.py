from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.models import Group, Lesson, Room, SchoolMembership, Subject, Teacher, Term

from .factories import (
    make_admin,
    make_calendar,
    make_lesson,
    make_periods,
    make_room,
    make_school,
)

User = get_user_model()


class TabletEndpointTests(APITestCase):
    """Planshet loginsiz, xona tokeni bilan jadvalni oladi."""

    def setUp(self):
        self.school = make_school()
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school, name='101')
        make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0)

    def test_unknown_token_is_404(self):
        res = self.client.get('/api/tablet/yoq-token/')
        self.assertEqual(res.status_code, 404)

    def test_returns_room_school_and_requested_day(self):
        res = self.client.get(f'/api/tablet/{self.room.device_token}/', {'date': '2025-10-20'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['room']['name'], '101')
        self.assertEqual(res.data['school']['name'], self.school.name)
        self.assertIn('now', res.data)
        self.assertEqual(res.data['day']['status'], 'lesson')
        self.assertEqual(res.data['day']['entries'][0]['title'], 'Matematika')

    def test_bad_date_is_400(self):
        res = self.client.get(f'/api/tablet/{self.room.device_token}/', {'date': '2025-13-99'})
        self.assertEqual(res.status_code, 400)

    def test_without_date_uses_today(self):
        res = self.client.get(f'/api/tablet/{self.room.device_token}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['day']['date'], res.data['now'][:10])


class TenantIsolationTests(APITestCase):
    def setUp(self):
        self.school_a = make_school('a')
        self.school_b = make_school('b')
        self.admin_a = make_admin(self.school_a, 'admin_a')
        Subject.objects.create(school=self.school_a, name='Matematika')
        Subject.objects.create(school=self.school_b, name='Fizika')
        self.client.force_authenticate(self.admin_a)

    def test_lists_only_own_school_data(self):
        res = self.client.get('/api/schools/a/subjects/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([s['name'] for s in res.data], ['Matematika'])

    def test_other_school_is_forbidden(self):
        res = self.client.get('/api/schools/b/subjects/')
        self.assertEqual(res.status_code, 403)

    def test_anonymous_is_unauthorized(self):
        self.client.force_authenticate(None)
        res = self.client.get('/api/schools/a/subjects/')
        self.assertEqual(res.status_code, 401)

    def test_create_assigns_school_from_url(self):
        res = self.client.post('/api/schools/a/subjects/', {'name': 'Kimyo'})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Subject.objects.get(name='Kimyo').school, self.school_a)

    def test_object_from_other_school_is_not_found(self):
        other = Subject.objects.get(name='Fizika')
        res = self.client.get(f'/api/schools/a/subjects/{other.id}/')
        self.assertEqual(res.status_code, 404)

    def test_staff_role_can_read_but_not_write(self):
        staff = User.objects.create_user(username='staff_a', password='x')
        SchoolMembership.objects.create(user=staff, school=self.school_a, role=SchoolMembership.Role.STAFF)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get('/api/schools/a/subjects/').status_code, 200)
        self.assertEqual(self.client.post('/api/schools/a/subjects/', {'name': 'X'}).status_code, 403)

    def test_superuser_sees_every_school(self):
        root = User.objects.create_superuser(username='root', password='x')
        self.client.force_authenticate(root)
        self.assertEqual(self.client.get('/api/schools/b/subjects/').status_code, 200)


class MeAndAuthTests(APITestCase):
    def test_token_login_and_me_lists_schools(self):
        school = make_school('a')
        make_admin(school, 'admin_a')
        res = self.client.post('/api/auth/token/', {'username': 'admin_a', 'password': 'pass12345'})
        self.assertEqual(res.status_code, 200)
        token = res.data['token']

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        me = self.client.get('/api/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['username'], 'admin_a')
        self.assertEqual(me.data['schools'], [{'slug': 'a', 'name': school.name, 'role': 'admin', 'primary_color': '#2563EB'}])


class LessonApiTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school)
        self.lesson = make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0)
        self.client.force_authenticate(self.admin)

    def payload(self, **over):
        data = {
            'term': self.term.id,
            'weekday': 0,
            'period': self.periods[2].id,
            'rooms': [self.room.id],
            'subjects': [s.id for s in self.lesson.subjects.all()],
            'groups': [g.id for g in self.lesson.groups.all()],
            'teachers': [t.id for t in self.lesson.teachers.all()],
        }
        data.update(over)
        return data

    def test_create_lesson(self):
        res = self.client.post('/api/schools/a/lessons/', self.payload())
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Lesson.objects.count(), 2)

    def test_lesson_on_break_period_is_rejected(self):
        res = self.client.post('/api/schools/a/lessons/', self.payload(period=self.periods[1].id))
        self.assertEqual(res.status_code, 400)
        self.assertIn('period', res.data)

    def test_room_conflict_is_400_not_500(self):
        res = self.client.post('/api/schools/a/lessons/', self.payload(period=self.periods[0].id))
        self.assertEqual(res.status_code, 400)

    def test_related_object_from_other_school_is_rejected(self):
        other = make_school('b')
        foreign_room = make_room(other, 'Z')
        res = self.client.post('/api/schools/a/lessons/', self.payload(rooms=[foreign_room.id]))
        self.assertEqual(res.status_code, 400)
        self.assertIn('rooms', res.data)

    def test_list_filters_by_group_and_weekday(self):
        make_lesson(self.school, self.term, self.room, self.periods[2], weekday=1, group_name='8-B')
        res = self.client.get('/api/schools/a/lessons/', {'group': self.lesson.groups.get().id})
        self.assertEqual(len(res.data), 1)
        res = self.client.get('/api/schools/a/lessons/', {'weekday': 1})
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['group_name'], '8-B')

    def test_room_day_endpoint(self):
        res = self.client.get(f'/api/schools/a/rooms/{self.room.id}/day/', {'date': '2025-10-20'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'lesson')
        self.assertEqual(res.data['entries'][0]['title'], 'Matematika')


class RoomTokenTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.admin = make_admin(self.school)
        self.room = make_room(self.school)
        self.client.force_authenticate(self.admin)

    def test_room_exposes_device_token_to_admin(self):
        res = self.client.get(f'/api/schools/a/rooms/{self.room.id}/')
        self.assertEqual(res.data['device_token'], self.room.device_token)

    def test_rotate_token_changes_it(self):
        old = self.room.device_token
        res = self.client.post(f'/api/schools/a/rooms/{self.room.id}/rotate-token/')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertNotEqual(self.room.device_token, old)
        self.assertEqual(res.data['device_token'], self.room.device_token)
        self.assertEqual(self.client.get(f'/api/tablet/{old}/').status_code, 404)


class HealthTests(APITestCase):
    def test_health_is_public(self):
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'status': 'ok'})


class LessonConflictMessageTests(APITestCase):
    """Band bo'lsa — qaysi maydon va kim bilan band ekanini aytish."""

    def setUp(self):
        self.school = make_school('a')
        self.client.force_authenticate(make_admin(self.school))
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school, '101')
        self.busy = make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0,
                                subject_name='Fizika', group_name='8-B', teacher_name='Karimov B.')
        self.other_room = make_room(self.school, '102')
        self.other_group = Group.objects.create(school=self.school, name='7-A')
        self.other_teacher = Teacher.objects.create(school=self.school, full_name='Aliyev A.')

    def post(self, **over):
        data = {'term': self.term.id, 'weekday': 0, 'period': self.periods[0].id, 'rooms': [self.other_room.id],
                'subjects': [self.busy.subjects.get().id], 'groups': [self.other_group.id],
                'teachers': [self.other_teacher.id]}
        data.update(over)
        return self.client.post('/api/schools/a/lessons/', data, format='json')

    def test_room_conflict_names_room_group_and_subject(self):
        res = self.post(rooms=[self.room.id])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['rooms'][0], 'Bu vaqtda 101-xona band (8-B · Fizika)')

    def test_teacher_conflict(self):
        res = self.post(teachers=[self.other_teacher.id, self.busy.teachers.get().id])
        self.assertEqual(res.data['teachers'][0], "Karimov B. bu vaqtda band (8-B · Fizika · 101-xona)")

    def test_group_conflict(self):
        res = self.post(groups=[self.busy.groups.get().id])
        self.assertEqual(res.data['groups'][0], "8-B guruhida bu vaqtda dars bor (Fizika · 101-xona)")

    def test_editing_lesson_does_not_conflict_with_itself(self):
        res = self.client.patch(f'/api/schools/a/lessons/{self.busy.id}/', {'subjects': [self.busy.subjects.get().id]},
                                format='json')
        self.assertEqual(res.status_code, 200, res.data)


class ExamConflictTests(APITestCase):
    def setUp(self):
        from datetime import date, time
        from api.models import Exam
        self.school = make_school('a')
        self.client.force_authenticate(make_admin(self.school))
        _, _, self.session = make_calendar(self.school)
        self.room = make_room(self.school, '101')
        self.subject = Subject.objects.create(school=self.school, name='Matematika')
        self.group = Group.objects.create(school=self.school, name='7-A')
        Exam.objects.create(school=self.school, exam_session=self.session, date=date(2025, 12, 15),
                            start_time=time(9, 0), end_time=time(11, 0), room=self.room,
                            subject=self.subject, group=self.group)
        self.other_group = Group.objects.create(school=self.school, name='8-B')
        self.other_room = make_room(self.school, '102')

    def post(self, **over):
        data = {'exam_session': self.session.id, 'date': '2025-12-15', 'start_time': '10:00', 'end_time': '12:00',
                'room': self.other_room.id, 'subject': self.subject.id, 'group': self.other_group.id}
        data.update(over)
        return self.client.post('/api/schools/a/exams/', data)

    def test_overlapping_exam_in_same_room_is_rejected(self):
        res = self.post(room=self.room.id)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['room'][0], 'Bu vaqtda 101-xona band (7-A · Matematika 09:00–11:00)')

    def test_group_cannot_sit_two_exams_at_once(self):
        res = self.post(group=self.group.id)
        self.assertEqual(res.status_code, 400)
        self.assertIn('group', res.data)

    def test_back_to_back_is_allowed(self):
        self.assertEqual(self.post(room=self.room.id, start_time='11:00', end_time='12:00').status_code, 201)


class TokenLoginWithAdminSessionTests(APITestCase):
    """Brauzerda Django admin seansi ochiq bo'lsa ham token bilan kirish ishlashi kerak."""

    def test_login_works_while_logged_into_django_admin(self):
        from rest_framework.test import APIClient
        school = make_school('a')
        make_admin(school, 'admin_a')
        client = APIClient(enforce_csrf_checks=True)
        client.login(username='admin_a', password='pass12345')  # /admin/ seansi
        res = client.post('/api/auth/token/', {'username': 'admin_a', 'password': 'pass12345'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('token', res.data)


class MultiValueLessonTests(APITestCase):
    """Bir katakda bir nechta fan/guruh/o'qituvchi/xona: "11-01 / 11-02 · Phy/Chem · 201, 203"."""

    def setUp(self):
        self.school = make_school('a')
        self.client.force_authenticate(make_admin(self.school))
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.r201, self.r203 = make_room(self.school, '201'), make_room(self.school, '203')
        self.phy = Subject.objects.create(school=self.school, name='Physics')
        self.chem = Subject.objects.create(school=self.school, name='Chemistry')
        self.g1 = Group.objects.create(school=self.school, name='11-01')
        self.g2 = Group.objects.create(school=self.school, name='11-02')
        self.t1 = Teacher.objects.create(school=self.school, full_name='Mr Xurshid')
        self.t2 = Teacher.objects.create(school=self.school, full_name='Mr Xamza')
        res = self.client.post('/api/schools/a/lessons/', {
            'term': self.term.id, 'weekday': 0, 'period': self.periods[0].id,
            'subjects': [self.phy.id, self.chem.id], 'groups': [self.g1.id, self.g2.id],
            'teachers': [self.t1.id, self.t2.id], 'rooms': [self.r201.id, self.r203.id],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.lesson = res.data

    def test_names_are_joined_with_slash(self):
        self.assertEqual(self.lesson['group_name'], '11-01 / 11-02')
        self.assertEqual(self.lesson['teacher_name'], 'Mr Xamza / Mr Xurshid')

    def test_block_shows_on_every_room_tablet(self):
        for room in (self.r201, self.r203):
            res = self.client.get(f'/api/tablet/{room.device_token}/', {'date': '2025-10-20'})
            entry = res.data['day']['entries'][0]
            self.assertEqual(entry['title'], 'Chemistry / Physics')
            self.assertEqual(entry['group'], '11-01 / 11-02')

    def test_filter_by_room_finds_block_once(self):
        res = self.client.get('/api/schools/a/lessons/', {'room': self.r203.id})
        self.assertEqual([l['id'] for l in res.data], [self.lesson['id']])

    def test_teacher_shared_with_other_block_conflicts(self):
        r101 = make_room(self.school, '101')
        res = self.client.post('/api/schools/a/lessons/', {
            'term': self.term.id, 'weekday': 0, 'period': self.periods[0].id, 'subjects': [self.phy.id],
            'groups': [Group.objects.create(school=self.school, name='9-01').id],
            'teachers': [self.t2.id], 'rooms': [r101.id],
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['teachers'][0], 'Mr Xamza bu vaqtda band (11-01 / 11-02 · Chemistry / Physics · 201 / 203-xona)')

    def test_empty_list_is_rejected(self):
        res = self.client.patch(f"/api/schools/a/lessons/{self.lesson['id']}/", {'teachers': []}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('teachers', res.data)

    def test_teacher_used_in_lesson_cannot_be_deleted(self):
        res = self.client.delete(f'/api/schools/a/teachers/{self.t1.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Teacher.objects.filter(pk=self.t1.pk).exists())

    def test_copy_keeps_all_values(self):
        term2 = Term.objects.create(school=self.school, academic_year=self.term.academic_year, name='2-chorak',
                                    start_date=self.term.end_date, end_date=self.term.end_date)
        self.client.post('/api/schools/a/lessons/copy/', {'from_term': self.term.id, 'to_term': term2.id})
        copy = Lesson.objects.get(term=term2)
        self.assertEqual(copy.room_names, '201 / 203')
        self.assertEqual(copy.teachers.count(), 2)


class QuoteTests(APITestCase):
    def setUp(self):
        self.school = make_school('a')
        self.client.force_authenticate(make_admin(self.school))
        self.room = make_room(self.school)

    def tablet_quote(self):
        return self.client.get(f'/api/tablet/{self.room.device_token}/').data['quote']

    def test_admin_adds_quote_and_tablet_shows_it(self):
        self.assertIsNone(self.tablet_quote())
        text = "Yoshlar bizning tayanchimiz, ertangi kundan umidimiz, ezgu ishlarimiz davomchisidir"
        res = self.client.post('/api/schools/a/quotes/', {'text': text, 'author': 'Sh. Mirziyoyev'})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.tablet_quote(), {'text': text, 'author': 'Sh. Mirziyoyev'})

    def test_inactive_quote_is_hidden(self):
        self.client.post('/api/schools/a/quotes/', {'text': 'X', 'is_active': False})
        self.assertIsNone(self.tablet_quote())

    def test_too_long_quote_is_rejected(self):
        res = self.client.post('/api/schools/a/quotes/', {'text': 'a' * 301})
        self.assertEqual(res.status_code, 400)

    def test_quote_rotates_every_minute(self):
        from datetime import datetime
        from api.models import Quote
        from api.services import quote_for
        for t in ('A', 'B', 'C'):
            Quote.objects.create(school=self.school, text=t)
        seen = [quote_for(self.school, datetime(2026, 10, 29, 9, m))['text'] for m in (0, 1, 2, 3)]
        self.assertEqual(set(seen[:3]), {'A', 'B', 'C'})
        self.assertEqual(seen[3], seen[0])  # aylanib qaytadi
        # bir daqiqa ichida o'zgarmaydi (planshet har 30 s so'raydi)
        self.assertEqual(quote_for(self.school, datetime(2026, 10, 29, 9, 1, 0))['text'],
                         quote_for(self.school, datetime(2026, 10, 29, 9, 1, 59))['text'])
