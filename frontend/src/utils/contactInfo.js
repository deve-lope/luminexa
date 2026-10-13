/** Detect email / phone in Gig Wall free text (mirrors backend gig_public). */

export const CONTACT_INFO_ERROR =
  'Remove phone numbers and email addresses. Providers will contact you privately after you accept a quote.';

export const CONTACT_HINT =
  "Don't share phone or email here — providers ask privately.";

const EMAIL_RE =
  /\b[a-z0-9._%+\-]+\s*[@＠]\s*[a-z0-9.\-]+\s*[.．]\s*[a-z]{2,}\b/i;

const EMAIL_OBFUSCATED_RE =
  /\b[a-z0-9._%+\-]{1,64}(?:\s*[@＠]\s*|\s*[([{]?\s*(?:at|[@＠])\s*[)\]}]?\s*)[a-z0-9.\-]{1,64}(?:\s*[.．]\s*|\s*[([{]?\s*(?:dot|[.．])\s*[)\]}]?\s*)[a-z]{2,24}\b/i;

/** Digit + optional separators (spaces, dashes, bullets, slashes, …) × 10–15 digits. */
const PHONE_CANDIDATE_RE =
  /(?:\+?\s*)?(?:\d(?:[\s\-()._/+*#·•–—,|\\'\"~=]*\d){9,14})/g;

function normalizeForContactScan(text) {
  return String(text).replace(/\p{Nd}/gu, (ch) => {
    const n = ch.codePointAt(0);
    // ASCII already handled by \p{Nd}; map common fullwidth / arabic via Number()
    const asNum = Number(ch);
    return Number.isFinite(asNum) ? String(asNum) : ch;
  });
}

function looksLikeNaPhone(rawDigits) {
  let digits = String(rawDigits || '');
  if (digits.length === 11 && digits[0] === '1') {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return false;
  if (digits[0] === '0' || digits[0] === '1') return false;
  if (digits[3] === '0' || digits[3] === '1') return false;
  return true;
}

export function textContainsContactInfo(text) {
  if (!text) return false;
  const s = normalizeForContactScan(text);
  if (EMAIL_RE.test(s) || EMAIL_OBFUSCATED_RE.test(s)) return true;
  PHONE_CANDIDATE_RE.lastIndex = 0;
  let match;
  while ((match = PHONE_CANDIDATE_RE.exec(s)) !== null) {
    const digits = match[0].replace(/\D/g, '');
    if (looksLikeNaPhone(digits)) return true;
  }
  return false;
}
