from django.contrib.auth import get_user_model
from django.core.exceptions import FieldDoesNotExist, ValidationError as DjangoValidationError
from rest_framework import serializers

from .images import ImageUploadField, delete_replaced
from .models import (
    AcademicYear,
    Break,
    Club,
    ClubSession,
    Exam,
    ExamSession,
    Group,
    Lesson,
    Period,
    Quote,
    Room,
    School,
    SchoolMembership,
    SchoolOwnedModel,
    Subject,
    Teacher,
    Term,
)


class SchoolScopedSerializer(serializers.ModelSerializer):
    """Maktabga tegishli model uchun asos.

    - `school` maydoni so'rovdan olinmaydi, view URL dagi maktabni qo'yadi.
    - Barcha FK maydonlar faqat shu maktab ob'ektlarini qabul qiladi,
      shunda bir maktab admini boshqa maktab xonasini jadvalga qo'ya olmaydi.
    - Modelning `clean()` tekshiruvlari 400 xato sifatida qaytadi.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        school = self.context.get('school')
        if school is None:
            return
        for field in self.fields.values():
            # many=True bo'lsa queryset ichki child_relation da
            field = getattr(field, 'child_relation', field)
            qs = getattr(field, 'queryset', None)
            if qs is not None and issubclass(qs.model, SchoolOwnedModel):
                field.queryset = qs.filter(school=school)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()
        for key, value in attrs.items():
            # M2M ni saqlanmagan ob'ektga qo'yib bo'lmaydi; clean() ga faqat oddiy maydonlar
            try:
                if instance._meta.get_field(key).many_to_many:
                    continue
            except FieldDoesNotExist:
                pass
            setattr(instance, key, value)
        instance.school = self.context['school']
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_as_drf_errors(exc))
        return attrs


def _as_drf_errors(exc):
    if hasattr(exc, 'error_dict'):
        return {k: [e.message for e in v] for k, v in exc.error_dict.items()}
    return {'non_field_errors': [e.message for e in exc.error_list]}


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['slug', 'name', 'timezone', 'working_days', 'primary_color']


class SchoolSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['slug', 'name', 'timezone', 'working_days', 'primary_color']
        read_only_fields = ['slug']

    def validate_working_days(self, value):
        try:
            days = sorted({int(d) for d in value.split(',') if d.strip()})
        except ValueError:
            days = None
        if not days or any(d < 0 or d > 6 for d in days):
            raise serializers.ValidationError("Hafta kunlari 0 (dushanba) dan 6 (yakshanba) gacha bo'lishi kerak.")
        return ','.join(str(d) for d in days)

    def validate_timezone(self, value):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError("Noma'lum vaqt zonasi.")
        return value


class MemberSerializer(serializers.ModelSerializer):
    """Maktab foydalanuvchisi. Yangi username bo'lsa — foydalanuvchi yaratiladi (parol shart)."""

    username = serializers.CharField(source='user.username')
    full_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = SchoolMembership
        fields = ['id', 'username', 'full_name', 'password', 'role']

    def validate(self, attrs):
        if self.instance is None:
            username = attrs['user']['username']
            User = get_user_model()
            user = User.objects.filter(username=username).first()
            if user is None and not attrs.get('password'):
                raise serializers.ValidationError({'password': 'Yangi foydalanuvchi uchun parol kerak.'})
            if user and SchoolMembership.objects.filter(user=user, school=self.context['school']).exists():
                raise serializers.ValidationError({'username': 'Bu foydalanuvchi allaqachon maktabda.'})
        return attrs

    def create(self, validated):
        User = get_user_model()
        user_data = validated.pop('user')
        password = validated.pop('password', None)
        user, created = User.objects.get_or_create(username=user_data['username'])
        if created:
            user.set_password(password)
        if user_data.get('first_name'):
            user.first_name = user_data['first_name']
        user.save()
        return SchoolMembership.objects.create(user=user, school=self.context['school'], role=validated['role'])

    def update(self, instance, validated):
        user_data = validated.pop('user', {})
        if 'first_name' in user_data:
            instance.user.first_name = user_data['first_name']
        if validated.get('password'):
            instance.user.set_password(validated['password'])
        instance.user.save()
        instance.role = validated.get('role', instance.role)
        instance.save()
        return instance


class SubjectSerializer(SchoolScopedSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'short_name', 'color']


class TeacherSerializer(SchoolScopedSerializer):
    class Meta:
        model = Teacher
        fields = ['id', 'full_name', 'phone', 'email']


class RoomSerializer(SchoolScopedSerializer):
    tablet_status = serializers.CharField(read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'floor', 'capacity', 'device_token', 'last_seen_at', 'tablet_status']
        read_only_fields = ['device_token', 'last_seen_at', 'tablet_status']


class ImageModelSerializer(SchoolScopedSerializer):
    """`image` maydoni bor model: almashtirilsa/olib tashlansa eski fayl o'chiriladi."""

    image = ImageUploadField()

    def __init__(self, instance=None, *args, **kwargs):
        super().__init__(instance, *args, **kwargs)
        # validate() yangi qiymatni ob'ektga oldinroq qo'yadi — eski nomni hozir eslab qolamiz
        self._old_image = instance.image.name if isinstance(instance, self.Meta.model) else ''

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if 'image' in validated_data:
            delete_replaced(instance, 'image', self._old_image)
        return instance


class GroupSerializer(ImageModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'image']


class PeriodSerializer(SchoolScopedSerializer):
    class Meta:
        model = Period
        fields = ['id', 'order', 'name', 'kind', 'start_time', 'end_time']


class AcademicYearSerializer(SchoolScopedSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date']


class TermSerializer(SchoolScopedSerializer):
    class Meta:
        model = Term
        fields = ['id', 'academic_year', 'name', 'start_date', 'end_date']


class BreakSerializer(SchoolScopedSerializer):
    class Meta:
        model = Break
        fields = ['id', 'name', 'start_date', 'end_date']


class ExamSessionSerializer(SchoolScopedSerializer):
    class Meta:
        model = ExamSession
        fields = ['id', 'name', 'kind', 'start_date', 'end_date']


class LessonSerializer(SchoolScopedSerializer):
    M2M = ('subjects', 'groups', 'teachers', 'rooms')

    subjects = serializers.PrimaryKeyRelatedField(many=True, allow_empty=False, queryset=Subject.objects.all())
    groups = serializers.PrimaryKeyRelatedField(many=True, allow_empty=False, queryset=Group.objects.all())
    teachers = serializers.PrimaryKeyRelatedField(many=True, allow_empty=False, queryset=Teacher.objects.all())
    rooms = serializers.PrimaryKeyRelatedField(many=True, allow_empty=False, queryset=Room.objects.all())
    # Ko'rsatish uchun birlashtirilgan nomlar: "Ms Shela / Davron"
    subject_name = serializers.CharField(source='subject_names', read_only=True)
    group_name = serializers.CharField(source='group_names', read_only=True)
    teacher_name = serializers.CharField(source='teacher_names', read_only=True)
    room_name = serializers.CharField(source='room_names', read_only=True)
    start_time = serializers.TimeField(source='period.start_time', read_only=True, format='%H:%M')
    end_time = serializers.TimeField(source='period.end_time', read_only=True, format='%H:%M')

    class Meta:
        model = Lesson
        fields = [
            'id', 'term', 'weekday', 'period', 'subjects', 'groups', 'teachers', 'rooms',
            'subject_name', 'group_name', 'teacher_name', 'room_name', 'start_time', 'end_time',
        ]

    def validate(self, attrs):
        # M2M ni saqlanmagan ob'ektga qo'yib bo'lmaydi — clean() ga faqat oddiy maydonlar.
        many = {k: attrs.pop(k) for k in self.M2M if k in attrs}
        attrs = super().validate(attrs)
        attrs.update(many)
        current = self.instance
        get = lambda k: attrs[k] if k in attrs else (getattr(current, k) if current else None)
        values = {k: attrs[k] if k in attrs else list(getattr(current, k).all()) for k in self.M2M}
        errors = Lesson.conflicts(
            get('term'), get('weekday'), get('period'), values['rooms'], values['teachers'], values['groups'],
            exclude_pk=current.pk if current else None,
        )
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class QuoteSerializer(ImageModelSerializer):
    # Form-data da yuborilmagan checkbox DRF uchun False — yangi so'z sukut bo'yicha faol bo'lsin
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = Quote
        fields = ['id', 'text', 'author', 'image', 'groups', 'is_active']


class ClubSerializer(SchoolScopedSerializer):
    leader_name = serializers.CharField(source='leader.full_name', read_only=True, default=None)

    class Meta:
        model = Club
        fields = ['id', 'name', 'description', 'leader', 'leader_name', 'color', 'is_active']


class ClubSessionSerializer(SchoolScopedSerializer):
    club_name = serializers.CharField(source='club.name', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)

    class Meta:
        model = ClubSession
        fields = [
            'id', 'club', 'academic_year', 'weekday', 'start_time', 'end_time', 'room',
            'club_name', 'room_name',
        ]


class ExamSerializer(SchoolScopedSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    invigilator_name = serializers.CharField(source='invigilator.full_name', read_only=True, default=None)

    class Meta:
        model = Exam
        fields = [
            'id', 'exam_session', 'date', 'start_time', 'end_time', 'room', 'subject', 'group',
            'invigilator', 'subject_name', 'group_name', 'room_name', 'invigilator_name',
        ]
