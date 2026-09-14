"""Hardened django-two-factor login for Django admin."""

from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError
from two_factor.forms import AuthenticationTokenForm, BackupTokenForm
from two_factor.views import LoginView

from .admin_lockout import (
    admin_login_is_locked,
    client_ip,
    lockout_message,
    normalize_email,
    record_admin_login_failure,
)


class AdminAuthenticationForm(AuthenticationForm):
    """Password step for /account/login/ with daily failure lockout."""

    def clean(self):
        raw = self.data.get(self.add_prefix('username'), self.data.get('username', ''))
        email = normalize_email(raw)
        ip = client_ip(self.request)

        if admin_login_is_locked(email=email, ip=ip):
            raise ValidationError(lockout_message(), code='admin_lockout')

        try:
            return super().clean()
        except ValidationError:
            record_admin_login_failure(email=email, ip=ip, request=self.request)
            if admin_login_is_locked(email=email, ip=ip):
                raise ValidationError(lockout_message(), code='admin_lockout') from None
            raise


class AdminLoginView(LoginView):
    form_list = (
        (LoginView.AUTH_STEP, AdminAuthenticationForm),
        (LoginView.TOKEN_STEP, AuthenticationTokenForm),
        (LoginView.BACKUP_STEP, BackupTokenForm),
    )

    def get_form_kwargs(self, step=None):
        kwargs = super().get_form_kwargs(step)
        step = step or self.steps.current
        if step == self.AUTH_STEP:
            kwargs['request'] = self.request
        return kwargs
