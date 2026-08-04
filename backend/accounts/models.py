from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        if not extra_fields.get('public_ref'):
            from .public_refs import next_user_public_ref
            extra_fields['public_ref'] = next_user_public_ref()
        user = self.model(email=email, full_name=full_name, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('email_verified', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, full_name, password, **extra_fields)


class User(AbstractUser):
    """Email-based user with required display name."""

    username = None
    email = models.EmailField('email address', unique=True)
    public_ref = models.CharField(
        max_length=16,
        unique=True,
        blank=True,
        default='',
        db_index=True,
        help_text='Customer account ID, e.g. cus1, cus2',
    )
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True, default='')
    default_service_address = models.TextField(
        blank=True,
        default='',
        help_text='Customer default address for service visits',
    )
    address_country = models.CharField(
        max_length=80,
        blank=True,
        default='',
        help_text='Preferred Americas country for address search (e.g. Canada)',
    )
    email_verified = models.BooleanField(
        default=False,
        help_text='True after the user confirms their email address.',
    )
    onboarding_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Set when the user finishes first-sign-in profile setup.',
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Set when the account is deleted / anonymized on user request.',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return self.email

    def get_full_name(self):
        return (self.full_name or '').strip()

    def get_short_name(self):
        name = self.get_full_name()
        return name.split()[0] if name else (self.email or '')

    @property
    def has_booking_contact(self) -> bool:
        return bool(self.email and (self.phone or '').strip())


class LoginCode(models.Model):
    """Short-lived email OTP for customer sign-in / sign-up."""

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempt_count = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['email', 'consumed_at']),
        ]

    def __str__(self):
        return f'LoginCode<{self.email}>'


class ProviderDeletionFeedback(models.Model):
    """Why a service provider left / did not renew — kept after account anonymization."""

    class Reason(models.TextChoices):
        TOO_EXPENSIVE = 'too_expensive', 'Too expensive / not worth the price'
        NOT_ENOUGH_CUSTOMERS = 'not_enough_customers', 'Not enough customers or bookings'
        SWITCHING_TOOL = 'switching_tool', 'Switching to another tool'
        BUSINESS_CLOSED = 'business_closed', 'Business closed or pausing'
        MISSING_FEATURES = 'missing_features', 'Missing features I need'
        HARD_TO_USE = 'hard_to_use', 'Too hard to use'
        DIDNT_NEED_PRO = 'didnt_need_pro', 'Didn’t need Pro / trial was enough'
        TEMPORARY = 'temporary', 'Temporary — may come back'
        OTHER = 'other', 'Other'

    class Channel(models.TextChoices):
        IN_APP = 'in_app', 'In-app account page'
        PUBLIC_LINK = 'public_link', 'Public deletion link'

    reason = models.CharField(max_length=40, choices=Reason.choices)
    detail = models.TextField(blank=True, default='', max_length=2000)
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.IN_APP,
    )

    # Snapshots — no email / phone; survive anonymization
    user_id_snapshot = models.PositiveIntegerField(
        help_text='User pk at deletion time (row may later be anonymized).',
    )
    was_owner = models.BooleanField(default=False)
    had_active_subscription = models.BooleanField(default=False)
    subscription_status = models.CharField(max_length=32, blank=True, default='')
    subscription_plan = models.CharField(max_length=32, blank=True, default='')
    subscription_source = models.CharField(max_length=32, blank=True, default='')
    organization_slug = models.CharField(max_length=120, blank=True, default='')
    organization_name = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['reason']),
        ]

    def __str__(self):
        return f'{self.get_reason_display()} · {self.organization_slug or self.user_id_snapshot}'
