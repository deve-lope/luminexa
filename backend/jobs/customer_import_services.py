"""Provider CSV import of existing customers into My customers (OrganizationMembership)."""

from __future__ import annotations

import csv
import io
import re
from typing import Any

from django.db import transaction
from rest_framework.exceptions import ValidationError

from accounts.models import User
from accounts.otp import normalize_email
from businesses.models import Organization, OrganizationMembership

from .booking_services import ensure_customer_membership

MAX_IMPORT_ROWS = 500
TEMPLATE_HEADERS = ('full_name', 'email', 'phone', 'provider_notes')
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

HINT_TEMPLATE = (
    'Download the CSV template, keep the header row '
    '(full_name, email, phone, provider_notes), and save as CSV (UTF-8).'
)


def import_template_csv() -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(TEMPLATE_HEADERS)
    writer.writerow(['Jane Doe', 'jane@example.com', '555-0100', 'VIP — prefers mornings'])
    return buf.getvalue().encode('utf-8')


def _decode_upload(raw: bytes) -> str:
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
    for encoding in ('utf-8', 'utf-8-sig', 'cp1252', 'latin-1'):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValidationError({
        'file': (
            'Could not read this file as text. '
            f'In Excel use File → Save As → CSV UTF-8. {HINT_TEMPLATE}'
        ),
    })


def _pick_field(row: dict, *keys: str) -> str:
    lower = {str(k).strip().lower(): (v or '').strip() if v is not None else '' for k, v in row.items()}
    for key in keys:
        if key in lower and lower[key]:
            return lower[key]
    return ''


def _parse_rows(text: str) -> list[dict[str, str]]:
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ValidationError({
            'file': f'CSV must include a header row. {HINT_TEMPLATE}',
        })
    headers = [str(h or '').strip().lower() for h in reader.fieldnames]
    if 'email' not in headers and 'e-mail' not in headers:
        raise ValidationError({
            'file': (
                'Missing an email column. Rename your email column to "email", '
                f'or use the template. {HINT_TEMPLATE}'
            ),
        })
    if 'full_name' not in headers and 'name' not in headers and 'customer' not in headers:
        raise ValidationError({
            'file': (
                'Missing a name column. Add "full_name" (or "name"), '
                f'or use the template. {HINT_TEMPLATE}'
            ),
        })
    rows = []
    for row in reader:
        if row is None:
            continue
        if not any((v or '').strip() for v in row.values() if v is not None):
            continue
        rows.append(row)
        if len(rows) > MAX_IMPORT_ROWS:
            raise ValidationError({
                'file': (
                    f'This file has more than {MAX_IMPORT_ROWS} customer rows. '
                    f'Split into smaller CSV files (max {MAX_IMPORT_ROWS} each) and import separately.'
                ),
            })
    if not rows:
        raise ValidationError({
            'file': (
                'No customer rows found under the header. '
                f'Add at least one row with full_name and email. {HINT_TEMPLATE}'
            ),
        })
    return rows


def _fill_blank_user_fields(user: User, *, full_name: str, phone: str) -> list[str]:
    updates = []
    if full_name and not (user.full_name or '').strip():
        user.full_name = full_name[:255]
        updates.append('full_name')
    if phone and not (user.phone or '').strip():
        user.phone = phone[:32]
        updates.append('phone')
    if updates:
        user.save(update_fields=updates)
    return updates


def _row_error(row: int, email: str, detail: str, fix: str) -> dict[str, Any]:
    return {'row': row, 'email': email or '', 'detail': detail, 'fix': fix}


def _analyze_rows(*, organization: Organization, rows: list[dict]) -> dict[str, Any]:
    """Classify each row without writing (preview / dry-run)."""
    will_create = 0
    will_link = 0
    will_skip = 0
    errors: list[dict[str, Any]] = []
    preview: list[dict[str, str]] = []
    seen_emails: set[str] = set()

    for index, row in enumerate(rows, start=2):
        email_raw = _pick_field(row, 'email', 'e-mail', 'email address')
        full_name = _pick_field(row, 'full_name', 'name', 'customer name', 'customer')
        phone = _pick_field(row, 'phone', 'mobile', 'phone number', 'tel')
        notes = _pick_field(row, 'provider_notes', 'notes', 'note')

        email = normalize_email(email_raw)
        if not email or not _EMAIL_RE.match(email):
            errors.append(_row_error(
                index,
                email_raw,
                'Invalid or missing email.',
                'Use a full address like name@example.com in the email column.',
            ))
            will_skip += 1
            continue
        if not full_name:
            errors.append(_row_error(
                index,
                email,
                'Missing name.',
                'Put the customer’s name in the full_name (or name) column.',
            ))
            will_skip += 1
            continue
        if email in seen_emails:
            errors.append(_row_error(
                index,
                email,
                'Duplicate email in this CSV.',
                'Keep only one row per email address.',
            ))
            will_skip += 1
            continue
        seen_emails.add(email)

        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            staff_role = OrganizationMembership.objects.filter(
                organization=organization,
                user=existing,
                role__in=(
                    OrganizationMembership.Role.OWNER,
                    OrganizationMembership.Role.STAFF,
                ),
            ).exists()
            if staff_role:
                errors.append(_row_error(
                    index,
                    email,
                    'This email is staff on this business.',
                    'Use a different customer email, or remove this row.',
                ))
                will_skip += 1
                continue
            will_link += 1
            action = 'link'
        else:
            will_create += 1
            action = 'create'

        if len(preview) < 8:
            preview.append({
                'full_name': full_name[:80],
                'email': email,
                'phone': phone[:32],
                'action': action,
                'notes': bool(notes),
            })

    ready = will_create + will_link
    return {
        'ready_count': ready,
        'will_create': will_create,
        'will_link': will_link,
        'will_skip': will_skip,
        'row_count': len(rows),
        'preview': preview,
        'errors': errors[:50],
        'error_count': len(errors),
        'max_rows': MAX_IMPORT_ROWS,
        'can_import': ready > 0,
    }


def preview_customers_from_csv(*, organization: Organization, file_bytes: bytes) -> dict[str, Any]:
    text = _decode_upload(file_bytes)
    rows = _parse_rows(text)
    result = _analyze_rows(organization=organization, rows=rows)
    result['dry_run'] = True
    return result


@transaction.atomic
def import_customers_from_csv(*, organization: Organization, file_bytes: bytes) -> dict[str, Any]:
    text = _decode_upload(file_bytes)
    rows = _parse_rows(text)
    preview = _analyze_rows(organization=organization, rows=rows)
    if preview['ready_count'] < 1:
        return {
            'ok': False,
            'file': (
                'No valid customers to import. Fix the row issues listed below, '
                f'or download the template and try again. {HINT_TEMPLATE}'
            ),
            'errors': preview['errors'],
            'error_count': preview['error_count'],
            'created': 0,
            'linked': 0,
            'skipped': preview['will_skip'],
            'dry_run': False,
        }

    created = 0
    linked = 0
    skipped = 0
    errors: list[dict[str, Any]] = []
    seen_emails: set[str] = set()

    for index, row in enumerate(rows, start=2):
        email_raw = _pick_field(row, 'email', 'e-mail', 'email address')
        full_name = _pick_field(row, 'full_name', 'name', 'customer name', 'customer')
        phone = _pick_field(row, 'phone', 'mobile', 'phone number', 'tel')
        notes = _pick_field(row, 'provider_notes', 'notes', 'note')

        email = normalize_email(email_raw)
        if not email or not _EMAIL_RE.match(email):
            errors.append(_row_error(
                index, email_raw, 'Invalid or missing email.',
                'Use a full address like name@example.com in the email column.',
            ))
            skipped += 1
            continue
        if not full_name:
            errors.append(_row_error(
                index, email, 'Missing name.',
                'Put the customer’s name in the full_name (or name) column.',
            ))
            skipped += 1
            continue
        if email in seen_emails:
            errors.append(_row_error(
                index, email, 'Duplicate email in this CSV.',
                'Keep only one row per email address.',
            ))
            skipped += 1
            continue
        seen_emails.add(email)

        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            staff_role = OrganizationMembership.objects.filter(
                organization=organization,
                user=existing,
                role__in=(
                    OrganizationMembership.Role.OWNER,
                    OrganizationMembership.Role.STAFF,
                ),
            ).exists()
            if staff_role:
                errors.append(_row_error(
                    index, email, 'This email is staff on this business.',
                    'Use a different customer email, or remove this row.',
                ))
                skipped += 1
                continue

            already = OrganizationMembership.objects.filter(
                organization=organization,
                user=existing,
                role=OrganizationMembership.Role.CUSTOMER,
            ).first()
            _fill_blank_user_fields(existing, full_name=full_name, phone=phone)
            if already:
                if notes and not (already.provider_notes or '').strip():
                    already.provider_notes = notes[:5000]
                    already.save(update_fields=['provider_notes'])
                linked += 1
                continue

            membership = ensure_customer_membership(organization, existing, approve=True)
            if notes:
                membership.provider_notes = notes[:5000]
                membership.save(update_fields=['provider_notes'])
            linked += 1
            continue

        user = User.objects.create_user(
            email=email,
            full_name=full_name[:255],
            password=None,
            phone=(phone[:32] if phone else ''),
            email_verified=False,
        )
        membership = ensure_customer_membership(organization, user, approve=True)
        if notes:
            membership.provider_notes = notes[:5000]
            membership.save(update_fields=['provider_notes'])
        created += 1

    return {
        'created': created,
        'linked': linked,
        'skipped': skipped,
        'errors': errors[:50],
        'error_count': len(errors),
        'max_rows': MAX_IMPORT_ROWS,
        'dry_run': False,
    }
