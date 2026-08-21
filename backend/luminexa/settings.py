from pathlib import Path

from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('DJANGO_SECRET_KEY', default='')
if not SECRET_KEY:
    raise ValueError('DJANGO_SECRET_KEY environment variable is required')

DEBUG = config('DEBUG', default='True').lower() == 'true'
# Serve /media/ via Django (required when DEBUG=False, e.g. Docker prod-local).
# Non-public paths require auth; see luminexa.media_views.PUBLIC_MEDIA_PREFIXES.
SERVE_MEDIA = config('SERVE_MEDIA', default='True').lower() == 'true'

# SPA auth: HttpOnly cookie (JS cannot read). Prefer same-origin via frontend nginx.
AUTH_TOKEN_COOKIE_NAME = config('AUTH_TOKEN_COOKIE_NAME', default='lx_auth')
AUTH_TOKEN_COOKIE_MAX_AGE = config('AUTH_TOKEN_COOKIE_MAX_AGE', default=60 * 60 * 24 * 14, cast=int)
AUTH_TOKEN_COOKIE_SAMESITE = config('AUTH_TOKEN_COOKIE_SAMESITE', default='Lax')
AUTH_TOKEN_COOKIE_SECURE = config(
    'AUTH_TOKEN_COOKIE_SECURE',
    default='false' if DEBUG else 'true',
).lower() == 'true'

ALLOWED_HOSTS = [
    host.strip()
    for host in config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')
    if host.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Before two_factor so accounts/templates override package login UI.
    'accounts',
    'django_otp',
    'django_otp.plugins.otp_static',
    'django_otp.plugins.otp_totp',
    'two_factor',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'businesses',
    'jobs',
    'anymail',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django_otp.middleware.OTPMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'luminexa.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'accounts.context_processors.public_app_url',
            ],
        },
    },
]

WSGI_APPLICATION = 'luminexa.wsgi.application'

_database_url = config('DATABASE_URL', default='')
if _database_url:
    import dj_database_url

    DATABASES = {
        'default': dj_database_url.config(
            default=_database_url,
            conn_max_age=600,
        ),
    }
else:
    _db_path = config('SQLITE_DB_PATH', default='')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': Path(_db_path) if _db_path else BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.User'

# Django admin: password + Google Authenticator–compatible TOTP (django-two-factor-auth).
LOGIN_URL = 'two_factor:login'
LOGIN_REDIRECT_URL = '/admin/'
LOGOUT_REDIRECT_URL = '/admin/'
TWO_FACTOR_PATCH_ADMIN = True
# Only authenticator-app tokens (no SMS). Backup tokens available after setup.
TWO_FACTOR_REMEMBER_COOKIE_AGE = 0  # always require OTP on admin login sessions


REST_FRAMEWORK = {
    # Prefer HttpOnly cookie for the SPA; Authorization: Token still works for tests/API clients.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.CookieTokenAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'login': '20/minute',
        'password_reset': '10/hour',
        'booking_create': '60/hour',
        'service_inquiry': '30/hour',
        'register_business': '5/hour',
        'map_search': '60/minute',
        'business_type_write': '10/hour',
    },
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]
# Dev: allow phones on the local network (e.g. http://192.168.1.5:3000).
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$',
        r'^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$',
        r'^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$',
    ]
else:
    CORS_ALLOWED_ORIGIN_REGEXES = []
CORS_ALLOW_CREDENTIALS = True

_csrf_origins = config('CSRF_TRUSTED_ORIGINS', default='')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins.split(',') if o.strip()]

PUBLIC_APP_URL = config('PUBLIC_APP_URL', default='http://localhost:3000')

# Customers cannot book / reschedule into slots starting sooner than this.
CUSTOMER_BOOKING_LEAD_HOURS = config('CUSTOMER_BOOKING_LEAD_HOURS', default=2, cast=int)

DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@luminexa.local')
# Prefer Brevo HTTPS API when BREVO_API_KEY is set (no SMTP IP allowlist).
# Otherwise fall back to EMAIL_* SMTP (Mailpit locally, or legacy SMTP).
BREVO_API_KEY = config('BREVO_API_KEY', default='')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default='True').lower() == 'true'
if BREVO_API_KEY:
    EMAIL_BACKEND = 'anymail.backends.brevo.EmailBackend'
    ANYMAIL = {
        'BREVO_API_KEY': BREVO_API_KEY,
    }
else:
    EMAIL_BACKEND = config(
        'EMAIL_BACKEND',
        default='django.core.mail.backends.console.EmailBackend',
    )

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    'sync-recurring-slots-nightly': {
        'task': 'jobs.tasks.sync_all_recurring_slots',
        'schedule': 86400.0,
    },
    'booking-reminders-hourly': {
        'task': 'jobs.tasks.send_upcoming_booking_reminders',
        'schedule': 3600.0,
    },
    'invoice-payment-reminders-hourly': {
        'task': 'jobs.tasks.send_unpaid_invoice_payment_reminders',
        'schedule': 3600.0,
    },
}

# ── Stripe (Connect marketplace + Billing subscriptions) ───────────────────
# Leave secret key empty in local/dev until configured — APIs return 503.
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')
# Luminexa platform fee on customer→provider invoice card payments (percent of charge).
# Separate from Stripe’s own processing fee. Default 0.5%.
STRIPE_PLATFORM_FEE_PERCENT = config('STRIPE_PLATFORM_FEE_PERCENT', default=0.5, cast=float)
# Stripe Price IDs for provider SaaS plans (create in Stripe Dashboard).
STRIPE_PRICE_PRO_MONTHLY = config('STRIPE_PRICE_PRO_MONTHLY', default='')
STRIPE_PRICE_PRO_YEARLY = config('STRIPE_PRICE_PRO_YEARLY', default='')
# Free trial for provider Pro subscriptions (days). 0 = no trial from the API.
STRIPE_TRIAL_DAYS = config('STRIPE_TRIAL_DAYS', default=30, cast=int)
STRIPE_ENABLED = bool(STRIPE_SECRET_KEY)

# ── QuickBooks Online (optional accounting sync) ───────────────────────────
QUICKBOOKS_CLIENT_ID = config('QUICKBOOKS_CLIENT_ID', default='')
QUICKBOOKS_CLIENT_SECRET = config('QUICKBOOKS_CLIENT_SECRET', default='')
QUICKBOOKS_REDIRECT_URI = config('QUICKBOOKS_REDIRECT_URI', default='')
QUICKBOOKS_ENVIRONMENT = config('QUICKBOOKS_ENVIRONMENT', default='sandbox')
# Optional absolute API origin for OAuth redirect (defaults to PUBLIC_APP_URL + /api/…)
PUBLIC_API_URL = config('PUBLIC_API_URL', default='')
QUICKBOOKS_ENABLED = bool(QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET)

FIREBASE_CREDENTIALS_FILE = config('FIREBASE_CREDENTIALS_FILE', default='').strip()
FIREBASE_CREDENTIALS_JSON = config('FIREBASE_CREDENTIALS_JSON', default='').strip()

# Play Store review: one customer email may use a fixed OTP (no inbox needed).
# Leave blank to disable. Never reuse these values for real users.
PLAY_STORE_DEMO_CUSTOMER_EMAIL = config(
    'PLAY_STORE_DEMO_CUSTOMER_EMAIL', default=''
).strip().lower()
PLAY_STORE_DEMO_CUSTOMER_OTP = config(
    'PLAY_STORE_DEMO_CUSTOMER_OTP', default=''
).strip()

# ── Production HTTPS / browser hardening (only when DEBUG=False) ───────────
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default='True').lower() == 'true'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'
