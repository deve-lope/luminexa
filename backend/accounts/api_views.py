from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from luminexa.throttles import LoginThrottle, PasswordResetThrottle, RegisterBusinessThrottle

from .auth_cookies import clear_auth_cookie, set_auth_cookie
from .deletion import anonymize_user, record_provider_deletion_feedback
from .emails import (
    send_account_deletion_email,
    send_email_verification_otp,
    send_login_otp_email,
    send_password_reset_email,
)
from .models import DevicePushToken, User
from .otp import issue_login_code, normalize_email, user_uses_password_login, verify_login_code
from .serializers import (
    EmailVerifySerializer,
    LoginOtpRequestSerializer,
    LoginOtpVerifySerializer,
    LoginSerializer,
    LoginStartSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterBusinessSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserSerializer,
)
from .tokens import account_deletion_token, email_verification_token


def _registration_pending_response(user, *, organization=None):
    payload = {
        'detail': 'We sent a verification code to your email. Enter it to confirm your account.',
        'requires_verification': True,
        'requires_otp': True,
        'email': user.email,
    }
    if organization is not None:
        payload['organization'] = {'slug': organization.slug, 'name': organization.name}
    return Response(payload, status=status.HTTP_201_CREATED)


def _issue_auth_token(user):
    """Issue a rotated DRF token and set it in an HttpOnly cookie (not in JSON)."""
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)
    response = Response({
        'user': UserSerializer(user).data,
        'auth': 'cookie',
    })
    set_auth_cookie(response, token.key)
    return response


def _send_customer_otp(email: str, *, full_name: str = '') -> None:
    code = issue_login_code(email)
    send_login_otp_email(email, code, full_name=full_name)


def _send_business_verification_otp(email: str, *, full_name: str = '') -> None:
    code = issue_login_code(email)
    send_email_verification_otp(email, code, full_name=full_name)


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        _send_customer_otp(user.email, full_name=user.full_name)
        return Response(
            {
                'detail': 'We sent a sign-in code to your email.',
                'requires_otp': True,
                'email': user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class RegisterBusinessAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterBusinessThrottle]

    def post(self, request):
        serializer = RegisterBusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, org = serializer.save()
        _send_business_verification_otp(user.email, full_name=user.full_name)
        return _registration_pending_response(user, organization=org)


class LoginStartAPIView(APIView):
    """Branch after email: providers → password, customers → OTP (sent automatically)."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalize_email(serializer.validated_data['email'])
        user = User.objects.filter(email__iexact=email).first()
        # Always HTTP 200 — avoid 404 account enumeration. Unknown emails get
        # auth_method=none so the SPA can offer register without confirming existence via status code.
        if not user or not user.is_active:
            return Response({
                'auth_method': 'none',
                'email': email,
                'detail': (
                    'We could not start sign-in for this email. '
                    'Create an account below, or try a different address.'
                ),
                'code': 'no_login',
            })
        if user_uses_password_login(user):
            return Response({
                'auth_method': 'password',
                'email': email,
                'detail': 'Enter your business account password.',
            })
        _send_customer_otp(email, full_name=user.full_name)
        return Response({
            'auth_method': 'otp',
            'email': email,
            'detail': 'We sent a sign-in code to your email.',
        })


class LoginOtpRequestAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = LoginOtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalize_email(serializer.validated_data['email'])
        user = User.objects.filter(email__iexact=email).first()
        # Uniform success-shaped response for unknown emails (no OTP sent).
        if not user or not user.is_active:
            return Response({
                'detail': 'If an account exists for this email, we sent a sign-in code.',
                'email': email,
                'auth_method': 'otp',
            })
        if user_uses_password_login(user):
            return Response({
                'detail': 'This account uses a password.',
                'auth_method': 'password',
                'email': email,
            })
        _send_customer_otp(email, full_name=user.full_name)
        return Response({
            'detail': 'We sent a new sign-in code to your email.',
            'email': email,
            'auth_method': 'otp',
        })


class LoginOtpVerifyAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginOtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalize_email(serializer.validated_data['email'])
        code = serializer.validated_data['code']
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.is_active:
            raise ValidationError({'detail': 'Invalid or expired code.'})
        if user_uses_password_login(user):
            raise ValidationError(
                {'detail': 'This account uses a password. Sign in with your password instead.'}
            )
        if not verify_login_code(email, code):
            raise ValidationError({'detail': 'Invalid or expired code.'})
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=['email_verified'])
        return _issue_auth_token(user)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        if not user.email_verified:
            return Response(
                {
                    'detail': 'Please verify your email before signing in.',
                    'code': 'email_not_verified',
                    'email': user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return _issue_auth_token(user)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        response = Response({'detail': 'Logged out.'})
        clear_auth_cookie(response)
        return response

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        if not old_password or not new_password:
            raise ValidationError({'detail': 'old_password and new_password are required.'})
        if len(new_password) < 8:
            raise ValidationError({'new_password': 'Must be at least 8 characters.'})
        user = request.user
        if not user_uses_password_login(user):
            raise ValidationError({'detail': 'Customer accounts do not use a password.'})
        if not user.check_password(old_password):
            raise ValidationError({'old_password': 'Current password is incorrect.'})
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password updated.'})


class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if 'full_name' in serializer.validated_data:
            user.full_name = serializer.validated_data['full_name']
        if 'phone' in serializer.validated_data:
            user.phone = serializer.validated_data['phone'] or ''
        if 'default_service_address' in serializer.validated_data:
            user.default_service_address = (
                serializer.validated_data['default_service_address'] or ''
            ).strip()
        if 'address_country' in serializer.validated_data:
            user.address_country = (serializer.validated_data['address_country'] or '').strip()
        update_fields = ['full_name', 'phone']
        if 'default_service_address' in serializer.validated_data:
            update_fields.append('default_service_address')
        if 'address_country' in serializer.validated_data:
            update_fields.append('address_country')
        user.save(update_fields=update_fields)
        return Response(UserSerializer(user).data)


class CompleteOnboardingAPIView(APIView):
    """Mark first-sign-in profile setup as done (after name/phone/address are saved)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .otp import user_uses_password_login

        user = request.user
        if not (user.full_name or '').strip():
            raise ValidationError({'full_name': 'Name is required.'})
        if not (user.phone or '').strip():
            raise ValidationError({'phone': 'Phone number is required.'})
        if not user_uses_password_login(user):
            if not (user.default_service_address or '').strip():
                raise ValidationError({'default_service_address': 'Address is required.'})
        if user.onboarding_completed_at is None:
            from django.utils import timezone

            user.onboarding_completed_at = timezone.now()
            user.save(update_fields=['onboarding_completed_at'])
        return Response(UserSerializer(user).data)


class PasswordResetRequestAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user and user_uses_password_login(user):
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            from .admin_2fa import user_is_admin_account

            otp_q = '&requires_otp=1' if user_is_admin_account(user) else ''
            reset_url = (
                f'{settings.PUBLIC_APP_URL.rstrip("/")}/reset-password'
                f'?uid={uid}&token={token}{otp_q}'
            )
            send_password_reset_email(user, reset_url)
        return Response({
            'detail': 'If an account exists for that email, a reset link has been sent.',
        })


class PasswordResetConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        password = serializer.validated_data['password']
        otp = serializer.validated_data.get('otp') or ''
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValidationError({'detail': 'Invalid reset link.'}) from None
        if not default_token_generator.check_token(user, token):
            raise ValidationError({'detail': 'Invalid or expired reset link.'})
        if not user_uses_password_login(user):
            raise ValidationError({'detail': 'Customer accounts do not use a password.'})

        from .admin_2fa import user_is_admin_account, verify_admin_totp

        if user_is_admin_account(user):
            if not (otp or '').strip():
                raise ValidationError({
                    'otp': 'Admin accounts require a Google Authenticator code (or backup token).',
                    'code': 'admin_otp_required',
                })
            if not verify_admin_totp(user, otp):
                raise ValidationError({
                    'otp': 'Invalid authenticator code.',
                    'code': 'admin_otp_invalid',
                })

        user.set_password(password)
        # Completing reset proves mailbox access — mark verified if not already.
        update_fields = ['password']
        if not user.email_verified:
            user.email_verified = True
            update_fields.append('email_verified')
        user.save(update_fields=update_fields)
        return Response({'detail': 'Password updated. You can sign in now.'})


class VerifyEmailAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = EmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValidationError({'detail': 'Invalid verification link.'}) from None
        if user.email_verified:
            return Response({'detail': 'Email already verified. You can sign in.', 'email': user.email})
        if not email_verification_token.check_token(user, token):
            raise ValidationError({'detail': 'Invalid or expired verification link.'})
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        return Response({
            'detail': 'Email verified. You can sign in now.',
            'email': user.email,
        })


class VerifyEmailOtpAPIView(APIView):
    """Verify a business (password) account with a one-time email code."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginOtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalize_email(serializer.validated_data['email'])
        code = serializer.validated_data['code']
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.is_active:
            raise ValidationError({'detail': 'Invalid or expired code.'})
        if not user_uses_password_login(user):
            raise ValidationError(
                {'detail': 'Customers sign in with an email code instead.'}
            )
        if user.email_verified:
            return Response({
                'detail': 'Email already verified. You can sign in with your password.',
                'email': user.email,
            })
        if not verify_login_code(email, code):
            raise ValidationError({'detail': 'Invalid or expired code.'})
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        return Response({
            'detail': 'Email verified. You can sign in with your password now.',
            'email': user.email,
        })


class DeleteAccountAPIView(APIView):
    """Delete (anonymize) the signed-in user's account. Requires explicit confirm."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.data.get('confirm') is not True:
            raise ValidationError({'confirm': 'Confirmation is required to delete your account.'})
        user = request.user
        record_provider_deletion_feedback(
            user=user,
            reason=request.data.get('deletion_reason', ''),
            detail=request.data.get('deletion_detail', ''),
            channel='in_app',
        )
        anonymize_user(user)
        Token.objects.filter(user=user).delete()
        response = Response({'detail': 'Your account has been deleted.'})
        clear_auth_cookie(response)
        return response


class DeleteAccountRequestAPIView(APIView):
    """Public: email a signed deletion-confirmation link if the account exists."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        email = normalize_email(request.data.get('email', ''))
        if not email:
            raise ValidationError({'email': 'Email is required.'})
        user = User.objects.filter(email__iexact=email).first()
        if user and user.is_active and user.deleted_at is None:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = account_deletion_token.make_token(user)
            confirm_url = (
                f'{settings.PUBLIC_APP_URL.rstrip("/")}/delete-account'
                f'?uid={uid}&token={token}'
            )
            send_account_deletion_email(user, confirm_url)
        return Response({
            'detail': 'If an account exists for that email, we sent a link to confirm deletion.',
        })


class DeleteAccountConfirmAPIView(APIView):
    """Public: verify the signed link from the email and anonymize the account."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        if not uid or not token:
            raise ValidationError({'detail': 'Invalid deletion link.'})
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValidationError({'detail': 'Invalid deletion link.'}) from None
        if user.deleted_at is not None:
            return Response({'detail': 'This account has already been deleted.'})
        if not account_deletion_token.check_token(user, token):
            raise ValidationError({'detail': 'This deletion link is invalid or has expired.'})
        record_provider_deletion_feedback(
            user=user,
            reason=request.data.get('deletion_reason', ''),
            detail=request.data.get('deletion_detail', ''),
            channel='public_link',
        )
        anonymize_user(user)
        return Response({'detail': 'Your account has been deleted.'})


class ResendVerificationAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user and not user.email_verified:
            if user_uses_password_login(user):
                _send_business_verification_otp(email, full_name=user.full_name)
            else:
                _send_customer_otp(email, full_name=user.full_name)
        return Response({
            'detail': 'If that email needs verification, we sent a new code.',
        })


class DevicePushTokenAPIView(APIView):
    """Register / remove FCM tokens for Capacitor outside-app notifications."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        platform = (request.data.get('platform') or 'android').strip().lower()
        if not token or len(token) < 20:
            raise ValidationError({'token': 'A valid device push token is required.'})
        if platform not in (
            DevicePushToken.Platform.ANDROID,
            DevicePushToken.Platform.IOS,
            DevicePushToken.Platform.WEB,
        ):
            platform = DevicePushToken.Platform.ANDROID
        # Token may move between users on shared devices.
        DevicePushToken.objects.filter(token=token).exclude(user=request.user).delete()
        obj, _ = DevicePushToken.objects.update_or_create(
            token=token,
            defaults={'user': request.user, 'platform': platform},
        )
        return Response(
            {'id': obj.id, 'platform': obj.platform},
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        token = (request.data.get('token') or request.query_params.get('token') or '').strip()
        qs = DevicePushToken.objects.filter(user=request.user)
        if token:
            qs = qs.filter(token=token)
        deleted, _ = qs.delete()
        return Response({'deleted': deleted})
