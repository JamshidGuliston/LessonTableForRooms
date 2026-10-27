import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

WEEKDAYS = [
    (0, 'Dushanba'),
    (1, 'Seshanba'),
    (2, 'Chorshanba'),
    (3, 'Payshanba'),
    (4, 'Juma'),
    (5, 'Shanba'),
    (6, 'Yakshanba'),
]


class School(models.Model):
    """Tenant: har bir maktab o'z ma'lumotlariga ega, boshqasini ko'rmaydi."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    timezone = models.CharField(max_length=64, default='Asia/Tashkent')
    # Dars bo'ladigan hafta kunlari, 0 = dushanba. Masalan "0,1,2,3,4,5".
    working_days = models.CharField(max_length=20, default='0,1,2,3,4,5')
    # Maktab brendi: admin panel va planshetdagi asosiy rang
    primary_color = models.CharField(
        max_length=7, default='#2563EB',
        validators=[RegexValidator(r'^#[0-9A-Fa-f]{6}$', "Rang #RRGGBB ko'rinishida bo'lishi kerak.")],
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    @property
    def working_weekdays(self):
        return {int(d) for d in self.working_days.split(',') if d.strip() != ''}


class SchoolMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Maktab admini'
        STAFF = 'staff', 'Xodim (faqat ko\'rish)'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)

    class Meta:
        unique_together = [('user', 'school')]

    def __str__(self):
        return f'{self.user} @ {self.school} ({self.role})'


class SchoolOwnedModel(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='%(class)ss')

    class Meta:
        abstract = True


class Subject(SchoolOwnedModel):
    name = models.CharField(max_length=100)
    short_name = models.CharField(max_length=20, blank=True)
    color = models.CharField(max_length=7, blank=True, help_text='#RRGGBB')

    class Meta:
        unique_together = [('school', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name


class Teacher(SchoolOwnedModel):
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)

    class Meta:
        ordering = ['full_name']

    def __str__(self):
        return self.full_name


class Room(SchoolOwnedModel):
    name = models.CharField(max_length=50)
    floor = models.CharField(max_length=20, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    # Xona eshigidagi planshet shu token bilan loginsiz jadvalni oladi.
    device_token = models.CharField(max_length=64, unique=True, editable=False)
    # Planshet oxirgi marta jadval so'ragan vaqt (onlayn/oflayn holati uchun)
    last_seen_at = models.DateTimeField(null=True, blank=True, editable=False)

    # Planshet har 30 s so'raydi; 5 daqiqa jim bo'lsa — oflayn.
    ONLINE_WINDOW = timedelta(minutes=5)

    class Meta:
        unique_together = [('school', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.device_token:
            self.rotate_token(save=False)
        super().save(*args, **kwargs)

    @property
    def tablet_status(self):
        if self.last_seen_at is None:
            return 'unpaired'
        return 'online' if timezone.now() - self.last_seen_at < self.ONLINE_WINDOW else 'offline'

    def rotate_token(self, save=True):
        self.device_token = secrets.token_urlsafe(32)
        if save:
            self.save(update_fields=['device_token'])


class Group(SchoolOwnedModel):
    """Sinf / guruh, masalan 7-A."""

    name = models.CharField(max_length=50)

    class Meta:
        unique_together = [('school', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name


class Period(SchoolOwnedModel):
    """Qo'ng'iroq jadvali: dars vaqtlari, tanaffus, tushlik."""

    class Kind(models.TextChoices):
        LESSON = 'lesson', 'Dars'
        COFFEE_BREAK = 'coffee_break', 'Tanaffus'
        LUNCH = 'lunch', 'Tushlik'

    order = models.PositiveIntegerField()
    name = models.CharField(max_length=50)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.LESSON)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        unique_together = [('school', 'order')]
        ordering = ['start_time']

    def __str__(self):
        return f'{self.name} {self.start_time:%H:%M}-{self.end_time:%H:%M}'

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo\'lishi kerak.')


class DateRangeModel(SchoolOwnedModel):
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        abstract = True
        ordering = ['start_date']

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date > self.end_date:
            raise ValidationError('Boshlanish sanasi tugash sanasidan keyin bo\'lmasligi kerak.')

    def covers(self, day):
        return self.start_date <= day <= self.end_date

    @classmethod
    def on(cls, school, day):
        return cls.objects.filter(school=school, start_date__lte=day, end_date__gte=day).first()


class AcademicYear(DateRangeModel):
    class Meta(DateRangeModel.Meta):
        pass


class Term(DateRangeModel):
    """Chorak / semestr — darslar faqat shu oraliqda bo'ladi."""

    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='terms')

    class Meta(DateRangeModel.Meta):
        pass


class Break(DateRangeModel):
    """Ta'til: 1 hafta yoki 2 oy — bu kunlarda dars yo'q."""

    class Meta(DateRangeModel.Meta):
        pass


class ExamSession(DateRangeModel):
    """Imtihon davri: darslar to'xtatiladi, xonalarda imtihonlar ko'rsatiladi."""

    class Kind(models.TextChoices):
        MIDTERM = 'midterm', 'Semestr imtihoni'
        FINAL = 'final', 'Yillik imtihon'

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.MIDTERM)

    class Meta(DateRangeModel.Meta):
        pass


class Lesson(SchoolOwnedModel):
    """Haftalik jadvaldagi bitta dars: chorak + hafta kuni + vaqt + xona."""

    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='lessons')
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAYS)
    period = models.ForeignKey(Period, on_delete=models.PROTECT, related_name='lessons')
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='lessons')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name='lessons')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='lessons')
    teacher = models.ForeignKey(Teacher, on_delete=models.PROTECT, related_name='lessons')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['term', 'weekday', 'period', 'room'], name='lesson_room_busy'),
            models.UniqueConstraint(fields=['term', 'weekday', 'period', 'teacher'], name='lesson_teacher_busy'),
            models.UniqueConstraint(fields=['term', 'weekday', 'period', 'group'], name='lesson_group_busy'),
        ]

    def __str__(self):
        return f'{self.get_weekday_display()} {self.period} {self.subject} ({self.group})'

    def clean(self):
        if self.period_id and self.period.kind != Period.Kind.LESSON:
            raise ValidationError({'period': 'Dars faqat dars vaqtiga qo\'yiladi, tanaffusga emas.'})
        if not (self.term_id and self.period_id and self.weekday is not None):
            return
        # DB cheklovlari baribir himoya qiladi; bu yerda admin uchun aniq xabar beramiz.
        same_slot = (
            Lesson.objects.filter(term_id=self.term_id, weekday=self.weekday, period_id=self.period_id)
            .exclude(pk=self.pk)
            .select_related('subject', 'group', 'room', 'teacher')
        )
        errors = {}
        for other in same_slot:
            if other.room_id == self.room_id:
                errors.setdefault('room', f'Bu vaqtda {other.room}-xona band ({other.group} · {other.subject})')
            if other.teacher_id == self.teacher_id:
                errors.setdefault(
                    'teacher', f'{other.teacher} bu vaqtda band ({other.group} · {other.subject} · {other.room}-xona)'
                )
            if other.group_id == self.group_id:
                errors.setdefault('group', f'{other.group} guruhida bu vaqtda dars bor ({other.subject} · {other.room}-xona)')
        if errors:
            raise ValidationError(errors)


class Exam(SchoolOwnedModel):
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='exams')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='exams')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name='exams')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='exams')
    # Nazoratchi o'qituvchi (ixtiyoriy)
    invigilator = models.ForeignKey(
        Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='exams'
    )

    class Meta:
        ordering = ['date', 'start_time']

    def __str__(self):
        return f'{self.date} {self.start_time:%H:%M} {self.subject} ({self.group})'

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo\'lishi kerak.')
        if self.exam_session_id and not self.exam_session.covers(self.date):
            raise ValidationError({'date': 'Imtihon sanasi imtihon davri ichida bo\'lishi kerak.'})
        overlapping = (
            Exam.objects.filter(school_id=self.school_id, date=self.date,
                                start_time__lt=self.end_time, end_time__gt=self.start_time)
            .exclude(pk=self.pk)
            .select_related('room', 'group', 'subject')
        )
        errors = {}
        for other in overlapping:
            when = f'{other.start_time:%H:%M}–{other.end_time:%H:%M}'
            if other.room_id == self.room_id:
                errors.setdefault('room', f'Bu vaqtda {other.room}-xona band ({other.group} · {other.subject} {when})')
            if other.group_id == self.group_id:
                errors.setdefault('group', f'{other.group} guruhida bu vaqtda imtihon bor ({other.subject} {when})')
        if errors:
            raise ValidationError(errors)


class Club(SchoolOwnedModel):
    """To'garak: shaxmat, robototexnika va h.k. Odatda darslardan keyin."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    leader = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='clubs')
    color = models.CharField(max_length=7, blank=True, help_text='#RRGGBB')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('school', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name


class ClubSession(SchoolOwnedModel):
    """To'garakning haftalik mashg'uloti. Qo'ng'iroq jadvaliga bog'lanmaydi —
    o'z vaqti bor; o'quv yili davomida har hafta takrorlanadi."""

    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='sessions')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='club_sessions')
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='club_sessions')

    class Meta:
        ordering = ['weekday', 'start_time']

    def __str__(self):
        return f'{self.club} {self.get_weekday_display()} {self.start_time:%H:%M}-{self.end_time:%H:%M}'

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo\'lishi kerak.')
        if not (self.room_id and self.academic_year_id):
            return
        busy = self._room_conflict()
        if busy:
            raise ValidationError({'room': f'Bu vaqtda xona band: {busy}'})

    def _room_conflict(self):
        """Shu xonada, shu hafta kunida vaqti kesishadigan dars yoki to'garak."""
        lesson = (
            Lesson.objects.filter(
                room_id=self.room_id, weekday=self.weekday, term__academic_year_id=self.academic_year_id,
                period__start_time__lt=self.end_time, period__end_time__gt=self.start_time,
            )
            .select_related('subject', 'group', 'period')
            .first()
        )
        if lesson:
            return f'{lesson.subject} ({lesson.group}) {lesson.period.start_time:%H:%M}-{lesson.period.end_time:%H:%M}'
        other = (
            ClubSession.objects.filter(
                room_id=self.room_id, weekday=self.weekday, academic_year_id=self.academic_year_id,
                start_time__lt=self.end_time, end_time__gt=self.start_time,
            )
            .exclude(pk=self.pk)
            .select_related('club')
            .first()
        )
        if other:
            return f'{other.club} {other.start_time:%H:%M}-{other.end_time:%H:%M}'
        return None
