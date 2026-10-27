from django.contrib import admin

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


class MembershipInline(admin.TabularInline):
    model = SchoolMembership
    extra = 1


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'timezone', 'working_days', 'is_active']
    prepopulated_fields = {'slug': ['name']}
    inlines = [MembershipInline]


class SchoolOwnedAdmin(admin.ModelAdmin):
    list_filter = ['school']

    def get_list_display(self, request):
        return ['__str__', 'school']


@admin.register(Subject)
class SubjectAdmin(SchoolOwnedAdmin):
    list_display = ['name', 'short_name', 'color', 'school']


@admin.register(Teacher)
class TeacherAdmin(SchoolOwnedAdmin):
    list_display = ['full_name', 'phone', 'school']


@admin.register(Room)
class RoomAdmin(SchoolOwnedAdmin):
    list_display = ['name', 'floor', 'capacity', 'school', 'device_token']
    readonly_fields = ['device_token']


@admin.register(Group)
class GroupAdmin(SchoolOwnedAdmin):
    list_display = ['name', 'school']


@admin.register(Period)
class PeriodAdmin(SchoolOwnedAdmin):
    list_display = ['order', 'name', 'kind', 'start_time', 'end_time', 'school']
    list_filter = ['school', 'kind']


class DateRangeAdmin(SchoolOwnedAdmin):
    list_display = ['name', 'start_date', 'end_date', 'school']


admin.site.register(AcademicYear, DateRangeAdmin)
admin.site.register(Term, DateRangeAdmin)
admin.site.register(Break, DateRangeAdmin)


@admin.register(ExamSession)
class ExamSessionAdmin(DateRangeAdmin):
    list_display = ['name', 'kind', 'start_date', 'end_date', 'school']


@admin.register(Lesson)
class LessonAdmin(SchoolOwnedAdmin):
    list_display = ['term', 'weekday', 'period', 'room', 'subject', 'group', 'teacher']
    list_filter = ['school', 'term', 'weekday', 'room', 'group', 'teacher']


class ClubSessionInline(admin.TabularInline):
    model = ClubSession
    extra = 1


@admin.register(Club)
class ClubAdmin(SchoolOwnedAdmin):
    list_display = ['name', 'leader', 'is_active', 'school']
    list_filter = ['school', 'is_active']
    inlines = [ClubSessionInline]


@admin.register(ClubSession)
class ClubSessionAdmin(SchoolOwnedAdmin):
    list_display = ['club', 'weekday', 'start_time', 'end_time', 'room', 'academic_year']
    list_filter = ['school', 'academic_year', 'weekday', 'room']


@admin.register(Exam)
class ExamAdmin(SchoolOwnedAdmin):
    list_display = ['date', 'start_time', 'end_time', 'room', 'subject', 'group', 'exam_session']
    list_filter = ['school', 'exam_session', 'room', 'group']
