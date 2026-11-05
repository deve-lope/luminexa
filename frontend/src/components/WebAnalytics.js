import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = (process.env.REACT_APP_GA_MEASUREMENT_ID || '').trim();
const CF_TOKEN = (process.env.REACT_APP_CF_BEACON_TOKEN || '').trim();
const GA_OK = /^G-[A-Z0-9]+$/i.test(GA_ID);
const CF_OK = /^[A-Za-z0-9_-]{8,128}$/.test(CF_TOKEN);

function ensureGtag() {
  if (!GA_OK || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
  }
}

function ensureCloudflareBeacon() {
  if (!CF_OK || document.querySelector('script[data-cf-beacon]')) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN, spa: true }));
  document.head.appendChild(s);
}

/**
 * Optional page-visit analytics. Loads nothing unless build-time env is set:
 *   REACT_APP_CF_BEACON_TOKEN  Cloudflare Web Analytics
 *   REACT_APP_GA_MEASUREMENT_ID  Google Analytics 4 (G-XXXX)
 */
export default function WebAnalytics() {
  const location = useLocation();

  useEffect(() => {
    ensureCloudflareBeacon();
    ensureGtag();
  }, []);

  useEffect(() => {
    if (!GA_OK || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: `${location.pathname}${location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);

  return null;
}
