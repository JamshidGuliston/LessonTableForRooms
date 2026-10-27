from datetime import date, timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from api.models import Club, Room, School
from api.services import room_day


class SeedDemoTests(TestCase):
    def run_seed(self):
        out = StringIO()
        call_command('seed_demo', stdout=out)
        return out.getvalue()

    def test_can_be_run_twice(self):
        self.run_seed()
        self.run_seed()
        self.assertEqual(School.objects.filter(slug='demo-maktab').count(), 1)

    def test_creates_clubs_after_lessons(self):
        self.run_seed()
        self.assertGreater(Club.objects.count(), 0)
        room = Room.objects.get(school__slug='demo-maktab', name='101')
        # Bugundan boshlab birinchi o'quv dushanbasi (ta'til haftasi tushib qolishi mumkin)
        today = date.today()
        monday = today + timedelta(days=(7 - today.weekday()) % 7)
        result = next(
            r for r in (room_day(room, monday + timedelta(days=7 * i)) for i in range(8))
            if r['status'] == 'lesson'
        )
        kinds = [e['kind'] for e in result['entries']]
        self.assertIn('club', kinds)
        self.assertEqual(kinds[-1], 'club')
