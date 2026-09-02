/**
 * Normalize a provider-entered website URL for display and navigation.
 * Returns null when empty or invalid.
 */
export function normalizeExternalWebsiteUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  let href = raw;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }

  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Open a provider website outside the Luminexa app shell.
 * Native: system browser (user can pick default browser in OS settings).
 * Web: new tab.
 */
export async function openExternalWebsite(url) {
  const href = normalizeExternalWebsiteUrl(url);
  if (!href || typeof window === 'undefined') return false;

  const native =
    typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.();

  if (native) {
    try {
      const { App } = await import('@capacitor/app');
      if (App?.openUrl) {
        await App.openUrl({ url: href });
        return true;
      }
    } catch {
      /* fall through */
    }
  }

  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
