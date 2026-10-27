"""Lesson: bitta fan/guruh/o'qituvchi/xona o'rniga — ko'p qiymatli bloklar.

Eski FK qiymatlari yangi M2M ga ko'chiriladi, keyin FK va unique cheklovlar o'chiriladi.
"""
from django.db import migrations, models

FIELDS = ('subject', 'group', 'teacher', 'room')


def copy_fk_to_m2m(apps, schema_editor):
    Lesson = apps.get_model('api', 'Lesson')
    for lesson in Lesson.objects.all():
        for f in FIELDS:
            getattr(lesson, f'{f}s').set([getattr(lesson, f'{f}_id')])


def copy_m2m_to_fk(apps, schema_editor):
    Lesson = apps.get_model('api', 'Lesson')
    for lesson in Lesson.objects.all():
        for f in FIELDS:
            first = getattr(lesson, f'{f}s').order_by('pk').first()
            setattr(lesson, f'{f}_id', first.pk if first else None)
        lesson.save()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_tablet_pairing'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='lesson', name='lesson_room_busy'),
        migrations.RemoveConstraint(model_name='lesson', name='lesson_teacher_busy'),
        migrations.RemoveConstraint(model_name='lesson', name='lesson_group_busy'),
        # related_name 'lessons' yangi M2M ga kerak — eski FK larni vaqtincha '+' qilamiz
        migrations.AlterField(model_name='lesson', name='subject',
                              field=models.ForeignKey(null=True, on_delete=models.PROTECT, related_name='+', to='api.subject')),
        migrations.AlterField(model_name='lesson', name='group',
                              field=models.ForeignKey(null=True, on_delete=models.CASCADE, related_name='+', to='api.group')),
        migrations.AlterField(model_name='lesson', name='teacher',
                              field=models.ForeignKey(null=True, on_delete=models.PROTECT, related_name='+', to='api.teacher')),
        migrations.AlterField(model_name='lesson', name='room',
                              field=models.ForeignKey(null=True, on_delete=models.PROTECT, related_name='+', to='api.room')),
        migrations.AddField(model_name='lesson', name='subjects',
                            field=models.ManyToManyField(related_name='lessons', to='api.subject')),
        migrations.AddField(model_name='lesson', name='groups',
                            field=models.ManyToManyField(related_name='lessons', to='api.group')),
        migrations.AddField(model_name='lesson', name='teachers',
                            field=models.ManyToManyField(related_name='lessons', to='api.teacher')),
        migrations.AddField(model_name='lesson', name='rooms',
                            field=models.ManyToManyField(related_name='lessons', to='api.room')),
        migrations.RunPython(copy_fk_to_m2m, copy_m2m_to_fk),
        migrations.RemoveField(model_name='lesson', name='subject'),
        migrations.RemoveField(model_name='lesson', name='group'),
        migrations.RemoveField(model_name='lesson', name='teacher'),
        migrations.RemoveField(model_name='lesson', name='room'),
    ]
