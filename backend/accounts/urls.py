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
    path('api/logout/', api_views.LogoutAPIView.as_view(), name='logout_api'),
    path('api/profile/', api_views.ProfileAPIView.as_view(), name='profile_api'),
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
]
