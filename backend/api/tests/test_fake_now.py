import os
from datetime import datetime
from unittest import mock

from django.test import TestCase, override_settings

from api.services import school_now

from .factories import make_school


class FakeNowTests(TestCase):
    def setUp(self):
        self.school = make_school()

    @override_settings(DEBUG=True)
    def test_debug_uses_fake_now_from_env(self):
        with mock.patch.dict(os.environ, {'DARSJADVAL_FAKE_NOW': '2026-10-22T10:42'}):
            self.assertEqual(school_now(self.school), datetime(2026, 10, 22, 10, 42))

    @override_settings(DEBUG=False)
    def test_production_ignores_fake_now(self):
        with mock.patch.dict(os.environ, {'DARSJADVAL_FAKE_NOW': '2000-01-01T00:00'}):
            self.assertNotEqual(school_now(self.school).year, 2000)
