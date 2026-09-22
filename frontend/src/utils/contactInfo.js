/** Detect email / phone in Gig Wall free text (mirrors backend gig_public). */

export const CONTACT_INFO_ERROR =
  'Remove phone numbers and email addresses. Providers will contact you privately after you accept a quote.';

export const CONTACT_HINT =
  "Don't share phone or email here — providers ask privately.";

const EMAIL_RE = /\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/i;

// Area-code phones or compact 10/11 digits (avoid year ranges like 2024-2025).
// No lookbehind — keep compatible with older mobile WebViews.
const PHONE_RE =
  /(?:^|[^\d])(?:(?:\+?1[\s\-.]*)?(?:\(?\d{3}\)?[\s\-.]*)\d{3}[\s\-.]?\d{4}|(?:\+?1)?\d{10,11})(?!\d)/;

export function textContainsContactInfo(text) {
  if (!text) return false;
  const s = String(text);
  return EMAIL_RE.test(s) || PHONE_RE.test(s);
}
