export function canNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function shareMessage({ text, url }) {
  return [text, url].filter(Boolean).join('\n');
}

/** Digits for WhatsApp / SMS. Keeps a leading + for SMS schemes. */
export function normalizeSharePhone(phone) {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export const SHARE_TARGETS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'messages', label: 'Messages' },
  { id: 'email', label: 'Email' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'telegram', label: 'Telegram' },
];

/**
 * Deep links for the share sheet. SMS uses iOS `&body=` vs Android `?body=`.
 * Optional phone/email pre-fill Messages, WhatsApp, and Email to the customer.
 */
export function shareHref(id, { title, text, url, phone, email }, { iOS = false } = {}) {
  const message = shareMessage({ text, url });
  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(url || '');
  const encodedTitle = encodeURIComponent(title || 'Luminexa');
  const encodedText = encodeURIComponent(text || '');
  const phoneNorm = normalizeSharePhone(phone);
  const phoneDigits = phoneNorm.replace(/\D/g, '');
  const emailTo = (email || '').trim();
  switch (id) {
    case 'whatsapp':
      return phoneDigits
        ? `https://wa.me/${phoneDigits}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;
    case 'messages': {
      const dest = phoneNorm || '';
      return iOS
        ? `sms:${dest}&body=${encodedMessage}`
        : `sms:${dest}?body=${encodedMessage}`;
    }
    case 'email': {
      const to = emailTo ? encodeURIComponent(emailTo) : '';
      return `mailto:${to}?subject=${encodedTitle}&body=${encodedMessage}`;
    }
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    default:
      return '';
  }
}

export function isIOSUserAgent(ua = '') {
  return /iPad|iPhone|iPod/i.test(ua);
}

export async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}

/**
 * OS share sheet when the platform supports it.
 * Android WebView often rejects { text, url } together, so we send one payload.
 */
export async function tryNativeShare({ title, text, url }) {
  if (!url) return 'none';
  const heading = title || 'Luminexa';
  const message = shareMessage({ text, url });

  try {
    const capShare = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Share : null;
    if (capShare?.share) {
      await capShare.share({
        title: heading,
        text: message,
        url,
        dialogTitle: 'Share',
      });
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }

  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unavailable';
  }

  const urlOnly = { title: heading, url };
  const textOnly = { title: heading, text: message };
  const data =
    typeof navigator.canShare === 'function' && navigator.canShare(urlOnly) ? urlOnly : textOnly;

  try {
    await navigator.share(data);
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    try {
      await navigator.share(textOnly);
      return 'shared';
    } catch (retryErr) {
      if (retryErr?.name === 'AbortError') return 'cancelled';
      return 'unavailable';
    }
  }
}

/** @deprecated Use tryNativeShare + the share sheet. Kept for callers that still expect copy. */
export async function shareOrCopy(payload) {
  const result = await tryNativeShare(payload);
  if (result === 'shared' || result === 'cancelled') return result;
  await copyText(payload?.url);
  return 'copied';
}
