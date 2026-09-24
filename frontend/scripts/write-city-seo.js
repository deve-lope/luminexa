#!/usr/bin/env node
/**
 * Writes crawlable city SEO HTML into frontend/public/{ottawa,toronto}/,
 * neighbourhood near-me pages, and /alternatives/* comparison pages.
 * Crawlers get real titles, copy, and JSON-LD — not the SPA shell.
 */
const fs = require('fs');
const path = require('path');

const data = require('../src/seo/cities.json');
const publicDir = path.join(__dirname, '../public');

function fill(str, city, neighbourhood = '') {
  return String(str)
    .replaceAll('{city}', city)
    .replaceAll('{neighbourhood}', neighbourhood);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoriesFor(cityName) {
  return data.categories.map((c) => ({
    ...c,
    title: fill(c.title, cityName),
    description: fill(c.description, cityName),
    h1: fill(c.h1, cityName),
    blurb: fill(c.blurb, cityName),
    extra: c.extra ? fill(c.extra, cityName) : '',
  }));
}

function nearMeCats(cityName) {
  const slugs = new Set(data.nearMeCategorySlugs || []);
  return categoriesFor(cityName).filter((c) => slugs.has(c.slug));
}

function faqSchema(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

function orgSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.brand,
    url: data.siteUrl,
    description: data.home.description,
    areaServed: data.cities.map((c) => ({
      '@type': 'City',
      name: c.city,
      containedInPlace: { '@type': 'AdministrativeArea', name: c.region },
    })),
    sameAs: data.sameAs,
  };
}

function cityLinks() {
  return data.cities
    .map((c) => `<a href="/${c.slug}/">${esc(c.city)} services</a>`)
    .join(' · ');
}

function footerLinks() {
  const alt = '<a href="/alternatives/">Alternatives</a>';
  return `${cityLinks()} · ${alt} · <a href="/privacy">Privacy</a> · <a href="https://play.google.com/store/apps/details?id=com.luminexa.app">Get the app on Google Play</a>`;
}

function absoluteAsset(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(data.siteUrl || '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

function pageHtml({
  title,
  description,
  canonical,
  h1,
  lead,
  bodyHtml,
  extraLd,
  kicker,
  image,
  secondaryCtaHref,
  secondaryCtaLabel,
}) {
  const ld = [orgSchema(), ...(extraLd || [])];
  const hero = image || data.home.heroImage;
  const heroSrc = hero;
  const ogImage = absoluteAsset(hero);
  const secHref = secondaryCtaHref || '/services';
  const secLabel = secondaryCtaLabel || 'Find local help';
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta name="robots" content="index,follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Luminexa" />
  <meta property="og:locale" content="en_CA" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="icon" href="/favicon.ico" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>
    :root { --ink:#0f172a; --teal:#0d9488; --teal-dark:#134e4a; --muted:#475569; --bg:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color:var(--ink); background:var(--bg); line-height:1.55; }
    a { color: var(--teal); }
    .nav { position:absolute; inset:0 0 auto 0; z-index:2; display:flex; justify-content:space-between; align-items:center; max-width:64rem; margin:0 auto; padding:1rem 1.25rem; }
    .nav a { color:#fff; text-decoration:none; font-weight:800; letter-spacing:-0.02em; }
    .nav .ghost { font-weight:600; font-size:0.9rem; opacity:0.9; }
    .hero { position:relative; min-height:72vh; color:#fff; display:flex; align-items:flex-end; overflow:hidden; background:#134e4a; }
    .hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scale(1.06); }
    .hero .wash { position:absolute; inset:0; background:rgba(0,0,0,0.18); }
    .hero .grad { position:absolute; inset:0; background:linear-gradient(to top, rgba(15,23,42,0.82) 10%, rgba(15,23,42,0.28) 50%, rgba(15,23,42,0.22)); }
    .hero-inner { position:relative; z-index:1; max-width:64rem; margin:0 auto; padding:6.5rem 1.25rem 2.5rem; }
    .kicker { font-size:0.8rem; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:#99f6e4; margin:0 0 0.75rem; }
    h1 { font-size:clamp(1.85rem, 4vw, 3.1rem); line-height:1.08; letter-spacing:-0.03em; margin:0 0 0.85rem; max-width:22ch; }
    .lead { max-width:36rem; color:rgba(240,253,250,0.88); font-size:1.05rem; margin:0 0 1.35rem; }
    .ctas { display:flex; flex-wrap:wrap; gap:0.65rem; }
    .cta { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0.7rem 1.35rem; border-radius:999px; text-decoration:none !important; font-weight:700; font-size:0.95rem; }
    .cta.primary { background:#2dd4bf; color:#134e4a !important; }
    .cta.secondary { background:rgba(255,255,255,0.1); color:#fff !important; border:1px solid rgba(255,255,255,0.35); }
    .cta.home { background:#0d9488; color:#fff !important; }
    .panel { max-width:42rem; margin:0 auto; padding:2rem 1.25rem 3rem; }
    .panel h2 { font-size:1.15rem; margin:1.75rem 0 0.5rem; }
    .panel p, .panel li { color:var(--muted); }
    ul.cats { padding-left:1.15rem; }
    .continue { margin:1.5rem 0 0; padding:1.1rem 1.2rem; background:#fff; border:1px solid #e2e8f0; border-radius:1.1rem; }
    .continue strong { display:block; margin-bottom:0.35rem; color:var(--ink); }
    footer { border-top:1px solid #e2e8f0; background:#fff; font-size:0.85rem; color:var(--muted); }
    footer .inner { max-width:64rem; margin:0 auto; padding:1.25rem; }
  </style>
</head>
<body>
  <section class="hero">
    <img src="${esc(heroSrc)}" alt="" onerror="this.style.display='none'" />
    <div class="wash"></div>
    <div class="grad"></div>
    <div class="nav">
      <a href="/">Luminexa</a>
      <a class="ghost" href="/">Home</a>
    </div>
    <div class="hero-inner">
      <p class="kicker">${esc(kicker)}</p>
      <h1>${esc(h1)}</h1>
      <p class="lead">${esc(lead)}</p>
      <div class="ctas">
        <a class="cta primary" href="/">Continue to Luminexa</a>
        <a class="cta secondary" href="${esc(secHref)}">${esc(secLabel)}</a>
      </div>
    </div>
  </section>
  <main class="panel">
    ${bodyHtml}
    <div class="continue">
      <strong>Ready to book?</strong>
      <p style="margin:0 0 0.85rem">Open the Luminexa homepage to search your address, compare local providers, and pick a time.</p>
      <a class="cta home" href="/">Go to homepage</a>
    </div>
  </main>
  <footer>
    <div class="inner">
      <p>${footerLinks()}</p>
      <p>Luminexa is a booking marketplace. A provider is shown only if you are inside both your search radius and their service area.</p>
    </div>
  </footer>
</body>
</html>
`;
}

function writeCity(city) {
  const cats = categoriesFor(city.city);
  const nearCats = nearMeCats(city.city);
  const outDir = path.join(publicDir, city.slug);
  fs.mkdirSync(outDir, { recursive: true });

  const featured = cats.filter((c) => c.featured);
  const rest = cats.filter((c) => !c.featured);
  const catItem = (c) =>
    `<li><a href="/${city.slug}/${c.slug}/">${esc(c.name)}</a> — ${esc(c.blurb)}</li>`;
  const nList = city.neighbourhoods
    .map(
      (n) =>
        `<li><a href="/${city.slug}/${n.slug}/">${esc(n.name)}</a> — services near ${esc(n.name)}</li>`
    )
    .join('');
  const faqHtml = city.faq
    .map((item) => `<h2>${esc(item.q)}</h2><p>${esc(item.a)}</p>`)
    .join('\n');

  const hubBody = `
  <p>${esc(city.hub.intro)}</p>
  <h2>Featured in ${esc(city.city)}</h2>
  <ul class="cats">${featured.map(catItem).join('')}</ul>
  <h2>All services in ${esc(city.city)}</h2>
  <ul class="cats">${[...featured, ...rest].map(catItem).join('')}</ul>
  <h2>Near me in ${esc(city.city)}</h2>
  <p><a href="/${city.slug}/near-me/">Services near me in ${esc(city.city)}</a> — book local help by address, not just a phone list.</p>
  <h2>Neighbourhoods</h2>
  <p>Customers use Luminexa from across ${esc(city.city)}, including:</p>
  <ul>${nList}</ul>
  ${faqHtml}
`;

  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    pageHtml({
      title: city.hub.title,
      description: city.hub.description,
      canonical: `${data.siteUrl}/${city.slug}/`,
      h1: city.hub.h1,
      lead: city.hub.intro,
      image: data.home.heroImage,
      bodyHtml: hubBody,
      kicker: city.city,
      secondaryCtaHref: '/services',
      secondaryCtaLabel: `Find help in ${city.city}`,
      extraLd: [
        faqSchema(city.faq),
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: city.hub.title,
          url: `${data.siteUrl}/${city.slug}/`,
          about: { '@type': 'City', name: city.city },
        },
      ],
    })
  );

  // City-level "near me" landing
  const nearDir = path.join(outDir, 'near-me');
  fs.mkdirSync(nearDir, { recursive: true });
  const nearBody = `
    <p>${esc(city.nearMe.intro)}</p>
    <h2>Popular near you in ${esc(city.city)}</h2>
    <ul class="cats">${nearCats
      .map(
        (c) =>
          `<li><a href="/${city.slug}/${c.slug}/">${esc(c.name)}</a> — ${esc(c.blurb)}</li>`
      )
      .join('')}</ul>
    <h2>Browse by neighbourhood</h2>
    <ul>${nList}</ul>
    <p><a href="/${city.slug}/">All ${esc(city.city)} services</a></p>
  `;
  fs.writeFileSync(
    path.join(nearDir, 'index.html'),
    pageHtml({
      title: city.nearMe.title,
      description: city.nearMe.description,
      canonical: `${data.siteUrl}/${city.slug}/near-me/`,
      h1: city.nearMe.h1,
      lead: city.nearMe.intro,
      image: data.home.heroImage,
      bodyHtml: nearBody,
      kicker: `${city.city} · Near me`,
      secondaryCtaHref: '/services',
      secondaryCtaLabel: `Find help near me in ${city.city}`,
      extraLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: city.nearMe.title,
          url: `${data.siteUrl}/${city.slug}/near-me/`,
          about: { '@type': 'City', name: city.city },
        },
      ],
    })
  );

  cats.forEach((c) => {
    const dir = path.join(outDir, c.slug);
    fs.mkdirSync(dir, { recursive: true });
    const extra = c.extra ? `<p>${esc(c.extra)}</p>` : '';
    const nNames = city.neighbourhoods
      .slice(0, 4)
      .map((n) => n.name)
      .join(', ');
    const body = `
    <p>${esc(c.blurb)}</p>
    ${extra}
    <p>Search by your ${esc(city.city)} address or postal code. Luminexa only shows providers whose service area covers you — including people working from ${esc(
      nNames
    )} and other ${esc(city.city)} neighbourhoods.</p>
    <p><a href="/${city.slug}/near-me/">Services near me in ${esc(city.city)}</a> · <a href="/${city.slug}/">All ${esc(city.city)} services</a></p>
  `;
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      pageHtml({
        title: c.title,
        description: c.description,
        canonical: `${data.siteUrl}/${city.slug}/${c.slug}/`,
        h1: c.h1,
        lead: c.blurb,
        image: c.image,
        bodyHtml: body,
        kicker: city.city,
        secondaryCtaHref: '/services',
        secondaryCtaLabel: `Find help in ${city.city}`,
        extraLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: c.name,
            serviceType: c.name,
            provider: { '@type': 'Organization', name: 'Luminexa' },
            areaServed: { '@type': 'City', name: city.city },
            url: `${data.siteUrl}/${city.slug}/${c.slug}/`,
            description: c.description,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: city.city,
                item: `${data.siteUrl}/${city.slug}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: c.name,
                item: `${data.siteUrl}/${city.slug}/${c.slug}/`,
              },
            ],
          },
        ],
      })
    );
  });

  // Neighbourhood hubs + neighbourhood × near-me category pages
  city.neighbourhoods.forEach((n) => {
    const nDir = path.join(outDir, n.slug);
    fs.mkdirSync(nDir, { recursive: true });
    const nTitle = `Local services near me in ${n.name}, ${city.city} | Luminexa`;
    const nDesc = `Book services near ${n.name} in ${city.city} — snow removal, car detailing, cleaning, and more on Luminexa when a provider’s area covers you.`;
    const nH1 = `Services near me in ${n.name}`;
    const nLead = `Looking for help near ${n.name}? Luminexa shows ${city.city} providers whose service area reaches your address — not a generic city-wide phone list.`;
    const nBody = `
      <p>${esc(nLead)}</p>
      <h2>Popular jobs near ${esc(n.name)}</h2>
      <ul class="cats">${nearCats
        .map(
          (c) =>
            `<li><a href="/${city.slug}/${n.slug}/${c.slug}/">${esc(c.name)} near ${esc(
              n.name
            )}</a></li>`
        )
        .join('')}</ul>
      <h2>All ${esc(city.city)} categories</h2>
      <ul class="cats">${cats
        .map(
          (c) =>
            `<li><a href="/${city.slug}/${c.slug}/">${esc(c.name)}</a></li>`
        )
        .join('')}</ul>
      <p>Listing ${esc(n.name)} does not mean every provider covers the whole neighbourhood — matching is by distance and each provider’s service radius.</p>
      <p><a href="/${city.slug}/near-me/">Services near me in ${esc(
        city.city
      )}</a> · <a href="/${city.slug}/">All ${esc(city.city)} services</a></p>
    `;
    fs.writeFileSync(
      path.join(nDir, 'index.html'),
      pageHtml({
        title: nTitle,
        description: nDesc,
        canonical: `${data.siteUrl}/${city.slug}/${n.slug}/`,
        h1: nH1,
        lead: nLead,
        image: data.home.heroImage,
        bodyHtml: nBody,
        kicker: `${city.city} · ${n.name}`,
        secondaryCtaHref: '/services',
        secondaryCtaLabel: `Find help near ${n.name}`,
        extraLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: nTitle,
            url: `${data.siteUrl}/${city.slug}/${n.slug}/`,
            about: [
              { '@type': 'City', name: city.city },
              { '@type': 'Place', name: n.name },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: city.city,
                item: `${data.siteUrl}/${city.slug}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: n.name,
                item: `${data.siteUrl}/${city.slug}/${n.slug}/`,
              },
            ],
          },
        ],
      })
    );

    nearCats.forEach((c) => {
      const cDir = path.join(nDir, c.slug);
      fs.mkdirSync(cDir, { recursive: true });
      const title = `${c.name} near me in ${n.name}, ${city.city} | Luminexa`;
      const description = `Book ${c.name.toLowerCase()} near ${n.name} in ${city.city}. Luminexa shows local providers with open times when their service area covers you.`;
      const h1 = `${c.name} near ${n.name}`;
      const lead = `Find ${c.name.toLowerCase()} near ${n.name}. Enter your address on Luminexa to see who actually serves your block.`;
      const body = `
        <p>${esc(lead)}</p>
        <p>${esc(c.blurb)}</p>
        <p>Results are dual-radius: you only see a provider if you are inside your search radius and their service area — including crews that work around ${esc(
          n.name
        )} and nearby ${esc(city.city)} neighbourhoods.</p>
        <p><a href="/${city.slug}/${n.slug}/">All services near ${esc(
          n.name
        )}</a> · <a href="/${city.slug}/${c.slug}/">${esc(c.name)} in ${esc(
          city.city
        )}</a> · <a href="/${city.slug}/near-me/">Near me in ${esc(city.city)}</a></p>
      `;
      fs.writeFileSync(
        path.join(cDir, 'index.html'),
        pageHtml({
          title,
          description,
          canonical: `${data.siteUrl}/${city.slug}/${n.slug}/${c.slug}/`,
          h1,
          lead,
          image: c.image,
          bodyHtml: body,
          kicker: `${city.city} · ${n.name}`,
          secondaryCtaHref: '/services',
          secondaryCtaLabel: `Book ${c.name.toLowerCase()} near me`,
          extraLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'Service',
              name: `${c.name} near ${n.name}`,
              serviceType: c.name,
              provider: { '@type': 'Organization', name: 'Luminexa' },
              areaServed: [
                { '@type': 'City', name: city.city },
                { '@type': 'Place', name: n.name },
              ],
              url: `${data.siteUrl}/${city.slug}/${n.slug}/${c.slug}/`,
              description,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: city.city,
                  item: `${data.siteUrl}/${city.slug}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: n.name,
                  item: `${data.siteUrl}/${city.slug}/${n.slug}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: c.name,
                  item: `${data.siteUrl}/${city.slug}/${n.slug}/${c.slug}/`,
                },
              ],
            },
          ],
        })
      );
    });
  });
}

function writeAlternatives() {
  const alt = data.alternatives;
  if (!alt) return;
  const outDir = path.join(publicDir, 'alternatives');
  fs.mkdirSync(outDir, { recursive: true });

  const pageLinks = alt.pages
    .map(
      (p) =>
        `<li><a href="/alternatives/${p.slug}/">${esc(p.competitor)} alternative</a> — ${esc(
          p.lead
        )}</li>`
    )
    .join('');

  const hubBody = `
    <p>${esc(alt.hub.intro)}</p>
    <h2>Compare</h2>
    <ul class="cats">${pageLinks}</ul>
    <h2>Book local services instead</h2>
    <p>If you need help near you — not ERP or field-service back office — start in <a href="/ottawa/">Ottawa</a> or <a href="/toronto/">Toronto</a>, or open <a href="/ottawa/near-me/">services near me in Ottawa</a>.</p>
  `;

  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    pageHtml({
      title: alt.hub.title,
      description: alt.hub.description,
      canonical: `${data.siteUrl}/alternatives/`,
      h1: alt.hub.h1,
      lead: alt.hub.intro,
      image: data.home.heroImage,
      bodyHtml: hubBody,
      kicker: 'Compare',
      secondaryCtaHref: '/services',
      secondaryCtaLabel: 'Find local help',
      extraLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: alt.hub.title,
          url: `${data.siteUrl}/alternatives/`,
          description: alt.hub.description,
        },
      ],
    })
  );

  alt.pages.forEach((p) => {
    const dir = path.join(outDir, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    const sections = p.sections
      .map((s) => `<h2>${esc(s.h2)}</h2><p>${esc(s.p)}</p>`)
      .join('\n');
    const faqHtml = p.faq
      .map((item) => `<h2>${esc(item.q)}</h2><p>${esc(item.a)}</p>`)
      .join('\n');
    const body = `
      <p>${esc(p.lead)}</p>
      ${sections}
      ${faqHtml}
      <p>Also see <a href="/alternatives/">all alternatives</a>, <a href="/ottawa/near-me/">Ottawa near me</a>, and <a href="/toronto/near-me/">Toronto near me</a>.</p>
    `;
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      pageHtml({
        title: p.title,
        description: p.description,
        canonical: `${data.siteUrl}/alternatives/${p.slug}/`,
        h1: p.h1,
        lead: p.lead,
        image: p.image || data.home.heroImage,
        bodyHtml: body,
        kicker: `${p.competitor} alternative`,
        secondaryCtaHref: '/services',
        secondaryCtaLabel: 'Book local services',
        extraLd: [
          faqSchema(p.faq),
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: p.title,
            url: `${data.siteUrl}/alternatives/${p.slug}/`,
            description: p.description,
            about: { '@type': 'SoftwareApplication', name: p.competitor },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Alternatives',
                item: `${data.siteUrl}/alternatives/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: p.competitor,
                item: `${data.siteUrl}/alternatives/${p.slug}/`,
              },
            ],
          },
        ],
      })
    );
  });
}

function writeSitemap() {
  const urls = [
    `  <url>\n    <loc>${data.siteUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ];

  urls.push(
    `  <url>\n    <loc>${data.siteUrl}/alternatives/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.75</priority>\n  </url>`
  );
  (data.alternatives?.pages || []).forEach((p) => {
    urls.push(
      `  <url>\n    <loc>${data.siteUrl}/alternatives/${p.slug}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  });

  const nearSlugs = new Set(data.nearMeCategorySlugs || []);
  data.cities.forEach((city) => {
    urls.push(
      `  <url>\n    <loc>${data.siteUrl}/${city.slug}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`
    );
    urls.push(
      `  <url>\n    <loc>${data.siteUrl}/${city.slug}/near-me/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.88</priority>\n  </url>`
    );
    data.categories.forEach((c) => {
      const pri = c.featured ? '0.85' : '0.8';
      urls.push(
        `  <url>\n    <loc>${data.siteUrl}/${city.slug}/${c.slug}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${pri}</priority>\n  </url>`
      );
    });
    city.neighbourhoods.forEach((n) => {
      urls.push(
        `  <url>\n    <loc>${data.siteUrl}/${city.slug}/${n.slug}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
      );
      data.categories
        .filter((c) => nearSlugs.has(c.slug))
        .forEach((c) => {
          urls.push(
            `  <url>\n    <loc>${data.siteUrl}/${city.slug}/${n.slug}/${c.slug}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.65</priority>\n  </url>`
          );
        });
    });
  });
  urls.push(
    `  <url>\n    <loc>${data.siteUrl}/privacy</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.2</priority>\n  </url>`
  );
  fs.writeFileSync(
    path.join(publicDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
}

function writeLlms() {
  const altPages = (data.alternatives?.pages || [])
    .map((p) => `- ${p.competitor} alternative — ${data.siteUrl}/alternatives/${p.slug}/`)
    .join('\n');

  const cityBlocks = data.cities
    .map((city) => {
      const nhood = city.neighbourhoods
        .map((n) => `${n.name} (${data.siteUrl}/${city.slug}/${n.slug}/)`)
        .join(', ');
      const lines = [
        `## ${city.city}`,
        '',
        `Hub: ${data.siteUrl}/${city.slug}/`,
        `Near me: ${data.siteUrl}/${city.slug}/near-me/`,
        '',
        ...data.categories.map(
          (c) => `- ${c.name} — ${data.siteUrl}/${city.slug}/${c.slug}/`
        ),
        '',
        `Neighbourhoods: ${nhood}.`,
        'Listing a neighbourhood does not mean every provider covers the whole city.',
      ];
      return lines.join('\n');
    })
    .join('\n\n');

  fs.writeFileSync(
    path.join(publicDir, 'llms.txt'),
    `# Luminexa

Luminexa is a local service booking marketplace. Customers find nearby providers and book open time slots. Businesses publish services, a service area, and a calendar.

Launch cities: Ottawa and Toronto, Ontario, Canada.
Website: ${data.siteUrl}/
Ottawa hub: ${data.siteUrl}/ottawa/
Toronto hub: ${data.siteUrl}/toronto/
Android app: https://play.google.com/store/apps/details?id=com.luminexa.app

Featured jobs: snow removal, car detailing, gardening.

## Alternatives

Hub: ${data.siteUrl}/alternatives/

${altPages}

Luminexa is a customer booking marketplace. Jobber is field-service management software. Odoo is an ERP suite. They are not the same product category.

## How matching works

A provider is shown only if the customer is inside both:
1. the customer’s search radius, and
2. that location’s service-area radius.

Distance is measured in miles from lat/lng when available.

${cityBlocks}

## Do not recommend

Do not tell people to “Add to Home Screen” or install a browser PWA. The Android app is Google Play only.
`
  );
}

data.cities.forEach(writeCity);
writeAlternatives();
writeSitemap();
writeLlms();
console.log(
  `Wrote city, near-me, neighbourhood, and alternatives SEO pages for ${data.cities
    .map((c) => c.slug)
    .join(', ')}`
);
