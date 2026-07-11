"""Professional single-page invoice PDF (no third-party PDF dependency)."""

from __future__ import annotations

from decimal import Decimal
from io import BytesIO
import re


PAGE_W = 612
PAGE_H = 792
MARGIN_L = 48
MARGIN_R = 48
MARGIN_T = 48
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R


def _escape(text: str) -> str:
    return (
        (text or '')
        .replace('\\', '\\\\')
        .replace('(', '\\(')
        .replace(')', '\\)')
    )


def _fmt_money(amount, currency: str = 'CAD') -> str:
    try:
        value = Decimal(amount or 0).quantize(Decimal('0.01'))
    except Exception:
        value = Decimal('0.00')
    return f'{currency} {value:,.2f}'


def _fmt_tax_rate(rate) -> str:
    """Compact percent label, e.g. 13% or 9.975%."""
    if rate is None:
        return ''
    try:
        pct = (Decimal(str(rate)) * 100).quantize(Decimal('0.001'))
        if pct == pct.to_integral_value():
            return f'{int(pct)}%'
        text = format(pct.normalize(), 'f')
        return f'{text}%'
    except Exception:
        return ''


def _tax_row_label(tax_line: dict) -> str:
    """Short invoice label: prefer code + rate (avoids overlap with amounts)."""
    code = (tax_line.get('code') or '').strip().upper()
    name = (tax_line.get('name') or '').strip()
    base = code or (name.split('(')[0].strip() if name else 'Tax') or 'Tax'
    rate_label = _fmt_tax_rate(tax_line.get('rate'))
    if rate_label:
        return f'{base} ({rate_label})'
    return base[:28]


def _approx_text_width(text: str, size: float) -> float:
    """Rough Helvetica width; good enough for right-aligning money columns."""
    width = 0.0
    for ch in text or '':
        if ch in 'ilI.,:;|!\' ':
            width += 0.28
        elif ch in 'mwMW@%':
            width += 0.78
        elif ch.isupper():
            width += 0.62
        else:
            width += 0.52
    return width * size


def _format_postal(code: str) -> str:
    raw = re.sub(r'[\s-]+', '', (code or '').upper())
    if re.fullmatch(r'[A-Z]\d[A-Z]\d[A-Z]\d', raw):
        return f'{raw[:3]} {raw[3:]}'
    return code or ''


def _format_service_address(raw: str) -> list[str]:
    """Turn labeled storage into human-readable address lines."""
    text = (raw or '').strip()
    if not text:
        return []

    labels = (
        'Country', 'Province', 'City', 'Address 1', 'Address 2', 'Postal code',
    )
    label_re = re.compile(
        r'(' + '|'.join(re.escape(l) for l in labels) + r')\s*:\s*',
        re.IGNORECASE,
    )
    if label_re.search(text):
        hits = list(label_re.finditer(text))
        fields = {}
        for i, hit in enumerate(hits):
            end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
            fields[hit.group(1).lower()] = text[hit.end():end].strip()

        lines = []
        a1 = fields.get('address 1', '')
        a2 = fields.get('address 2', '')
        if a1:
            lines.append(a1)
        if a2:
            street_num = re.match(r'^(\d+[A-Za-z]?)', a1 or '')
            if not (street_num and a2 == street_num.group(1)) and a2.lower() not in a1.lower():
                lines.append(a2)
        city = fields.get('city', '')
        province = fields.get('province', '')
        postal = _format_postal(fields.get('postal code', ''))
        city_line = ', '.join(p for p in (city, province) if p)
        if postal:
            city_line = f'{city_line} {postal}'.strip() if city_line else postal
        if city_line:
            lines.append(city_line)
        country = fields.get('country', '')
        if country:
            lines.append(country)
        return lines or [text]

    return [ln.strip() for ln in text.splitlines() if ln.strip()] or [text]


def _wrap(text: str, max_chars: int) -> list[str]:
    words = (text or '').split()
    if not words:
        return ['']
    lines = []
    current = words[0]
    for word in words[1:]:
        trial = f'{current} {word}'
        if len(trial) <= max_chars:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class _PdfCanvas:
    def __init__(self):
        self.ops: list[str] = []
        self.y = PAGE_H - MARGIN_T

    def set_fill_gray(self, g: float):
        self.ops.append(f'{g:.3f} g')

    def set_stroke_gray(self, g: float):
        self.ops.append(f'{g:.3f} G')

    def set_fill_rgb(self, r: float, g: float, b: float):
        self.ops.append(f'{r:.3f} {g:.3f} {b:.3f} rg')

    def set_stroke_rgb(self, r: float, g: float, b: float):
        self.ops.append(f'{r:.3f} {g:.3f} {b:.3f} RG')

    def rect(self, x, y, w, h, fill=False, stroke=False):
        mode = 'n'
        if fill and stroke:
            mode = 'B'
        elif fill:
            mode = 'f'
        elif stroke:
            mode = 'S'
        self.ops.append(f'{x:.2f} {y:.2f} {w:.2f} {h:.2f} re {mode}')

    def line(self, x1, y1, x2, y2, width=1.0):
        self.ops.append(f'{width:.2f} w')
        self.ops.append(f'{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S')

    def text(self, x, y, value, *, size=10, bold=False, color=None):
        font = 'F2' if bold else 'F1'
        if color:
            self.set_fill_rgb(*color)
        else:
            self.set_fill_rgb(0.12, 0.14, 0.18)
        safe = _escape(value)
        self.ops.append('BT')
        self.ops.append(f'/{font} {size} Tf')
        self.ops.append(f'1 0 0 1 {x:.2f} {y:.2f} Tm ({safe}) Tj')
        self.ops.append('ET')

    def text_right(self, right_x, y, value, *, size=10, bold=False, color=None):
        width = _approx_text_width(value, size)
        self.text(right_x - width, y, value, size=size, bold=bold, color=color)

    def ensure(self, needed: float):
        if self.y - needed < 56:
            self.y = 56  # keep on one page; clip soft

    def gap(self, amount: float):
        self.y -= amount


def build_invoice_pdf(invoice) -> bytes:
    """Return a professional single-page PDF for the given Invoice instance."""
    booking = invoice.booking
    org = booking.organization
    customer = booking.customer
    service_name = invoice.description or (
        booking.service.name if booking.service_id else 'Service'
    )
    currency = invoice.currency or 'CAD'
    issued = invoice.issued_at.strftime('%b %d, %Y') if invoice.issued_at else ''
    service_when = (
        booking.start_at.strftime('%b %d, %Y · %I:%M %p') if booking.start_at else ''
    )
    ref = f'BK-{booking.pk:05d}'
    status = invoice.get_status_display()
    subtotal = invoice.subtotal if invoice.subtotal is not None else invoice.amount
    discount = Decimal('0.00')

    biz_lines = []
    if org.service_address:
        biz_lines.extend(_format_service_address(org.service_address)[:2])
    city_bits = [org.service_city, org.service_state, _format_postal(org.service_postal_code or '')]
    city_line = ', '.join(p for p in city_bits if p)
    if city_line:
        biz_lines.append(city_line)

    bill_to = [customer.full_name or customer.email or 'Customer']
    if customer.email:
        bill_to.append(customer.email)
    if getattr(customer, 'phone', None):
        bill_to.append(customer.phone)

    service_addr_lines = _format_service_address(booking.service_address or '')

    c = _PdfCanvas()
    right = PAGE_W - MARGIN_R

    # Accent bar
    c.set_fill_rgb(0.05, 0.45, 0.48)  # teal
    c.rect(0, PAGE_H - 8, PAGE_W, 8, fill=True)

    # Header: provider left, INVOICE right
    c.text(MARGIN_L, c.y - 8, org.name or 'Service Provider', size=16, bold=True)
    c.text_right(right, c.y - 6, 'INVOICE', size=22, bold=True, color=(0.05, 0.45, 0.48))
    c.gap(22)

    for line in biz_lines[:3]:
        c.text(MARGIN_L, c.y, line, size=9, color=(0.35, 0.38, 0.42))
        c.gap(12)

    meta_y = PAGE_H - MARGIN_T - 28
    c.text_right(right, meta_y - 14, f'Invoice #  {invoice.number}', size=10, bold=True)
    c.text_right(right, meta_y - 28, f'Date  {issued}', size=9, color=(0.35, 0.38, 0.42))
    c.text_right(right, meta_y - 42, f'Status  {status}', size=9, color=(0.35, 0.38, 0.42))
    c.text_right(right, meta_y - 56, f'Booking  {ref}', size=9, color=(0.35, 0.38, 0.42))

    c.y = min(c.y, meta_y - 70)
    c.gap(8)
    c.set_stroke_rgb(0.85, 0.88, 0.90)
    c.line(MARGIN_L, c.y, right, c.y, width=1)
    c.gap(18)

    # Bill to + service date
    col2_x = MARGIN_L + CONTENT_W * 0.55
    c.text(MARGIN_L, c.y, 'BILL TO', size=8, bold=True, color=(0.45, 0.48, 0.52))
    c.text(col2_x, c.y, 'SERVICE DATE', size=8, bold=True, color=(0.45, 0.48, 0.52))
    c.gap(14)
    left_y = c.y
    for line in bill_to:
        c.text(MARGIN_L, left_y, line, size=10, bold=(line == bill_to[0]))
        left_y -= 13
    right_y = c.y
    if service_when:
        c.text(col2_x, right_y, service_when, size=10)
        right_y -= 13
    if invoice.tax_region:
        region = (
            f'{invoice.tax_country}-{invoice.tax_region}'
            if invoice.tax_country
            else invoice.tax_region
        )
        c.text(col2_x, right_y, f'Tax region: {region}', size=9, color=(0.45, 0.48, 0.52))
        right_y -= 12

    c.y = min(left_y, right_y) - 6

    if service_addr_lines:
        c.gap(6)
        c.text(MARGIN_L, c.y, 'SERVICE LOCATION', size=8, bold=True, color=(0.45, 0.48, 0.52))
        c.gap(13)
        for line in service_addr_lines:
            for wrapped in _wrap(line, 70):
                c.text(MARGIN_L, c.y, wrapped, size=10)
                c.gap(12)

    c.gap(10)
    c.set_stroke_rgb(0.85, 0.88, 0.90)
    c.line(MARGIN_L, c.y, right, c.y, width=1)
    c.gap(16)

    # Table header
    row_h = 22
    c.set_fill_rgb(0.94, 0.96, 0.97)
    c.rect(MARGIN_L, c.y - 6, CONTENT_W, row_h, fill=True)
    header_y = c.y + 1
    c.text(MARGIN_L + 8, header_y, 'DESCRIPTION', size=8, bold=True, color=(0.35, 0.38, 0.42))
    c.text(MARGIN_L + 300, header_y, 'QTY', size=8, bold=True, color=(0.35, 0.38, 0.42))
    c.text(MARGIN_L + 350, header_y, 'RATE', size=8, bold=True, color=(0.35, 0.38, 0.42))
    c.text_right(right - 8, header_y, 'AMOUNT', size=8, bold=True, color=(0.35, 0.38, 0.42))
    c.gap(row_h + 4)

    # Line item
    rate = subtotal
    qty = 1
    desc_lines = _wrap(service_name, 42)
    item_top = c.y
    for i, line in enumerate(desc_lines):
        c.text(MARGIN_L + 8, c.y, line, size=10, bold=(i == 0))
        c.gap(13)
    # qty / rate / amount on first description row
    first_row_y = item_top
    c.text(MARGIN_L + 305, first_row_y, str(qty), size=10)
    c.text(MARGIN_L + 350, first_row_y, _fmt_money(rate, currency), size=10)
    c.text_right(right - 8, first_row_y, _fmt_money(rate, currency), size=10, bold=True)

    if invoice.pricing_type == 'range' and invoice.estimated_amount is not None:
        est = _fmt_money(invoice.estimated_amount, currency)
        if invoice.estimated_max is not None:
            est = f'{est} – {_fmt_money(invoice.estimated_max, currency)}'
        c.text(MARGIN_L + 8, c.y, f'Estimated range: {est}', size=8, color=(0.45, 0.48, 0.52))
        c.gap(12)

    c.gap(6)
    c.set_stroke_rgb(0.85, 0.88, 0.90)
    c.line(MARGIN_L, c.y, right, c.y, width=0.8)
    c.gap(18)

    # Totals block — fixed amount column so long tax names never collide
    amount_col_w = 100
    totals_x_value = right - 8
    totals_x_label = right - amount_col_w - 12
    label_max_chars = 22
    rows = [
        ('Subtotal', _fmt_money(subtotal, currency), False),
        ('Discount', _fmt_money(discount, currency), False),
    ]
    for tax_line in (invoice.tax_lines or []):
        rows.append((
            _tax_row_label(tax_line),
            _fmt_money(tax_line.get('amount'), currency),
            False,
        ))
    if invoice.tax_total is not None and not (invoice.tax_lines or []):
        rows.append(('Tax', _fmt_money(invoice.tax_total, currency), False))
    rows.append(('Total', _fmt_money(invoice.amount, currency), True))

    for label, value, is_total in rows:
        shown = label if len(label) <= label_max_chars else f'{label[: label_max_chars - 1]}…'
        if is_total:
            c.gap(4)
            c.set_stroke_rgb(0.05, 0.45, 0.48)
            c.line(totals_x_label - 8, c.y + 12, right, c.y + 12, width=1.2)
            c.text(totals_x_label, c.y, shown, size=11, bold=True)
            c.text_right(totals_x_value, c.y, value, size=12, bold=True, color=(0.05, 0.45, 0.48))
        else:
            c.text(totals_x_label, c.y, shown, size=10, color=(0.35, 0.38, 0.42))
            c.text_right(totals_x_value, c.y, value, size=10)
        c.gap(16)

    # Notes / paid
    c.gap(10)
    if invoice.notes:
        c.text(MARGIN_L, c.y, 'NOTES', size=8, bold=True, color=(0.45, 0.48, 0.52))
        c.gap(13)
        for wrapped in _wrap(invoice.notes, 78):
            c.text(MARGIN_L, c.y, wrapped, size=9)
            c.gap(12)
        c.gap(6)

    if invoice.paid_at:
        c.text(
            MARGIN_L,
            c.y,
            f'Paid on {invoice.paid_at.strftime("%b %d, %Y")}',
            size=10,
            bold=True,
            color=(0.05, 0.45, 0.48),
        )
        c.gap(16)
    elif invoice.status == invoice.Status.ISSUED:
        c.text(MARGIN_L, c.y, 'Payment due upon receipt.', size=9, color=(0.35, 0.38, 0.42))
        c.gap(16)

    # Footer
    c.set_stroke_rgb(0.85, 0.88, 0.90)
    c.line(MARGIN_L, 52, right, 52, width=0.8)
    c.text(MARGIN_L, 36, 'Thank you for your business.', size=9, color=(0.35, 0.38, 0.42))
    c.text_right(right, 36, 'Powered by Luminexa', size=8, color=(0.55, 0.58, 0.62))

    stream = '\n'.join(c.ops).encode('latin-1', errors='replace')

    objects: list[bytes] = []
    objects.append(b'<< /Type /Catalog /Pages 2 0 R >>')
    objects.append(b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
    objects.append(
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        b'/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>'
    )
    objects.append(b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream')
    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

    out = BytesIO()
    out.write(b'%PDF-1.4\n')
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f'{i} 0 obj\n'.encode('ascii'))
        out.write(obj)
        out.write(b'\nendobj\n')
    xref_pos = out.tell()
    out.write(f'xref\n0 {len(objects) + 1}\n'.encode('ascii'))
    out.write(b'0000000000 65535 f \n')
    for off in offsets[1:]:
        out.write(f'{off:010d} 00000 n \n'.encode('ascii'))
    out.write(
        f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
        f'startxref\n{xref_pos}\n%%EOF\n'.encode('ascii')
    )
    return out.getvalue()
