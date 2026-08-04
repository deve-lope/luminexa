"""Admin privilege and 2FA-related tests."""

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase

from accounts.admin import UserAdmin
from accounts.models import User


class UserAdminPrivilegeTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.site = AdminSite()
        self.admin = UserAdmin(User, self.site)
        self.super = User.objects.create_superuser(
            email='super@test.local',
            full_name='Super',
            password='password123',
        )
        self.staff = User.objects.create_user(
            email='staff@test.local',
            full_name='Staff',
            password='password123',
            is_staff=True,
            is_superuser=False,
        )
        self.regular = User.objects.create_user(
            email='user@test.local',
            full_name='User',
            password='password123',
        )

    def test_staff_cannot_add_users(self):
        request = self.factory.get('/admin/')
        request.user = self.staff
        self.assertFalse(self.admin.has_add_permission(request))

    def test_superuser_can_add_users(self):
        request = self.factory.get('/admin/')
        request.user = self.super
        self.assertTrue(self.admin.has_add_permission(request))

    def test_staff_save_cannot_elevate(self):
        request = self.factory.post('/admin/')
        request.user = self.staff
        self.regular.is_staff = True
        self.regular.is_superuser = True
        self.admin.save_model(request, self.regular, form=None, change=True)
        self.regular.refresh_from_db()
        self.assertFalse(self.regular.is_staff)
        self.assertFalse(self.regular.is_superuser)

    def test_superuser_can_elevate(self):
        request = self.factory.post('/admin/')
        request.user = self.super
        self.regular.is_staff = True
        self.regular.is_superuser = True
        self.admin.save_model(request, self.regular, form=None, change=True)
        self.regular.refresh_from_db()
        self.assertTrue(self.regular.is_staff)
        self.assertTrue(self.regular.is_superuser)

    def test_staff_fieldsets_hide_elevation(self):
        request = self.factory.get('/admin/')
        request.user = self.staff
        fieldsets = self.admin.get_fieldsets(request, self.regular)
        flat = []
        for _, opts in fieldsets:
            flat.extend(opts.get('fields', ()))
        self.assertNotIn('is_staff', flat)
        self.assertNotIn('is_superuser', flat)
