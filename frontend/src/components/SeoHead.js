import { useEffect } from 'react';

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Sets document title, description, canonical, Open Graph, and JSON-LD
 * for SPA routes. Static /ottawa/*.html still wins for crawlers that
 * do not execute JavaScript.
 */
export default function SeoHead({ title, description, canonical, jsonLd }) {
  const ldText = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'Luminexa');
    upsertMeta('property', 'og:locale', 'en_CA');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertLink('canonical', canonical);

    const scriptId = 'luminexa-jsonld';
    let script = document.getElementById(scriptId);
    if (ldText) {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = ldText;
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, ldText]);

  return null;
}
