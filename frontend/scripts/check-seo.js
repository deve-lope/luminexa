#!/usr/bin/env node
/**
 * Validates generated sitemap.xml + public SEO HTML:
 * unique self-canonicals, trailing-slash locs, matching files,  unique titles.
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const siteUrl = 'https://app.luminex-a.com';

function fail(msg) {
  console.error(`SEO check failed: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml missing — run node scripts/write-city-seo.js first');
}

const xml = fs.readFileSync(sitemapPath, 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length < 20) fail(`expected many sitemap URLs, got ${locs.length}`);

const seen = new Set();
const titles = new Map();

for (const loc of locs) {
  if (!loc.startsWith(`${siteUrl}/`)) fail(`sitemap loc is not on preferred host: ${loc}`);
  if (!loc.endsWith('/')) fail(`sitemap loc missing trailing slash: ${loc}`);
  if (seen.has(loc)) fail(`duplicate sitemap loc: ${loc}`);
  seen.add(loc);
  if (/\/gigs\//.test(loc)) fail(`sitemap must not list gig URLs (can 404/5xx): ${loc}`);

  const rel = loc.slice(siteUrl.length);
  if (rel === '/') continue;
  const filePath = path.join(publicDir, rel, 'index.html');
  if (!fs.existsSync(filePath)) fail(`no index.html for sitemap URL ${loc} (looked for ${filePath})`);
  const html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes(`rel="canonical" href="${loc}"`)) {
    fail(`canonical mismatch in ${filePath} (expected ${loc})`);
  }
  if (!html.includes('og:title') || !html.includes('twitter:card')) {
    fail(`missing OG/Twitter tags in ${filePath}`);
  }
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (!titleMatch) fail(`missing <title> in ${filePath}`);
  const title = titleMatch[1];
  if (titles.has(title)) fail(`duplicate title "${title}" (${titles.get(title)} and ${loc})`);
  titles.set(title, loc);
  if (!html.includes('application/ld+json')) fail(`missing JSON-LD in ${filePath}`);
}

const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
  fail('robots.txt must point at the app-host sitemap');
}
if (/Allow: \/ottawa\/gigs\//.test(robots)) {
  fail('robots.txt must not Allow gig URLs that 404 in this codebase');
}

console.log(`SEO check OK: ${locs.length} sitemap URLs, unique titles, self-canonicals, trailing slashes.`);
