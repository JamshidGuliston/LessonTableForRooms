import os
import shutil
import tempfile
from datetime import date, datetime
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from api.models import Group, Quote
from api.services import quote_for, room_day

from .factories import make_admin, make_calendar, make_lesson, make_periods, make_room, make_school

MONDAY = date(2025, 10, 20)


def png(size=(1600, 1200), name='Al-Farg\'oniy rasmi.PNG', color=(200, 120, 40)):
    out = BytesIO()
    Image.new('RGB', size, color).save(out, 'PNG')
    return SimpleUploadedFile(name, out.getvalue(), content_type='image/png')


class MediaTestCase(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.school = make_school('a')
        self.client.force_authenticate(make_admin(self.school))

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)


class GroupImageTests(MediaTestCase):
    def test_upload_shrinks_and_renames(self):
        group = Group.objects.create(school=self.school, name='8-02 Ahmad al-Farg\'oniy')
        res = self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': png()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertRegex(res.data['image'], r'^/media/groups/[0-9a-f]{32}\.jpg$')
        group.refresh_from_db()
        with Image.open(group.image.path) as img:
            self.assertEqual(max(img.size), 800)

    def test_not_an_image_is_rejected(self):
        group = Group.objects.create(school=self.school, name='7-A')
        bad = SimpleUploadedFile('x.png', b'not an image', content_type='image/png')
        res = self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': bad}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('image', res.data)

    def test_replacing_and_clearing_deletes_old_file(self):
        group = Group.objects.create(school=self.school, name='7-A')
        self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': png()}, format='multipart')
        group.refresh_from_db()
        first = group.image.path
        self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': png(color=(0, 0, 0))}, format='multipart')
        group.refresh_from_db()
        self.assertNotEqual(group.image.path, first)
        self.assertFalse(os.path.exists(first))

        second = group.image.path
        res = self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': None}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.data['image'])
        self.assertFalse(os.path.exists(second))

    def test_editing_name_keeps_image(self):
        group = Group.objects.create(school=self.school, name='7-A')
        self.client.patch(f'/api/schools/a/groups/{group.id}/', {'image': png()}, format='multipart')
        res = self.client.patch(f'/api/schools/a/groups/{group.id}/', {'name': '7-A Beruniy'}, format='json')
        self.assertIsNotNone(res.data['image'])


class TabletImageAndQuoteTests(MediaTestCase):
    """Dars paytida: guruh (alloma) rasmi va shu guruhga bog'langan iqtiboslar; tanaffusda — umumiylari."""

    def setUp(self):
        super().setUp()
        _, self.term, _ = make_calendar(self.school)
        self.periods = make_periods(self.school)
        self.room = make_room(self.school, '101')
        lesson = make_lesson(self.school, self.term, self.room, self.periods[0], weekday=0,
                             group_name="8-02 Ahmad al-Farg'oniy")
        self.group = lesson.groups.get()
        self.group.image.save('fargoniy.jpg', png(), save=True)
        self.other = Group.objects.create(school=self.school, name='7-01 Ibn Sino')

        self.linked = Quote.objects.create(school=self.school, text="Ilm — nur", author="Al-Farg'oniy")
        self.linked.groups.set([self.group])
        Quote.objects.create(school=self.school, text='Boshqa guruhniki').groups.set([self.other])
        self.general = Quote.objects.create(school=self.school, text='Umumiy', author='Navoiy')

    def at(self, h, m):
        return datetime(2025, 10, 20, h, m)

    def test_lesson_entry_carries_group_image(self):
        day = room_day(self.room, MONDAY, now=self.at(8, 40))
        self.assertEqual(day['current']['image'], self.group.image.url)
        self.assertEqual(day['current']['group_ids'], [self.group.id])

    def test_during_lesson_only_group_quotes(self):
        texts = {quote_for(self.school, self.at(8, m), [self.group.id])['text'] for m in range(30, 45)}
        self.assertEqual(texts, {'Ilm — nur'})

    def test_quote_has_no_image(self):
        # Hikmatli so'z oldida rasm ko'rsatilmaydi — rasm faqat dars kartochkasida
        self.assertEqual(set(quote_for(self.school, self.at(8, 40), [self.group.id])), {'text', 'author'})

    def test_during_break_only_general_quotes(self):
        texts = {quote_for(self.school, self.at(9, m), [])['text'] for m in range(15, 30)}
        self.assertEqual(texts, {'Umumiy'})

    def test_group_without_quotes_falls_back_to_general(self):
        lonely = Group.objects.create(school=self.school, name='9-A')
        self.assertEqual(quote_for(self.school, self.at(8, 40), [lonely.id])['text'], 'Umumiy')

    def test_tablet_endpoint_picks_quote_by_current_lesson(self):
        from unittest import mock
        with mock.patch('api.views.school_now', return_value=self.at(8, 40)):
            data = self.client.get(f'/api/tablet/{self.room.device_token}/').data
        self.assertEqual(data['day']['current']['image'], self.group.image.url)
        self.assertEqual(data['quote']['text'], 'Ilm — nur')

    def test_admin_links_quote_to_groups(self):
        res = self.client.post('/api/schools/a/quotes/', {'text': 'Yangi', 'groups': [self.group.id, self.other.id]},
                               format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(sorted(res.data['groups']), sorted([self.group.id, self.other.id]))

    def test_cannot_link_other_school_group(self):
        foreign = Group.objects.create(school=make_school('b'), name='X')
        res = self.client.post('/api/schools/a/quotes/', {'text': 'Yangi', 'groups': [foreign.id]}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('groups', res.data)
