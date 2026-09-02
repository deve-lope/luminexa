import React from 'react';
import { isNativeApp } from '../../native/capacitorNative';
import { normalizeExternalWebsiteUrl, openExternalWebsite } from '../../utils/openExternalWebsite';

/**
 * Button-styled link to a provider’s own website.
 * On the phone app, opens in the system browser (outside the WebView).
 */
export default function VisitWebsiteButton({ url, className = '' }) {
  const href = normalizeExternalWebsiteUrl(url);
  if (!href) return null;

  const handleClick = async (event) => {
    if (!isNativeApp()) return;
    event.preventDefault();
    await openExternalWebsite(href);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-100 ${className}`.trim()}
    >
      Visit website
    </a>
  );
}
