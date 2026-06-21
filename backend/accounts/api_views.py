from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from luminexa.throttles import LoginThrottle, PasswordResetThrottle

from .models import User
from .serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterBusinessSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key, 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class RegisterBusinessAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterBusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, org = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                'token': token.key,
                'user': UserSerializer(user).data,
                'organization': {'slug': org.slug, 'name': org.name},
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'detail': 'Logged out.'})


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        if not old_password or not new_password:
            raise ValidationError({'detail': 'old_password and new_password are required.'})
        if len(new_password) < 8:
            raise ValidationError({'new_password': 'Must be at least 8 characters.'})
        user = request.user
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
        update_fields = ['full_name', 'phone']
        if 'default_service_address' in serializer.validated_data:
            update_fields.append('default_service_address')
        user.save(update_fields=update_fields)
        return Response(UserSerializer(user).data)


class PasswordResetRequestAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = (
                f'{settings.PUBLIC_APP_URL.rstrip("/")}/reset-password'
                f'?uid={uid}&token={token}'
            )
            try:
                send_mail(
                    subject='Reset your Luminexa password',
                    message=(
                        'Use the link below to reset your password. '
                        'If you did not request this, you can ignore this email.\n\n'
                        f'{reset_url}'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                pass
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
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValidationError({'detail': 'Invalid reset link.'}) from None
        if not default_token_generator.check_token(user, token):
            raise ValidationError({'detail': 'Invalid or expired reset link.'})
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password updated. You can sign in now.'})
