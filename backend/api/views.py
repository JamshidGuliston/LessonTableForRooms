from datetime import date, timedelta

from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.functional import cached_property
from rest_framework import serializers, status, viewsets
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import serializers as ser
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
    Room,
    School,
    SchoolMembership,
    Subject,
    Teacher,
    Term,
)
from .permissions import IsSchoolMember
from .services import day_info, room_day, school_now


def _parse_date(value, default):
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise serializers.ValidationError({'date': 'Sana YYYY-MM-DD ko\'rinishida bo\'lishi kerak.'})


class TokenLoginView(ObtainAuthToken):
    """Login → token. Seans cookie'si e'tiborga olinmaydi: brauzerda /admin/ ochiq bo'lsa
    SessionAuthentication CSRF talab qilib, 403 qaytarardi."""

    authentication_classes = []


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    if user.is_superuser:
        schools = [
            {'slug': s.slug, 'name': s.name, 'role': 'admin', 'primary_color': s.primary_color}
            for s in School.objects.filter(is_active=True)
        ]
    else:
        schools = [
            {'slug': m.school.slug, 'name': m.school.name, 'role': m.role,
             'primary_color': m.school.primary_color}
            for m in SchoolMembership.objects.filter(user=user, school__is_active=True).select_related('school')
        ]
    return Response({'username': user.username, 'schools': schools})


class TabletView(APIView):
    """Xona planshetining yagona endpointi: loginsiz, xona tokeni bilan.

    GET /api/tablet/<token>/?date=YYYY-MM-DD   (date bo'lmasa — bugun)
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        room = get_object_or_404(Room.objects.select_related('school'), device_token=token, school__is_active=True)
        Room.objects.filter(pk=room.pk).update(last_seen_at=timezone.now())
        now = school_now(room.school)
        day = _parse_date(request.query_params.get('date'), now.date())
        return Response({
            'school': ser.SchoolSerializer(room.school).data,
            'room': {'id': room.id, 'name': room.name, 'floor': room.floor},
            'now': now.isoformat(timespec='seconds'),
            'day': room_day(room, day, now=now),
        })


class SchoolMixin:
    """URL dagi `school_slug` bo'yicha maktab; IsSchoolMember shu orqali tekshiradi."""

    permission_classes = [IsSchoolMember]

    @cached_property
    def school(self):
        return get_object_or_404(School, slug=self.kwargs['school_slug'], is_active=True)

    def get_school(self):
        return self.school


BREAK_KINDS = ('coffee_break', 'lunch')


class DashboardView(SchoolMixin, APIView):
    """Boshqaruv paneli: statistika, xonalar hozir, ogohlantirishlar."""

    BREAK_ALERT_DAYS = 14

    def get(self, request, school_slug):
        school = self.school
        now = school_now(school)
        today = now.date()
        info = day_info(school, today)
        rooms = list(Room.objects.filter(school=school).order_by('name'))

        rooms_now = []
        for room in rooms:
            room.school = school
            day = room_day(room, today, now=now, info=info)
            rooms_now.append({
                'id': room.id,
                'name': room.name,
                'current': day['current'],
                # Panelda "keyingi" — tanaffus emas, keyingi mashg'ulot
                'next': next((e for e in day['entries']
                              if e['status'] == 'upcoming' and e['kind'] not in BREAK_KINDS), None),
                'tablet_status': room.tablet_status,
                'last_seen_at': room.last_seen_at,
            })

        lessons_today = 0
        if info['term']:
            lessons_today = Lesson.objects.filter(term=info['term'], weekday=today.weekday()).count()

        alerts = []
        offline = sum(1 for r in rooms if r.tablet_status == 'offline')
        if offline:
            alerts.append({'kind': 'tablets_offline', 'count': offline})
        upcoming = (
            Break.objects.filter(school=school, start_date__gt=today,
                                 start_date__lte=today + timedelta(days=self.BREAK_ALERT_DAYS))
            .order_by('start_date').first()
        )
        if upcoming:
            alerts.append({'kind': 'break_soon', 'title': upcoming.name, 'days': (upcoming.start_date - today).days})

        term = Term.on(school, today)
        return Response({
            'now': now.isoformat(timespec='seconds'),
            'day_status': info['status'],
            'day_title': info['title'],
            'term': term.name if term else None,
            'stats': {
                'rooms': len(rooms),
                'teachers': Teacher.objects.filter(school=school).count(),
                'groups': Group.objects.filter(school=school).count(),
                'lessons_today': lessons_today,
            },
            'rooms': rooms_now,
            'alerts': alerts,
        })


class SchoolSettingsView(SchoolMixin, APIView):
    def get(self, request, school_slug):
        return Response(ser.SchoolSettingsSerializer(self.school).data)

    def patch(self, request, school_slug):
        serializer = ser.SchoolSettingsSerializer(self.school, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MemberViewSet(SchoolMixin, viewsets.ModelViewSet):
    serializer_class = ser.MemberSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        return SchoolMembership.objects.filter(school=self.school).select_related('user').order_by('user__username')

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'school': self.school}

    def destroy(self, request, *args, **kwargs):
        if self.get_object().user_id == request.user.id:
            raise serializers.ValidationError("O'zingizni maktabdan olib tashlay olmaysiz.")
        return super().destroy(request, *args, **kwargs)


class SchoolScopedViewSet(viewsets.ModelViewSet):
    """URL dagi maktab bo'yicha hamma narsani cheklaydi.

    `filter_params` — ro'yxatni `?field=value` bilan filtrlash uchun ruxsat etilgan maydonlar.
    """

    permission_classes = [IsSchoolMember]
    filter_params = ()

    @cached_property
    def school(self):
        return get_object_or_404(School, slug=self.kwargs['school_slug'], is_active=True)

    def get_school(self):
        return self.school

    def get_queryset(self):
        qs = super().get_queryset().filter(school=self.school)
        for name in self.filter_params:
            value = self.request.query_params.get(name)
            if value not in (None, ''):
                qs = qs.filter(**{name: value})
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'school': self.school}

    def perform_create(self, serializer):
        serializer.save(school=self.school)

    def perform_destroy(self, instance):
        # Jadvalda ishlatilayotgan xona/fan/o'qituvchi PROTECT bilan himoyalangan — 500 emas, 400.
        try:
            instance.delete()
        except ProtectedError as exc:
            used_in = sorted({obj._meta.verbose_name for obj in exc.protected_objects})
            raise serializers.ValidationError(
                f'"{instance}" jadvalda ishlatilmoqda ({", ".join(used_in)}). Avval u yerdan olib tashlang.'
            )


class SubjectViewSet(SchoolScopedViewSet):
    queryset = Subject.objects.all()
    serializer_class = ser.SubjectSerializer


class TeacherViewSet(SchoolScopedViewSet):
    queryset = Teacher.objects.all()
    serializer_class = ser.TeacherSerializer


class GroupViewSet(SchoolScopedViewSet):
    queryset = Group.objects.all()
    serializer_class = ser.GroupSerializer


class PeriodViewSet(SchoolScopedViewSet):
    queryset = Period.objects.all()
    serializer_class = ser.PeriodSerializer


class AcademicYearViewSet(SchoolScopedViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = ser.AcademicYearSerializer


class TermViewSet(SchoolScopedViewSet):
    queryset = Term.objects.all()
    serializer_class = ser.TermSerializer
    filter_params = ('academic_year',)


class BreakViewSet(SchoolScopedViewSet):
    queryset = Break.objects.all()
    serializer_class = ser.BreakSerializer


class ExamSessionViewSet(SchoolScopedViewSet):
    queryset = ExamSession.objects.all()
    serializer_class = ser.ExamSessionSerializer


class RoomViewSet(SchoolScopedViewSet):
    queryset = Room.objects.all()
    serializer_class = ser.RoomSerializer

    @action(detail=True, methods=['post'], url_path='rotate-token')
    def rotate_token(self, request, **kwargs):
        """Planshet tokeni sizib chiqsa — yangisini beradi, eskisi o'ladi."""
        room = self.get_object()
        room.rotate_token()
        return Response(self.get_serializer(room).data)

    @action(detail=True, methods=['get'])
    def day(self, request, **kwargs):
        """Admin panel uchun: xonaning istalgan kundagi jadvali."""
        room = self.get_object()
        now = school_now(self.school)
        day = _parse_date(request.query_params.get('date'), now.date())
        return Response(room_day(room, day, now=now))


class LessonViewSet(SchoolScopedViewSet):
    queryset = Lesson.objects.select_related('period', 'subject', 'group', 'teacher', 'room')
    serializer_class = ser.LessonSerializer
    filter_params = ('term', 'weekday', 'room', 'group', 'teacher', 'subject')

    @action(detail=False, methods=['post'])
    def copy(self, request, **kwargs):
        """Bir chorak jadvalini bo'sh chorakka nusxalash: {from_term, to_term}."""
        terms = Term.objects.filter(school=self.school)
        try:
            source = terms.get(pk=request.data.get('from_term'))
            target = terms.get(pk=request.data.get('to_term'))
        except (Term.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError('Chorak topilmadi.')
        if source == target:
            raise serializers.ValidationError("Bir xil chorakka nusxalab bo'lmaydi.")
        if Lesson.objects.filter(term=target).exists():
            raise serializers.ValidationError(f'"{target.name}" jadvali bo\'sh emas.')
        fields = ('school_id', 'weekday', 'period_id', 'room_id', 'subject_id', 'group_id', 'teacher_id')
        with transaction.atomic():
            created = Lesson.objects.bulk_create([
                Lesson(term=target, **{f: getattr(lesson, f) for f in fields})
                for lesson in Lesson.objects.filter(term=source)
            ])
        return Response({'copied': len(created)}, status=status.HTTP_201_CREATED)


class ClubViewSet(SchoolScopedViewSet):
    queryset = Club.objects.select_related('leader')
    serializer_class = ser.ClubSerializer
    filter_params = ('leader', 'is_active')


class ClubSessionViewSet(SchoolScopedViewSet):
    queryset = ClubSession.objects.select_related('club', 'room')
    serializer_class = ser.ClubSessionSerializer
    filter_params = ('club', 'academic_year', 'weekday', 'room')


class ExamViewSet(SchoolScopedViewSet):
    queryset = Exam.objects.select_related('subject', 'group', 'room', 'invigilator')
    serializer_class = ser.ExamSerializer
    filter_params = ('exam_session', 'date', 'room', 'group', 'subject')
