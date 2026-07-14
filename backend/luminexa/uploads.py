"""Shared image upload validation (size + type)."""

from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

# Keep in sync with ServiceGalleryImage.MAX_BYTES and nginx client_max_body_size.
MAX_IMAGE_BYTES = 3 * 1024 * 1024
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
}


def validate_uploaded_image(image_file, *, max_bytes=MAX_IMAGE_BYTES, field='image'):
    """Raise DRF ValidationError if the upload is missing, too large, or wrong type."""
    if not image_file:
        raise ValidationError({field: 'Image file is required.'})

    size = getattr(image_file, 'size', None)
    if size is not None and size > max_bytes:
        mb = max_bytes / (1024 * 1024)
        raise ValidationError({field: f'Each image must be {mb:g} MB or smaller.'})

    name = getattr(image_file, 'name', '') or ''
    ext = Path(name).suffix.lower()
    content_type = (getattr(image_file, 'content_type', None) or '').lower()

    if ext and ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError({
            field: 'Use a JPEG, PNG, WebP, or GIF image.',
        })
    if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        # Some browsers omit content_type; only reject when present and wrong.
        raise ValidationError({
            field: 'Use a JPEG, PNG, WebP, or GIF image.',
        })

    return image_file


def validate_uploaded_image_django(image_file, *, max_bytes=MAX_IMAGE_BYTES):
    """Django model/serializer-friendly wrapper."""
    try:
        return validate_uploaded_image(image_file, max_bytes=max_bytes)
    except ValidationError as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            msg = next(iter(detail.values()))
            if isinstance(msg, list):
                msg = msg[0]
            raise DjangoValidationError(str(msg)) from exc
        raise DjangoValidationError(str(detail)) from exc
