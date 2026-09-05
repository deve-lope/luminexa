"""Shared image upload validation (size + type)."""

from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

# Keep in sync with ServiceGalleryImage.MAX_BYTES and nginx client_max_body_size.
MAX_IMAGE_BYTES = 3 * 1024 * 1024
MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
}
ALLOWED_CHAT_FILE_EXTENSIONS = {
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.csv',
    '.xls',
    '.xlsx',
}
ALLOWED_CHAT_FILE_CONTENT_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
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


def validate_chat_attachment(uploaded_file, *, field='attachment'):
    """Allow chat images (≤3 MB) or common documents (≤10 MB)."""
    if not uploaded_file:
        raise ValidationError({field: 'Attachment is required.'})

    name = getattr(uploaded_file, 'name', '') or ''
    ext = Path(name).suffix.lower()
    content_type = (getattr(uploaded_file, 'content_type', None) or '').lower()
    size = getattr(uploaded_file, 'size', None)

    is_image = ext in ALLOWED_IMAGE_EXTENSIONS or (
        content_type in ALLOWED_IMAGE_CONTENT_TYPES
    )
    if is_image:
        return validate_uploaded_image(uploaded_file, max_bytes=MAX_IMAGE_BYTES, field=field)

    if size is not None and size > MAX_CHAT_ATTACHMENT_BYTES:
        raise ValidationError({field: 'Each file must be 10 MB or smaller.'})

    if ext and ext not in ALLOWED_CHAT_FILE_EXTENSIONS:
        raise ValidationError({
            field: 'Use an image (JPEG, PNG, WebP, GIF) or a PDF/DOC/XLS/TXT/CSV file.',
        })
    if (
        content_type
        and content_type not in ALLOWED_CHAT_FILE_CONTENT_TYPES
        and not content_type.startswith('text/')
    ):
        raise ValidationError({
            field: 'Use an image (JPEG, PNG, WebP, GIF) or a PDF/DOC/XLS/TXT/CSV file.',
        })

    return uploaded_file


def chat_attachment_is_image(file_field):
    """True when the stored attachment looks like an image by extension."""
    if not file_field or not getattr(file_field, 'name', None):
        return False
    return Path(file_field.name).suffix.lower() in ALLOWED_IMAGE_EXTENSIONS
