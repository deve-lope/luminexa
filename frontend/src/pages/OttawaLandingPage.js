import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import { PLAY_STORE_URL, getAppStoreUrl } from '../utils/storeLinks';
import {
  alternativeBySlug,
  cityBySlug,
  citySeo,
  nearMeCategories,
  neighbourhoodBySlug,
  neighbourhoodNames,
  resolvedCategories,
} from '../seo/citySeo';

function useSeoCity() {
  const { pathname } = useLocation();
  return cityBySlug(pathname.split('/').filter(Boolean)[0]);
}

function CityLayout({
  kicker,
  title,
  description,
  canonical,
  h1,
  lead,
  image,
  jsonLd,
  secondaryTo,
  secondaryLabel,
  children,
}) {
  const hero = image || citySeo.home.heroImage;
  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SeoHead title={title} description={description} canonical={canonical} jsonLd={jsonLd} />
      <section className="relative flex min-h-[72vh] items-end overflow-hidden bg-teal-950 text-white">
        <img
          src={hero}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/25" />
        <header className="absolute inset-x-0 top-0 z-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
            <Link to="/" className="text-lg font-extrabold tracking-tight text-white">
              Luminexa
            </Link>
            <Link to="/" className="text-sm font-semibold text-white/90">
              Home
            </Link>
          </div>
        </header>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-28 md:px-8 md:pb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">{kicker}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {h1}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-teal-50/85 sm:text-lg">
            {lead}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-teal-400 px-8 text-sm font-bold text-teal-950 shadow-xl shadow-teal-950/30"
            >
              Continue to Luminexa
            </Link>
            <Link
              to={secondaryTo || '/services'}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 text-sm font-semibold text-white"
            >
              {secondaryLabel || 'Find local help'}
            </Link>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-900">Ready to book?</p>
          <p className="mt-1 text-sm text-slate-600">
            Open the Luminexa homepage to search your address, compare local providers, and pick a
            time.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-teal-600 px-6 text-sm font-semibold text-white"
          >
            Go to homepage
          </Link>
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 md:px-8">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {citySeo.cities.map((c) => (
              <Link key={c.slug} to={`/${c.slug}`} className="text-teal-700 hover:underline">
                {c.city}
              </Link>
            ))}
            <Link to="/alternatives" className="text-teal-700 hover:underline">
              Alternatives
            </Link>
            <Link to="/pricing" className="text-teal-700 hover:underline">
              Pricing
            </Link>
            <Link to="/privacy" className="hover:text-teal-700">
              Privacy
            </Link>
            <a href={PLAY_STORE_URL} className="hover:text-teal-700" target="_blank" rel="noopener noreferrer">
              Google Play
            </a>
            <a href={getAppStoreUrl()} className="hover:text-teal-700" target="_blank" rel="noopener noreferrer">
              App Store
            </a>
          </p>
          <p className="mt-2 text-xs">
            A provider is shown only if you are inside both your search radius and their service
            area.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function CityHubPage() {
  const city = useSeoCity();
  if (!city) return <Navigate to="/" replace />;

  const cats = resolvedCategories(city.city);
  const featured = cats.filter((c) => c.featured);
  const rest = cats.filter((c) => !c.featured);
  const canonical = `${citySeo.siteUrl}/${city.slug}/`;

  const CatList = ({ items }) => (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((c) => (
        <li key={c.slug}>
          <Link to={`/${city.slug}/${c.slug}`} className="font-medium text-teal-700">
            {c.name}
          </Link>
          {' — '}
          {c.blurb}
        </li>
      ))}
    </ul>
  );

  return (
    <CityLayout
      kicker={city.city}
      title={city.hub.title}
      description={city.hub.description}
      canonical={canonical}
      h1={city.hub.h1}
      lead={city.hub.intro}
      image={citySeo.home.heroImage}
      secondaryTo="/services"
      secondaryLabel={`Find help in ${city.city}`}
      jsonLd={[
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: citySeo.brand,
          url: citySeo.siteUrl,
          areaServed: citySeo.cities.map((c) => ({ '@type': 'City', name: c.city })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: city.faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ]}
    >
      <p>{city.hub.intro}</p>
      <h2 className="pt-4 text-base font-semibold text-slate-900">Featured in {city.city}</h2>
      <CatList items={featured} />
      <h2 className="pt-4 text-base font-semibold text-slate-900">All services in {city.city}</h2>
      <CatList items={[...featured, ...rest]} />
      <h2 className="pt-4 text-base font-semibold text-slate-900">Near me in {city.city}</h2>
      <p>
        <Link to={`/${city.slug}/near-me`} className="font-medium text-teal-700">
          Services near me in {city.city}
        </Link>
      </p>
      <h2 className="pt-4 text-base font-semibold text-slate-900">Neighbourhoods</h2>
      <ul className="list-disc space-y-2 pl-5">
        {city.neighbourhoods.map((n) => (
          <li key={n.slug}>
            <Link to={`/${city.slug}/${n.slug}`} className="font-medium text-teal-700">
              {n.name}
            </Link>
            {' — '}
            services near {n.name}
          </li>
        ))}
      </ul>
      {city.faq.map((item) => (
        <section key={item.q}>
          <h2 className="pt-4 text-base font-semibold text-slate-900">{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
    </CityLayout>
  );
}

export function CityNearMePage() {
  const city = useSeoCity();
  if (!city?.nearMe) return <Navigate to="/" replace />;

  const nearCats = nearMeCategories().map((c) => ({
    ...c,
    ...resolvedCategories(city.city).find((r) => r.slug === c.slug),
  }));
  const canonical = `${citySeo.siteUrl}/${city.slug}/near-me/`;

  return (
    <CityLayout
      kicker={`${city.city} · Near me`}
      title={city.nearMe.title}
      description={city.nearMe.description}
      canonical={canonical}
      h1={city.nearMe.h1}
      lead={city.nearMe.intro}
      secondaryTo="/services"
      secondaryLabel={`Find help near me in ${city.city}`}
      jsonLd={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: city.nearMe.title,
          url: canonical,
          about: { '@type': 'City', name: city.city },
        },
      ]}
    >
      <p>{city.nearMe.intro}</p>
      <h2 className="pt-4 text-base font-semibold text-slate-900">
        Popular near you in {city.city}
      </h2>
      <ul className="list-disc space-y-2 pl-5">
        {nearCats.map((c) => (
          <li key={c.slug}>
            <Link to={`/${city.slug}/${c.slug}`} className="font-medium text-teal-700">
              {c.name}
            </Link>
            {' — '}
            {c.blurb}
          </li>
        ))}
      </ul>
      <h2 className="pt-4 text-base font-semibold text-slate-900">Browse by neighbourhood</h2>
      <ul className="list-disc space-y-2 pl-5">
        {city.neighbourhoods.map((n) => (
          <li key={n.slug}>
            <Link to={`/${city.slug}/${n.slug}`} className="font-medium text-teal-700">
              {n.name}
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link to={`/${city.slug}`} className="font-medium text-teal-700">
          All {city.city} services
        </Link>
      </p>
    </CityLayout>
  );
}

export function CityCategoryPage() {
  const city = useSeoCity();
  const { slug, category } = useParams();
  if (!city) return <Navigate to="/" replace />;

  const cats = resolvedCategories(city.city);
  const neighbourhood = neighbourhoodBySlug(city, slug);
  const nearSlugs = new Set((citySeo.nearMeCategorySlugs || []).map(String));

  // /city/neighbourhood/category
  if (category) {
    if (!neighbourhood) return <Navigate to={`/${city.slug}`} replace />;
    const cat = cats.find((c) => c.slug === category);
    if (!cat || !nearSlugs.has(category)) {
      return <Navigate to={`/${city.slug}/${neighbourhood.slug}`} replace />;
    }
    const canonical = `${citySeo.siteUrl}/${city.slug}/${neighbourhood.slug}/${cat.slug}/`;
    const title = `${cat.name} near me in ${neighbourhood.name}, ${city.city} | Luminexa`;
    const description = `Book ${cat.name.toLowerCase()} near ${neighbourhood.name} in ${city.city}. Luminexa shows local providers with open times when their service area covers you.`;
    const h1 = `${cat.name} near ${neighbourhood.name}`;
    const lead = `Find ${cat.name.toLowerCase()} near ${neighbourhood.name}. Enter your address on Luminexa to see who actually serves your block.`;
    return (
      <CityLayout
        kicker={`${city.city} · ${neighbourhood.name}`}
        title={title}
        description={description}
        canonical={canonical}
        h1={h1}
        lead={lead}
        image={cat.image}
        secondaryTo="/services"
        secondaryLabel={`Book ${cat.name.toLowerCase()} near me`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `${cat.name} near ${neighbourhood.name}`,
            serviceType: cat.name,
            provider: { '@type': 'Organization', name: 'Luminexa' },
            areaServed: [
              { '@type': 'City', name: city.city },
              { '@type': 'Place', name: neighbourhood.name },
            ],
            url: canonical,
            description,
          },
        ]}
      >
        <p>{lead}</p>
        <p>{cat.blurb}</p>
        <p>
          Results are dual-radius: you only see a provider if you are inside your search radius and
          their service area.
        </p>
        <p>
          <Link to={`/${city.slug}/${neighbourhood.slug}`} className="font-medium text-teal-700">
            All services near {neighbourhood.name}
          </Link>
          {' · '}
          <Link to={`/${city.slug}/${cat.slug}`} className="font-medium text-teal-700">
            {cat.name} in {city.city}
          </Link>
          {' · '}
          <Link to={`/${city.slug}/near-me`} className="font-medium text-teal-700">
            Near me in {city.city}
          </Link>
        </p>
      </CityLayout>
    );
  }

  // /city/category
  const cat = cats.find((c) => c.slug === slug);
  if (cat) {
    const canonical = `${citySeo.siteUrl}/${city.slug}/${cat.slug}/`;
    return (
      <CityLayout
        kicker={city.city}
        title={cat.title}
        description={cat.description}
        canonical={canonical}
        h1={cat.h1}
        lead={cat.blurb}
        image={cat.image}
        secondaryTo="/services"
        secondaryLabel={`Find help in ${city.city}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: cat.name,
            serviceType: cat.name,
            provider: { '@type': 'Organization', name: 'Luminexa' },
            areaServed: { '@type': 'City', name: city.city },
            url: canonical,
            description: cat.description,
          },
        ]}
      >
        <p>{cat.blurb}</p>
        {cat.extra ? <p>{cat.extra}</p> : null}
        <p>
          Search by your {city.city} address or postal code. Luminexa only shows providers whose
          service area covers you — including people working from{' '}
          {neighbourhoodNames(city).slice(0, 4).join(', ')} and other {city.city} neighbourhoods.
        </p>
        <p>
          <Link to={`/${city.slug}/near-me`} className="font-medium text-teal-700">
            Services near me in {city.city}
          </Link>
          {' · '}
          <Link to={`/${city.slug}`} className="font-medium text-teal-700">
            All {city.city} services
          </Link>
        </p>
      </CityLayout>
    );
  }

  // /city/neighbourhood
  if (neighbourhood) {
    const nearCats = cats.filter((c) => nearSlugs.has(c.slug));
    const title = `Local services near me in ${neighbourhood.name}, ${city.city} | Luminexa`;
    const description = `Book services near ${neighbourhood.name} in ${city.city} — snow removal, car detailing, cleaning, and more on Luminexa when a provider’s area covers you.`;
    const h1 = `Services near me in ${neighbourhood.name}`;
    const lead = `Looking for help near ${neighbourhood.name}? Luminexa shows ${city.city} providers whose service area reaches your address — not a generic city-wide phone list.`;
    const canonical = `${citySeo.siteUrl}/${city.slug}/${neighbourhood.slug}/`;
    return (
      <CityLayout
        kicker={`${city.city} · ${neighbourhood.name}`}
        title={title}
        description={description}
        canonical={canonical}
        h1={h1}
        lead={lead}
        secondaryTo="/services"
        secondaryLabel={`Find help near ${neighbourhood.name}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            url: canonical,
            about: [
              { '@type': 'City', name: city.city },
              { '@type': 'Place', name: neighbourhood.name },
            ],
          },
        ]}
      >
        <p>{lead}</p>
        <h2 className="pt-4 text-base font-semibold text-slate-900">
          Popular jobs near {neighbourhood.name}
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          {nearCats.map((c) => (
            <li key={c.slug}>
              <Link
                to={`/${city.slug}/${neighbourhood.slug}/${c.slug}`}
                className="font-medium text-teal-700"
              >
                {c.name} near {neighbourhood.name}
              </Link>
            </li>
          ))}
        </ul>
        <h2 className="pt-4 text-base font-semibold text-slate-900">
          All {city.city} categories
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          {cats.map((c) => (
            <li key={c.slug}>
              <Link to={`/${city.slug}/${c.slug}`} className="font-medium text-teal-700">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <p>
          Listing {neighbourhood.name} does not mean every provider covers the whole neighbourhood —
          matching is by distance and each provider’s service radius.
        </p>
        <p>
          <Link to={`/${city.slug}/near-me`} className="font-medium text-teal-700">
            Services near me in {city.city}
          </Link>
          {' · '}
          <Link to={`/${city.slug}`} className="font-medium text-teal-700">
            All {city.city} services
          </Link>
        </p>
      </CityLayout>
    );
  }

  return <Navigate to={`/${city.slug}`} replace />;
}

export function AlternativesHubPage() {
  const alt = citySeo.alternatives;
  if (!alt) return <Navigate to="/" replace />;
  const canonical = `${citySeo.siteUrl}/alternatives/`;
  return (
    <CityLayout
      kicker="Compare"
      title={alt.hub.title}
      description={alt.hub.description}
      canonical={canonical}
      h1={alt.hub.h1}
      lead={alt.hub.intro}
      secondaryTo="/services"
      secondaryLabel="Find local help"
      jsonLd={[
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: alt.hub.title,
          url: canonical,
          description: alt.hub.description,
        },
      ]}
    >
      <p>{alt.hub.intro}</p>
      <h2 className="pt-4 text-base font-semibold text-slate-900">Compare</h2>
      <ul className="list-disc space-y-2 pl-5">
        {alt.pages.map((p) => (
          <li key={p.slug}>
            <Link to={`/alternatives/${p.slug}`} className="font-medium text-teal-700">
              {p.competitor} alternative
            </Link>
            {' — '}
            {p.lead}
          </li>
        ))}
      </ul>
      <h2 className="pt-4 text-base font-semibold text-slate-900">Book local services instead</h2>
      <p>
        If you need help near you — not ERP or field-service back office — start in{' '}
        <Link to="/ottawa" className="font-medium text-teal-700">
          Ottawa
        </Link>{' '}
        or{' '}
        <Link to="/toronto" className="font-medium text-teal-700">
          Toronto
        </Link>
        , or open{' '}
        <Link to="/ottawa/near-me" className="font-medium text-teal-700">
          services near me in Ottawa
        </Link>
        .
      </p>
    </CityLayout>
  );
}

export function AlternativePage() {
  const { slug } = useParams();
  const page = alternativeBySlug(slug);
  if (!page) return <Navigate to="/alternatives" replace />;
  const canonical = `${citySeo.siteUrl}/alternatives/${page.slug}/`;
  return (
    <CityLayout
      kicker={`${page.competitor} alternative`}
      title={page.title}
      description={page.description}
      canonical={canonical}
      h1={page.h1}
      lead={page.lead}
      image={page.image}
      secondaryTo="/services"
      secondaryLabel="Book local services"
      jsonLd={[
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: page.faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: page.title,
          url: canonical,
          description: page.description,
        },
      ]}
    >
      <p>{page.lead}</p>
      {page.sections.map((s) => (
        <section key={s.h2}>
          <h2 className="pt-4 text-base font-semibold text-slate-900">{s.h2}</h2>
          <p>{s.p}</p>
        </section>
      ))}
      {page.faq.map((item) => (
        <section key={item.q}>
          <h2 className="pt-4 text-base font-semibold text-slate-900">{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
      <p>
        Also see{' '}
        <Link to="/alternatives" className="font-medium text-teal-700">
          all alternatives
        </Link>
        ,{' '}
        <Link to="/ottawa/near-me" className="font-medium text-teal-700">
          Ottawa near me
        </Link>
        , and{' '}
        <Link to="/toronto/near-me" className="font-medium text-teal-700">
          Toronto near me
        </Link>
        .
      </p>
    </CityLayout>
  );
}

/** @deprecated Use CityHubPage */
export const OttawaHubPage = CityHubPage;
/** @deprecated Use CityCategoryPage */
export const OttawaCategoryPage = CityCategoryPage;
