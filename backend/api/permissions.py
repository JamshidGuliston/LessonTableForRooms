from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import SchoolMembership


class IsSchoolMember(BasePermission):
    """URL dagi maktabga a'zo bo'lish shart; yozish uchun admin roli kerak.

    Superuser hamma maktabni ko'radi va o'zgartiradi.
    """

    message = 'Bu maktab ma\'lumotlariga ruxsatingiz yo\'q.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        membership = SchoolMembership.objects.filter(user=user, school=view.get_school()).first()
        if membership is None:
            return False
        if request.method in SAFE_METHODS:
            return True
        return membership.role == SchoolMembership.Role.ADMIN
