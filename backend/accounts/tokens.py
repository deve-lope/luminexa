"""Email verification token (invalidates after verify or email change)."""

from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        verified = '1' if getattr(user, 'email_verified', False) else '0'
        return f'{user.pk}{user.email}{verified}{timestamp}'


email_verification_token = EmailVerificationTokenGenerator()


class AccountDeletionTokenGenerator(PasswordResetTokenGenerator):
    """Signs a one-time link to confirm account deletion from a public web page.

    Includes is_active + deleted_at so the token stops working once the account
    is deactivated / deleted.
    """

    def _make_hash_value(self, user, timestamp):
        deleted = user.deleted_at.isoformat() if getattr(user, 'deleted_at', None) else ''
        active = '1' if user.is_active else '0'
        return f'{user.pk}{user.email}{active}{deleted}{timestamp}'


account_deletion_token = AccountDeletionTokenGenerator()
