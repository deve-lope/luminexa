"""API views for the Gig Wall feature."""

from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.gig_location import visible_gig_posts_for_organization
from businesses.models import OrganizationMembership

from .gig_notifications import (
    notify_new_comment,
    notify_new_gig_quote,
)
from .gig_permissions import can_comment_on_gig, can_quote_on_gig
from .gig_serializers import (
    GigCommentSerializer,
    GigCommentWriteSerializer,
    GigPostImageSerializer,
    GigPostSerializer,
    GigPostWriteSerializer,
    GigQuoteListItemSerializer,
    GigQuoteSerializer,
    GigQuoteWriteSerializer,
)
from .models import (
    GigComment,
    GigPost,
    GigPostImage,
    GigQuote,
)


def _provider_membership(user):
    return (
        OrganizationMembership.objects.filter(
            user=user,
            role__in=[
                OrganizationMembership.Role.OWNER,
                OrganizationMembership.Role.STAFF,
            ],
        )
        .select_related('organization')
        .first()
    )


def _gig_annotations():
    # distinct=True: Count on multiple relations otherwise multiplies via JOINs
    # (e.g. 1 bid + 2 comments → quote_count 2).
    return dict(
        _quote_count=Count(
            'quotes',
            filter=Q(quotes__status__in=GigQuote.active_statuses()),
            distinct=True,
        ),
        _comment_count=Count('comments', distinct=True),
    )


class CustomerGigPostViewSet(viewsets.ModelViewSet):
    """
    Customer Gig Wall:
    - LIST: all open/quoted posts (Reddit-style), with the current user's posts first
    - RETRIEVE: any open/quoted post, or own post in any status
    - CREATE / UPDATE / DELETE: own posts only
    - CLOSE / REOPEN: own posts (status change; not the same as DELETE)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = (
            GigPost.objects.select_related('customer', 'category')
            .prefetch_related('images')
            .annotate(**_gig_annotations())
        )

        if self.action in ('update', 'partial_update', 'destroy', 'close', 'reopen'):
            return base.filter(customer=user).order_by('-created_at')

        if self.action == 'list':
            # Public wall + own history (accepted/closed still visible to author at top)
            return (
                base.filter(
                    Q(status__in=[GigPost.Status.OPEN, GigPost.Status.QUOTED])
                    | Q(customer=user)
                )
                .annotate(
                    _mine=Case(
                        When(customer_id=user.id, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                )
                .order_by('_mine', '-created_at')
            )

        # retrieve (and anything else)
        return base.filter(
            Q(customer=user)
            | Q(status__in=[GigPost.Status.OPEN, GigPost.Status.QUOTED])
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return GigPostWriteSerializer
        return GigPostSerializer

    def perform_create(self, serializer):
        serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return full read serializer so the client gets id + wall fields
        out = GigPostSerializer(serializer.instance, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        post = self.get_object()
        if post.customer_id != request.user.id:
            raise PermissionDenied('You can only edit your own gig posts.')
        if post.status not in (GigPost.Status.OPEN, GigPost.Status.QUOTED):
            raise ValidationError({'detail': 'Only open gigs can be edited.'})
        allowed = {
            'title', 'description', 'category',
            'location_address', 'location_city', 'location_state',
            'location_postal_code', 'search_radius_miles',
        }
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = self.get_serializer(post, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(GigPostSerializer(post, context={'request': request}).data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.customer_id != request.user.id:
            raise PermissionDenied('You can only delete your own gig posts.')
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _serialized_post(self, post):
        obj = (
            GigPost.objects.select_related('customer', 'category')
            .prefetch_related('images')
            .annotate(**_gig_annotations())
            .get(pk=post.pk)
        )
        return GigPostSerializer(obj, context={'request': self.request})

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        """Take the gig off the public wall. Owner can still see it and reopen later."""
        post = self.get_object()
        if post.customer_id != request.user.id:
            raise PermissionDenied('You can only close your own gig posts.')
        if post.status == GigPost.Status.ACCEPTED:
            raise ValidationError({'detail': 'An accepted gig cannot be closed.'})
        if post.status == GigPost.Status.CLOSED:
            raise ValidationError({'detail': 'This gig is already closed.'})
        if post.status not in (GigPost.Status.OPEN, GigPost.Status.QUOTED):
            raise ValidationError({'detail': 'Only open gigs can be closed.'})
        post.status = GigPost.Status.CLOSED
        post.save(update_fields=['status', 'updated_at'])
        return Response(self._serialized_post(post).data)

    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen(self, request, pk=None):
        """Put a closed gig back on the wall. Restores quoted if quotes still exist."""
        post = self.get_object()
        if post.customer_id != request.user.id:
            raise PermissionDenied('You can only reopen your own gig posts.')
        if post.status != GigPost.Status.CLOSED:
            raise ValidationError({'detail': 'Only closed gigs can be reopened.'})
        has_quotes = post.quotes.filter(status__in=GigQuote.active_statuses()).exists()
        post.status = GigPost.Status.QUOTED if has_quotes else GigPost.Status.OPEN
        update_fields = ['status', 'updated_at']
        if post.expires_at and post.expires_at <= timezone.now():
            post.expires_at = timezone.now() + timedelta(days=30)
            update_fields.append('expires_at')
        post.save(update_fields=update_fields)
        return Response(self._serialized_post(post).data)


class ProviderGigWallViewSet(viewsets.ReadOnlyModelViewSet):
    """Providers browse gig posts visible in their service area."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GigPostSerializer

    def get_queryset(self):
        membership = _provider_membership(self.request.user)
        if not membership:
            return GigPost.objects.none()

        status_filter = self.request.query_params.get('status', 'open')
        if status_filter in ('', 'all'):
            base = GigPost.objects.filter(
                status__in=[GigPost.Status.OPEN, GigPost.Status.QUOTED]
            )
        elif status_filter in (
            GigPost.Status.OPEN,
            GigPost.Status.QUOTED,
            GigPost.Status.ACCEPTED,
            GigPost.Status.CLOSED,
        ):
            base = GigPost.objects.filter(status=status_filter)
        else:
            base = GigPost.objects.filter(status=GigPost.Status.OPEN)

        qs = visible_gig_posts_for_organization(membership.organization, base)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        return (
            qs.select_related('customer', 'category')
            .prefetch_related('images')
            .annotate(
                _quote_count=Count(
                    'quotes',
                    filter=Q(quotes__status__in=GigQuote.active_statuses()),
                    distinct=True,
                ),
                _comment_count=Count('comments', distinct=True),
            )
            .order_by('-created_at')
        )

    def retrieve(self, request, *args, **kwargs):
        membership = _provider_membership(request.user)
        post = GigPost.objects.filter(pk=kwargs['pk']).first()
        if not post:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Owner can always retrieve; providers only if the gig is still on the wall
        if post.customer_id == request.user.id:
            serializer = GigPostSerializer(post, context={'request': request})
            return Response(serializer.data)

        if post.status not in (GigPost.Status.OPEN, GigPost.Status.QUOTED):
            raise PermissionDenied('This gig is no longer on the wall.')

        if not membership:
            raise PermissionDenied('Provider access required.')

        visible = visible_gig_posts_for_organization(
            membership.organization,
            GigPost.objects.filter(id=post.id),
        )
        if not visible.exists():
            raise PermissionDenied('This gig is outside your service area.')

        serializer = GigPostSerializer(post, context={'request': request})
        return Response(serializer.data)


class GigPostImageViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, gig_post_id=None):
        post = self._owned_post(request, gig_post_id)
        images = post.images.all()
        return Response(GigPostImageSerializer(images, many=True, context={'request': request}).data)

    def create(self, request, gig_post_id=None):
        post = self._owned_post(request, gig_post_id)
        if post.images.count() >= GigPostImage.MAX_PER_POST:
            raise ValidationError({
                'detail': f'Maximum {GigPostImage.MAX_PER_POST} images per post.',
            })
        serializer = GigPostImageSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        image = serializer.save(gig_post=post, sort_order=post.images.count())
        return Response(
            GigPostImageSerializer(image, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, gig_post_id=None, pk=None):
        post = self._owned_post(request, gig_post_id)
        image = post.images.filter(pk=pk).first()
        if not image:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _owned_post(self, request, gig_post_id):
        post = GigPost.objects.filter(pk=gig_post_id).first()
        if not post:
            raise ValidationError({'detail': 'Gig post not found.'})
        if post.customer_id != request.user.id:
            raise PermissionDenied('You can only manage images on your own posts.')
        return post


class GigCommentViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, gig_post_id=None):
        post = self._accessible_post(request, gig_post_id)
        comments = post.comments.select_related('author', 'organization').order_by('created_at')
        return Response(GigCommentSerializer(comments, many=True).data)

    def create(self, request, gig_post_id=None):
        post = GigPost.objects.filter(pk=gig_post_id).first()
        if not post:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        membership = _provider_membership(request.user)
        org = membership.organization if membership else None

        if not can_comment_on_gig(request.user, post, org):
            raise PermissionDenied('You cannot comment on this gig post.')

        # Providers must pass visibility; customers only on own post
        # (already enforced by can_comment_on_gig)

        serializer = GigCommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = GigComment.objects.create(
            gig_post=post,
            author=request.user,
            organization=org if post.customer_id != request.user.id else None,
            body=serializer.validated_data['body'],
        )
        notify_new_comment(comment)
        return Response(
            GigCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )

    def _accessible_post(self, request, gig_post_id):
        """Anyone signed in can read comments on the public wall; write uses can_comment_on_gig."""
        post = GigPost.objects.filter(pk=gig_post_id).first()
        if not post:
            raise ValidationError({'detail': 'Gig post not found.'})
        if post.customer_id == request.user.id:
            return post
        if post.status in (GigPost.Status.OPEN, GigPost.Status.QUOTED):
            return post
        membership = _provider_membership(request.user)
        if membership:
            visible = visible_gig_posts_for_organization(
                membership.organization,
                GigPost.objects.filter(id=post.id),
            )
            if visible.exists():
                return post
        raise PermissionDenied('Not allowed.')


class GigQuoteViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, gig_post_id=None):
        post = GigPost.objects.filter(pk=gig_post_id).select_related('customer').first()
        if not post:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        membership = _provider_membership(request.user)

        if post.customer_id == request.user.id:
            # Customer sees all non-withdrawn quotes, lowest price first
            quotes = (
                post.quotes.exclude(status=GigQuote.Status.WITHDRAWN)
                .select_related('organization', 'gig_post', 'gig_post__customer')
                .order_by('price', 'created_at')
            )
            return Response(
                GigQuoteSerializer(quotes, many=True, context={'request': request}).data
            )

        if not membership:
            raise PermissionDenied('Not allowed.')

        # Providers only see their own quote
        quotes = (
            post.quotes.filter(organization=membership.organization)
            .select_related('organization', 'gig_post', 'gig_post__customer')
            .order_by('price', 'created_at')
        )
        return Response(
            GigQuoteSerializer(quotes, many=True, context={'request': request}).data
        )

    def create(self, request, gig_post_id=None):
        post = GigPost.objects.filter(pk=gig_post_id).first()
        if not post:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        membership = _provider_membership(request.user)
        if not membership:
            raise PermissionDenied('You must be a provider to submit bids.')

        if not can_quote_on_gig(request.user, membership.organization, post):
            raise PermissionDenied('You cannot bid on this gig post.')

        if GigQuote.objects.filter(
            gig_post=post, organization=membership.organization
        ).filter(status__in=GigQuote.active_statuses()).exists():
            raise ValidationError({'detail': 'You already submitted a bid for this gig.'})

        # Allow re-quote after withdraw/reject by updating the existing row
        existing = GigQuote.objects.filter(
            gig_post=post, organization=membership.organization
        ).first()

        serializer = GigQuoteWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if existing and existing.status in (
            GigQuote.Status.WITHDRAWN,
            GigQuote.Status.REJECTED,
        ):
            for attr, value in serializer.validated_data.items():
                setattr(existing, attr, value)
            existing.status = GigQuote.Status.SUBMITTED
            existing.submitted_by = request.user
            existing.counter_price = None
            existing.counter_message = ''
            existing.countered_at = None
            existing.save()
            quote = existing
        else:
            quote = GigQuote.objects.create(
                gig_post=post,
                organization=membership.organization,
                submitted_by=request.user,
                **serializer.validated_data,
            )

        if post.status == GigPost.Status.OPEN:
            post.status = GigPost.Status.QUOTED
            post.save(update_fields=['status', 'updated_at'])

        notify_new_gig_quote(quote)
        return Response(
            GigQuoteSerializer(quote, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, gig_post_id=None, pk=None):
        post = GigPost.objects.filter(pk=gig_post_id).first()
        if not post:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        quote = (
            GigQuote.objects.filter(pk=pk, gig_post_id=gig_post_id)
            .select_related('organization', 'gig_post', 'gig_post__customer')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        membership = _provider_membership(request.user)
        is_owner = post.customer_id == request.user.id
        is_bidder = bool(
            membership and membership.organization_id == quote.organization_id
        )
        if not is_owner and not is_bidder:
            raise PermissionDenied('Not allowed.')

        data = GigQuoteSerializer(quote, context={'request': request}).data
        data['gig_post'] = {
            'id': post.id,
            'title': post.title,
            'status': post.status,
            'customer_name': (
                post.customer.get_full_name()
                or post.customer.email
                or 'Customer'
            ),
        }
        return Response(data)

    def partial_update(self, request, gig_post_id=None, pk=None):
        quote = self._own_quote(request, gig_post_id, pk)
        if quote.status not in (GigQuote.Status.SUBMITTED, GigQuote.Status.COUNTERED):
            raise ValidationError({'detail': 'Only open bids can be edited.'})
        serializer = GigQuoteWriteSerializer(quote, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Editing price while countered cancels the counter and resubmits.
        if quote.status == GigQuote.Status.COUNTERED:
            quote.status = GigQuote.Status.SUBMITTED
            quote.counter_price = None
            quote.counter_message = ''
            quote.countered_at = None
            quote.save(
                update_fields=[
                    'status',
                    'counter_price',
                    'counter_message',
                    'countered_at',
                    'updated_at',
                ]
            )
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)

    def destroy(self, request, gig_post_id=None, pk=None):
        from .gig_quote_services import refresh_gig_post_quote_status

        quote = self._own_quote(request, gig_post_id, pk)
        if quote.status not in (GigQuote.Status.SUBMITTED, GigQuote.Status.COUNTERED):
            raise ValidationError({'detail': 'Only open bids can be withdrawn.'})
        quote.status = GigQuote.Status.WITHDRAWN
        quote.counter_price = None
        quote.counter_message = ''
        quote.countered_at = None
        quote.save(
            update_fields=[
                'status',
                'counter_price',
                'counter_message',
                'countered_at',
                'updated_at',
            ]
        )
        refresh_gig_post_quote_status(quote.gig_post)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _own_quote(self, request, gig_post_id, pk):
        membership = _provider_membership(request.user)
        if not membership:
            raise PermissionDenied('Provider access required.')
        quote = GigQuote.objects.filter(
            pk=pk,
            gig_post_id=gig_post_id,
            organization=membership.organization,
        ).select_related('organization', 'gig_post').first()
        if not quote:
            raise ValidationError({'detail': 'Bid not found.'})
        return quote


class GigQuoteAcceptAPIView(APIView):
    """Customer accepts a bid on their gig post."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .gig_quote_services import accept_gig_quote

        quote = (
            GigQuote.objects.filter(pk=quote_id, gig_post_id=gig_post_id)
            .select_related('organization', 'gig_post')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        quote = accept_gig_quote(quote, customer=request.user)
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)


class GigQuoteRejectAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .gig_quote_services import reject_gig_quote

        quote = (
            GigQuote.objects.filter(pk=quote_id, gig_post_id=gig_post_id)
            .select_related('organization', 'gig_post')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        quote = reject_gig_quote(quote, customer=request.user)
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)


class GigQuoteCounterAPIView(APIView):
    """Customer proposes a different price."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .gig_quote_services import counter_gig_quote

        quote = (
            GigQuote.objects.filter(pk=quote_id, gig_post_id=gig_post_id)
            .select_related('organization', 'gig_post')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        quote = counter_gig_quote(
            quote,
            customer=request.user,
            price=request.data.get('price'),
            message=request.data.get('message', ''),
        )
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)


class GigQuoteAcceptCounterAPIView(APIView):
    """Provider accepts the customer's counter-price."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .gig_quote_services import accept_gig_quote_counter

        membership = _provider_membership(request.user)
        if not membership:
            raise PermissionDenied('Provider access required.')
        quote = (
            GigQuote.objects.filter(
                pk=quote_id,
                gig_post_id=gig_post_id,
                organization=membership.organization,
            )
            .select_related('organization', 'gig_post', 'gig_post__customer')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        quote = accept_gig_quote_counter(quote, organization=membership.organization)
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)


class GigQuoteDeclineCounterAPIView(APIView):
    """Provider declines counter — original bid stays open."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .gig_quote_services import decline_gig_quote_counter

        membership = _provider_membership(request.user)
        if not membership:
            raise PermissionDenied('Provider access required.')
        quote = (
            GigQuote.objects.filter(
                pk=quote_id,
                gig_post_id=gig_post_id,
                organization=membership.organization,
            )
            .select_related('organization', 'gig_post')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        quote = decline_gig_quote_counter(quote, organization=membership.organization)
        return Response(GigQuoteSerializer(quote, context={'request': request}).data)


class GigQuoteConversationAPIView(APIView):
    """Open (or create) a chat thread for this gig bid — no prior customer link required."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, gig_post_id, quote_id):
        from .message_services import get_or_create_conversation, post_conversation_message

        quote = (
            GigQuote.objects.filter(pk=quote_id, gig_post_id=gig_post_id)
            .select_related('organization', 'gig_post', 'gig_post__customer')
            .first()
        )
        if not quote:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        post = quote.gig_post
        membership = _provider_membership(request.user)
        is_owner = post.customer_id == request.user.id
        is_bidder = bool(
            membership and membership.organization_id == quote.organization_id
        )
        if not is_owner and not is_bidder:
            raise PermissionDenied('Not allowed.')

        conv = get_or_create_conversation(
            organization=quote.organization,
            customer=post.customer,
        )

        # Seed a context message once if the thread is empty.
        if not conv.messages.exists():
            post_conversation_message(
                conversation=conv,
                sender=request.user,
                body=(
                    f'Re: gig "{post.title}" — bid ${quote.price}'
                    + (
                        f' (counter ${quote.counter_price})'
                        if quote.counter_price is not None
                        else ''
                    )
                ),
            )

        return Response({
            'conversation_id': conv.id,
            'organization_slug': quote.organization.slug,
            'organization_name': quote.organization.name,
        })


class ProviderMyQuotesAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = _provider_membership(request.user)
        if not membership:
            raise PermissionDenied('Provider access required.')

        qs = (
            GigQuote.objects.filter(organization=membership.organization)
            .select_related('organization', 'gig_post', 'gig_post__customer')
            .order_by('-created_at')
        )
        status_filter = request.query_params.get('status')
        if status_filter in (
            'submitted',
            'countered',
            'accepted',
            'rejected',
            'withdrawn',
        ):
            qs = qs.filter(status=status_filter)

        return Response(
            GigQuoteListItemSerializer(qs, many=True, context={'request': request}).data
        )
