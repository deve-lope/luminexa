"""Emergency admin unlock: reset password and/or clear TOTP so Authenticator can be set up again."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        'Reset an admin user password and optionally clear Google Authenticator devices '
        'or today\'s admin login lockout. Use when locked out of /admin/.'
    )

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Admin account email')
        parser.add_argument(
            '--password',
            type=str,
            default='',
            help='New password (if omitted, only clears 2FA devices when --clear-2fa is set)',
        )
        parser.add_argument(
            '--clear-2fa',
            action='store_true',
            help='Delete TOTP + backup tokens so the user must re-scan Google Authenticator',
        )
        parser.add_argument(
            '--clear-lockout',
            action='store_true',
            help='Clear today\'s Django admin failed-login lockout for this email',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        email = (options['email'] or '').strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f'No user with email {email}')
        if not (user.is_staff or user.is_superuser):
            raise CommandError(f'{email} is not a staff/admin account')

        password = options['password']
        did_something = False
        if password:
            if len(password) < 8:
                raise CommandError('Password must be at least 8 characters')
            user.set_password(password)
            user.is_active = True
            user.save(update_fields=['password', 'is_active'])
            self.stdout.write(self.style.SUCCESS(f'Password updated for {user.email}'))
            did_something = True

        if options['clear_2fa']:
            from django_otp.plugins.otp_static.models import StaticDevice
            from django_otp.plugins.otp_totp.models import TOTPDevice

            totp_n, _ = TOTPDevice.objects.filter(user=user).delete()
            static_n, _ = StaticDevice.objects.filter(user=user).delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleared 2FA devices for {user.email} '
                    f'(TOTP deleted={totp_n}, backup devices deleted={static_n})'
                )
            )
            did_something = True

        if options['clear_lockout']:
            from accounts.admin_lockout import clear_admin_login_lockout

            n = clear_admin_login_lockout(email=email)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleared today\'s admin login lockout for {email} ({n} row(s))'
                )
            )
            did_something = True

        if not did_something:
            raise CommandError('Provide --password, --clear-2fa, and/or --clear-lockout')

        self.stdout.write(
            'Next: open https://app.luminex-a.com/admin/ → password'
            + (' → set up Google Authenticator again' if options['clear_2fa'] else ' → authenticator code')
        )
