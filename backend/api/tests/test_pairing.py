from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import SchoolMembership, TabletPairing

from .factories import make_admin, make_room, make_school

User = get_user_model()


class TabletPairingTests(APITestCase):
    """Planshet kompyutersiz ulanadi: ekrandagi kod → admin panel → planshet tokenni oladi."""

    def setUp(self):
        self.school = make_school('a')
        self.room = make_room(self.school, '104')
        self.admin = make_admin(self.school)

    def start(self):
        res = self.client.post('/api/tablet/pair/')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def pair(self, code, room=None, user=None):
        self.client.force_authenticate(user or self.admin)
        res = self.client.post(f'/api/schools/a/rooms/{(room or self.room).id}/pair/', {'code': code})
        self.client.force_authenticate(None)
        return res

    def status(self, secret):
        return self.client.get(f'/api/tablet/pair/{secret}/')

    def test_full_flow(self):
        p = self.start()
        self.assertRegex(p['code'], r'^\d{6}$')
        self.assertEqual(self.status(p['secret']).data['status'], 'pending')

        res = self.pair(p['code'])
        self.assertEqual(res.status_code, 200, res.data)

        res = self.status(p['secret'])
        self.assertEqual(res.data['status'], 'paired')
        self.assertEqual(res.data['token'], self.room.device_token)
        self.assertEqual(res.data['room']['name'], '104')
        self.assertEqual(self.client.get(f"/api/tablet/{res.data['token']}/").status_code, 200)

    def test_code_with_spaces_is_accepted(self):
        p = self.start()
        self.assertEqual(self.pair(f"{p['code'][:3]} {p['code'][3:]}").status_code, 200)

    def test_pending_status_does_not_leak_token(self):
        p = self.start()
        self.assertNotIn('token', self.status(p['secret']).data)

    def test_wrong_code_is_400(self):
        code = self.start()['code']
        res = self.pair('000000' if code != '000000' else '111111')
        self.assertEqual(res.status_code, 400)
        self.assertIn('code', res.data)

    def test_code_cannot_be_used_twice(self):
        p = self.start()
        self.assertEqual(self.pair(p['code']).status_code, 200)
        other = make_room(self.school, '105')
        self.assertEqual(self.pair(p['code'], room=other).status_code, 400)

    def test_expired_code_is_rejected_and_status_404(self):
        p = self.start()
        TabletPairing.objects.update(created_at=timezone.now() - TabletPairing.TTL - timedelta(seconds=1))
        self.assertEqual(self.pair(p['code']).status_code, 400)
        self.assertEqual(self.status(p['secret']).status_code, 404)

    def test_unknown_secret_is_404(self):
        self.assertEqual(self.status('yoq').status_code, 404)

    def test_staff_cannot_pair(self):
        staff = User.objects.create_user(username='staff', password='x')
        SchoolMembership.objects.create(user=staff, school=self.school, role=SchoolMembership.Role.STAFF)
        p = self.start()
        self.assertEqual(self.pair(p['code'], user=staff).status_code, 403)

    def test_other_school_admin_cannot_pair_into_this_school(self):
        other_admin = make_admin(make_school('b'), 'admin_b')
        p = self.start()
        self.assertEqual(self.pair(p['code'], user=other_admin).status_code, 403)

    def test_pending_limit(self):
        TabletPairing.MAX_PENDING, old = 2, TabletPairing.MAX_PENDING
        try:
            self.start()
            self.start()
            self.assertEqual(self.client.post('/api/tablet/pair/').status_code, 503)
        finally:
            TabletPairing.MAX_PENDING = old
