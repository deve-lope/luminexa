from django.urls import path

from . import api_views

app_name = 'accounts'

urlpatterns = [
    path('api/register/', api_views.RegisterAPIView.as_view(), name='register_api'),
    path(
        'api/register/business/',
        api_views.RegisterBusinessAPIView.as_view(),
        name='register_business_api',
    ),
    path('api/login/', api_views.LoginAPIView.as_view(), name='login_api'),
    path('api/login/start/', api_views.LoginStartAPIView.as_view(), name='login_start_api'),
    path('api/login/otp/request/', api_views.LoginOtpRequestAPIView.as_view(), name='login_otp_request_api'),
    path('api/login/otp/verify/', api_views.LoginOtpVerifyAPIView.as_view(), name='login_otp_verify_api'),
    path('api/logout/', api_views.LogoutAPIView.as_view(), name='logout_api'),
    path('api/profile/', api_views.ProfileAPIView.as_view(), name='profile_api'),
    path(
        'api/onboarding/complete/',
        api_views.CompleteOnboardingAPIView.as_view(),
        name='onboarding_complete_api',
    ),
    path(
        'api/change-password/',
        api_views.ChangePasswordAPIView.as_view(),
        name='change_password_api',
    ),
    path(
        'api/password-reset/',
        api_views.PasswordResetRequestAPIView.as_view(),
        name='password_reset_request_api',
    ),
    path(
        'api/password-reset/confirm/',
        api_views.PasswordResetConfirmAPIView.as_view(),
        name='password_reset_confirm_api',
    ),
    path(
        'api/verify-email/',
        api_views.VerifyEmailAPIView.as_view(),
        name='verify_email_api',
    ),
    path(
        'api/verify-email/otp/',
        api_views.VerifyEmailOtpAPIView.as_view(),
        name='verify_email_otp_api',
    ),
    path(
        'api/resend-verification/',
        api_views.ResendVerificationAPIView.as_view(),
        name='resend_verification_api',
    ),
    path(
        'api/account/delete/',
        api_views.DeleteAccountAPIView.as_view(),
        name='delete_account_api',
    ),
    path(
        'api/account/delete/request/',
        api_views.DeleteAccountRequestAPIView.as_view(),
        name='delete_account_request_api',
    ),
    path(
        'api/account/delete/confirm/',
        api_views.DeleteAccountConfirmAPIView.as_view(),
        name='delete_account_confirm_api',
    ),
]
