#!/usr/bin/env node
/**
 * Validates generated sitemap.xml + public SEO HTML:
 * unique self-canonicals, trailing-slash locs, matching files, unique titles.
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const data = require('../src/seo/cities.json');
const siteUrl = data.siteUrl;
const MARKETING_HOST = 'https://luminex-a.com';

function fail(msg) {
  console.error(`SEO check failed: ${msg}`);
  process.exit(1);
}

if (siteUrl !== MARKETING_HOST) {
  fail(`cities.json siteUrl must be ${MARKETING_HOST}, got ${siteUrl}`);
}

if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml missing — run node scripts/write-city-seo.js first');
}

const xml = fs.readFileSync(sitemapPath, 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length < 20) fail(`expected many sitemap URLs, got ${locs.length}`);
if (locs.length > 90) {
  fail(`sitemap looks too large (${locs.length}); neighbourhood×service URLs should be omitted`);
}

const seen = new Set();
const titles = new Map();
const citySlugs = data.cities.map((c) => c.slug).join('|');
const nhoodService = new RegExp(`^${siteUrl}/(?:${citySlugs})/[^/]+/[^/]+/$`);

for (const loc of locs) {
  if (!loc.startsWith(`${siteUrl}/`)) fail(`sitemap loc is not on preferred host: ${loc}`);
  if (!loc.endsWith('/')) fail(`sitemap loc missing trailing slash: ${loc}`);
  if (seen.has(loc)) fail(`duplicate sitemap loc: ${loc}`);
  seen.add(loc);
  if (/\/gigs\//.test(loc)) fail(`sitemap must not list gig URLs (can 404/5xx): ${loc}`);
  if (nhoodService.test(loc)) {
    fail(`sitemap must not list neighbourhood×service URLs: ${loc}`);
  }
  if (!xml.includes(`<loc>${loc}</loc>`) || !new RegExp(
    `<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`
  ).test(xml)) {
    fail(`sitemap loc missing lastmod: ${loc}`);
  }

  const rel = loc.slice(siteUrl.length);
  if (rel === '/') continue;
  const filePath = path.join(publicDir, rel, 'index.html');
  if (!fs.existsSync(filePath)) fail(`no index.html for sitemap URL ${loc} (looked for ${filePath})`);
  const html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes(`rel="canonical" href="${loc}"`)) {
    fail(`canonical mismatch in ${filePath} (expected ${loc})`);
  }
  if (!html.includes(`property="og:url" content="${loc}"`)) {
    fail(`og:url mismatch in ${filePath} (expected ${loc})`);
  }
  if (!html.includes('og:title') || !html.includes('twitter:card')) {
    fail(`missing OG/Twitter tags in ${filePath}`);
  }
  if (!html.includes('summary_large_image')) {
    fail(`twitter:card must be summary_large_image in ${filePath}`);
  }
  if (!html.includes(`${siteUrl}/images/og-home.jpg`)) {
    fail(`og/twitter image must use ${siteUrl}/images/og-home.jpg in ${filePath}`);
  }
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (!titleMatch) fail(`missing <title> in ${filePath}`);
  const title = titleMatch[1];
  if (titles.has(title)) fail(`duplicate title "${title}" (${titles.get(title)} and ${loc})`);
  titles.set(title, loc);
  if (!html.includes('application/ld+json')) fail(`missing JSON-LD in ${filePath}`);
  if (!html.includes('"@type":"Country"') || !html.includes('"name":"Canada"')) {
    fail(`Organization JSON-LD must areaServe Canada in ${filePath}`);
  }
  if (
    !html.includes('https://play.google.com/store/apps/details?id=com.luminexa.app') ||
    !html.includes('https://apps.apple.com/ca/app/luminexa/id6804875374')
  ) {
    fail(`Organization sameAs must include App Store and Google Play in ${filePath}`);
  }

  const pathParts = rel.replace(/^\/+|\/+$/g, '').split('/');
  if (pathParts.length === 2 && data.categories.some((c) => c.slug === pathParts[1])) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.split(' ').length < 280) {
      fail(`city+service page looks thin (${text.split(' ').length} words): ${loc}`);
    }
    if (!html.includes('How booking works')) {
      fail(`city+service page missing booking-how section: ${loc}`);
    }
  }
}

const home = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
if (!home.includes(`rel="canonical" href="${siteUrl}/"`)) {
  fail('homepage canonical must be the apex marketing host');
}
if (!home.includes('<h1>')) fail('homepage raw HTML must include an H1');
if (!home.includes('href="/ottawa/"') || !home.includes('href="/toronto/"')) {
  fail('homepage raw HTML must link to /ottawa/ and /toronto/');
}
if (!home.includes('href="/ottawa/snow-removal/"') || !home.includes('href="/toronto/snow-removal/"')) {
  fail('homepage raw HTML must link to city+service pages');
}
if (!home.includes(`${siteUrl}/images/og-home.jpg`)) {
  fail('homepage must set og:image to the web-sized og-home.jpg');
}
if (!home.includes('summary_large_image')) {
  fail('homepage twitter:card must be summary_large_image');
}
if (!home.includes('"@type":"Country"') || !home.includes('"name":"Canada"')) {
  fail('homepage JSON-LD must areaServe Canada');
}

const pricing = fs.readFileSync(path.join(publicDir, 'pricing/index.html'), 'utf8');
if (!/"operatingSystem":"Web, Android, iOS"/.test(pricing)) {
  fail('pricing SoftwareApplication must include iOS in operatingSystem');
}

const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
  fail('robots.txt must point at the marketing-host sitemap');
}
if (/Allow: \/ottawa\/gigs\//.test(robots)) {
  fail('robots.txt must not Allow gig URLs that 404 in this codebase');
}

const nginx = fs.readFileSync(path.join(__dirname, '../nginx.default.conf'), 'utf8');
if (!nginx.includes('app\\.luminex-a\\.com/$')) {
  fail('nginx must 301 app-host marketing homepage to luminex-a.com');
}
if (!nginx.includes('rewrite ^/ottawa/[^/]+/([^/]+)/$')) {
  fail('nginx must 301 neighbourhood×service URLs to city×service pages');
}
if (!nginx.includes('try_files $uri =404')) {
  fail('nginx must 404 unknown paths instead of SPA-fallback');
}

const leftover = [];
for (const city of data.cities) {
  const slugs = new Set((data.nearMeCategorySlugs || []).concat(data.categories.map((c) => c.slug)));
  for (const n of city.neighbourhoods) {
    for (const slug of slugs) {
      const p = path.join(publicDir, city.slug, n.slug, slug, 'index.html');
      if (fs.existsSync(p)) leftover.push(`${city.slug}/${n.slug}/${slug}/`);
    }
  }
}
if (leftover.length) {
  fail(`neighbourhood×service HTML still present: ${leftover.slice(0, 5).join(', ')}`);
}

console.log(
  `SEO check OK: ${locs.length} sitemap URLs, unique titles, self-canonicals, trailing slashes, lastmod, apex host.`
);
