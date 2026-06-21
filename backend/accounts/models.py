from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
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

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def has_booking_contact(self) -> bool:
        return bool(self.email and (self.phone or '').strip())
