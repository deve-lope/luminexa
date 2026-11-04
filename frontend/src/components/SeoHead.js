import { useEffect } from 'react';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL, absUrl } from '../seo/site';

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
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
 * Sets document title, description, canonical, robots, Open Graph, Twitter,
 * and JSON-LD for SPA routes. Static /ottawa/*.html still wins for crawlers
 * that do not execute JavaScript.
 */
export default function SeoHead({
  title,
  description,
  canonical,
  robots = 'index,follow',
  jsonLd,
  ogImage = `${SITE_URL}/images/home-hero.jpg`,
  noindex = false,
}) {
  const resolvedTitle = title || HOME_TITLE;
  const resolvedDescription = description || HOME_DESCRIPTION;
  const resolvedCanonical = absUrl(canonical || '/');
  const robotsContent = noindex ? 'noindex,nofollow' : robots;
  const ldText = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = resolvedTitle;
    upsertMeta('name', 'description', resolvedDescription);
    upsertMeta('name', 'robots', robotsContent);
    upsertMeta('property', 'og:title', resolvedTitle);
    upsertMeta('property', 'og:description', resolvedDescription);
    upsertMeta('property', 'og:url', resolvedCanonical);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:locale', 'en_CA');
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', resolvedTitle);
    upsertMeta('name', 'twitter:description', resolvedDescription);
    upsertMeta('name', 'twitter:image', ogImage);
    upsertLink('canonical', resolvedCanonical);

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
  }, [resolvedTitle, resolvedDescription, resolvedCanonical, robotsContent, ldText, ogImage]);

  return null;
}

export { SITE_URL, SITE_NAME, absUrl };
