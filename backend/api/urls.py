from django.urls import path, re_path
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import DefaultRouter

from . import views

SCHOOL = r'schools/(?P<school_slug>[\w-]+)'

router = DefaultRouter()
router.register(f'{SCHOOL}/subjects', views.SubjectViewSet, basename='subject')
router.register(f'{SCHOOL}/teachers', views.TeacherViewSet, basename='teacher')
router.register(f'{SCHOOL}/rooms', views.RoomViewSet, basename='room')
router.register(f'{SCHOOL}/groups', views.GroupViewSet, basename='group')
router.register(f'{SCHOOL}/periods', views.PeriodViewSet, basename='period')
router.register(f'{SCHOOL}/academic-years', views.AcademicYearViewSet, basename='academic-year')
router.register(f'{SCHOOL}/terms', views.TermViewSet, basename='term')
router.register(f'{SCHOOL}/breaks', views.BreakViewSet, basename='break')
router.register(f'{SCHOOL}/exam-sessions', views.ExamSessionViewSet, basename='exam-session')
router.register(f'{SCHOOL}/lessons', views.LessonViewSet, basename='lesson')
router.register(f'{SCHOOL}/exams', views.ExamViewSet, basename='exam')
router.register(f'{SCHOOL}/clubs', views.ClubViewSet, basename='club')
router.register(f'{SCHOOL}/club-sessions', views.ClubSessionViewSet, basename='club-session')
router.register(f'{SCHOOL}/members', views.MemberViewSet, basename='member')

urlpatterns = [
    path('health/', views.health, name='health'),
    path('auth/token/', obtain_auth_token, name='auth-token'),
    path('me/', views.me, name='me'),
    path('tablet/<str:token>/', views.TabletView.as_view(), name='tablet'),
    re_path(rf'^{SCHOOL}/dashboard/$', views.DashboardView.as_view(), name='dashboard'),
    re_path(rf'^{SCHOOL}/settings/$', views.SchoolSettingsView.as_view(), name='school-settings'),
    *router.urls,
]
