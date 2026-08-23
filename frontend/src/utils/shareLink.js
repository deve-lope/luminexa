export function canNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
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

/** Opens the phone share sheet (WhatsApp, SMS, email, …). Falls back to copy. */
export async function shareOrCopy({ title, text, url }) {
  if (!url) return 'none';
  if (canNativeShare()) {
    try {
      await navigator.share({
        title: title || 'Luminexa',
        text: text || '',
        url,
      });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  await copyText(url);
  return 'copied';
}
