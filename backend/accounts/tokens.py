"""Email verification token (invalidates after verify or email change)."""

from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        verified = '1' if getattr(user, 'email_verified', False) else '0'
        return f'{user.pk}{user.email}{verified}{timestamp}'


email_verification_token = EmailVerificationTokenGenerator()
