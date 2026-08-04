/** Build “add to calendar” links from a booking payload. */

/** UTC compact form: 20240115T180000Z */
export function toUtcStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** ISO-8601 without ms for Outlook deeplinks. */
export function toOutlookIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function bookingCalendarFields(booking) {
  const title = [booking.service_name, booking.organization_name].filter(Boolean).join(' — ');
  const location = booking.job_location || booking.service_address || '';
  const ref = booking.reference || (booking.id != null ? `BK-${String(booking.id).padStart(5, '0')}` : '');
  const details = [
    ref ? `Reference: ${ref}` : '',
    booking.organization_name ? `Provider: ${booking.organization_name}` : '',
    booking.customer_notes ? `Notes: ${booking.customer_notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    title: title || 'Appointment',
    location,
    details,
    startAt: booking.start_at,
    endAt: booking.end_at,
  };
}

export function googleCalendarUrl(booking) {
  const { title, location, details, startAt, endAt } = bookingCalendarFields(booking);
  const start = toUtcStamp(startAt);
  const end = toUtcStamp(endAt);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(booking, { office = false } = {}) {
  const { title, location, details, startAt, endAt } = bookingCalendarFields(booking);
  const start = toOutlookIso(startAt);
  const end = toOutlookIso(endAt);
  if (!start || !end) return null;
  const host = office ? 'outlook.office.com' : 'outlook.live.com';
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: start,
    enddt: end,
    body: details,
    location,
  });
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}

export function yahooCalendarUrl(booking) {
  const { title, location, details, startAt, endAt } = bookingCalendarFields(booking);
  const start = toUtcStamp(startAt);
  const end = toUtcStamp(endAt);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    v: '60',
    title,
    st: start,
    et: end,
    desc: details,
    in_loc: location,
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/** Options shown in the Add to calendar picker. */
export function calendarProviderOptions(booking, icalUrl) {
  const google = googleCalendarUrl(booking);
  const outlook = outlookCalendarUrl(booking);
  const office = outlookCalendarUrl(booking, { office: true });
  const yahoo = yahooCalendarUrl(booking);
  return [
    google && { id: 'google', label: 'Google Calendar', href: google, external: true },
    { id: 'apple', label: 'Apple Calendar', href: icalUrl, download: true },
    outlook && { id: 'outlook', label: 'Outlook (personal)', href: outlook, external: true },
    office && { id: 'office', label: 'Outlook / Microsoft 365', href: office, external: true },
    yahoo && { id: 'yahoo', label: 'Yahoo Calendar', href: yahoo, external: true },
    { id: 'ics', label: 'Download .ics file', href: icalUrl, download: true },
  ].filter(Boolean);
}
