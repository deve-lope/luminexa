"""Emergency admin unlock: reset password and/or clear TOTP so Authenticator can be set up again."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        'Reset an admin user password and optionally clear Google Authenticator devices '
        'so they can enroll 2FA again. Use when locked out of /admin/.'
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

    def handle(self, *args, **options):
        User = get_user_model()
        email = (options['email'] or '').strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f'No user with email {email}')
        if not (user.is_staff or user.is_superuser):
            raise CommandError(f'{email} is not a staff/admin account')

        password = options['password']
        if password:
            if len(password) < 8:
                raise CommandError('Password must be at least 8 characters')
            user.set_password(password)
            user.is_active = True
            user.save(update_fields=['password', 'is_active'])
            self.stdout.write(self.style.SUCCESS(f'Password updated for {user.email}'))

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

        if not password and not options['clear_2fa']:
            raise CommandError('Provide --password and/or --clear-2fa')

        self.stdout.write(
            'Next: open https://app.luminex-a.com/admin/ → password'
            + (' → set up Google Authenticator again' if options['clear_2fa'] else ' → authenticator code')
        )
