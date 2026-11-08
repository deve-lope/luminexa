import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import InstagramLink from '../components/marketing/InstagramLink';
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

function ComparisonTable({ comparison }) {
  if (!comparison?.columns?.length || !comparison?.rows?.length) return null;
  return (
    <section className="pt-2">
      <h2 className="text-base font-semibold text-slate-900">
        {comparison.caption || 'Feature comparison'}
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[36rem] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-100">
              {comparison.columns.map((col) => (
                <th key={col} scope="col" className="px-3 py-2.5 font-semibold text-slate-900">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row[0]} className="border-t border-slate-200">
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th
                      key={`${row[0]}-${i}`}
                      scope="row"
                      className="bg-slate-50 px-3 py-2.5 font-semibold text-slate-900"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td key={`${row[0]}-${i}`} className="px-3 py-2.5 text-slate-600">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison.note ? <p className="mt-2 text-xs text-slate-500">{comparison.note}</p> : null}
    </section>
  );
}

function CityLayout({
  kicker,
  title,
  description,
  canonical,
  h1,
  lead,
  image,
  simpleHero = false,
  jsonLd,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
  continueTitle,
  continueBody,
  continueTo,
  continueLabel,
  wide = false,
  children,
}) {
  const hero = image || citySeo.home.heroImage;
  const priTo = primaryTo || '/';
  const priLabel = primaryLabel || 'Continue to Luminexa';
  const secTo = secondaryTo || '/services';
  const secLabel = secondaryLabel || 'Find local help';
  const contTitle = continueTitle || 'Ready to continue?';
  const contBody =
    continueBody ||
    'Open Luminexa to browse services, book open times, or set up your provider account.';
  const contTo = continueTo || '/';
  const contLabel = continueLabel || 'Go to homepage';

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SeoHead title={title} description={description} canonical={canonical} jsonLd={jsonLd} />
      <section
        className={`relative overflow-hidden text-white ${
          simpleHero
            ? 'bg-gradient-to-br from-teal-950 via-teal-800 to-teal-900'
            : 'flex min-h-[72vh] items-end bg-teal-950'
        }`}
      >
        {!simpleHero && (
          <>
            <img
              src={hero}
              alt=""
              className="absolute inset-0 h-full w-full scale-105 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-teal-950/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/40" />
          </>
        )}
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
        <div
          className={`relative z-10 mx-auto w-full max-w-6xl px-4 md:px-8 ${
            simpleHero ? 'pb-10 pt-24 md:pb-12' : 'pb-10 pt-28 md:pb-14'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">{kicker}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {h1}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/95 sm:text-lg">{lead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={priTo}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-teal-400 px-8 text-sm font-bold text-teal-950 shadow-xl shadow-teal-950/30"
            >
              {priLabel}
            </Link>
            <Link
              to={secTo}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/40 bg-white/15 px-8 text-sm font-semibold text-white"
            >
              {secLabel}
            </Link>
          </div>
        </div>
      </section>
      <main className={`mx-auto px-4 py-10 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-900">{contTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{contBody}</p>
          <Link
            to={contTo}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-teal-600 px-6 text-sm font-semibold text-white"
          >
            {contLabel}
          </Link>
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 md:px-8">
          <div className="mb-3">
            <InstagramLink />
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {citySeo.cities.map((c) => (
              <Link key={c.slug} to={`/${c.slug}`} className="text-teal-700 hover:underline">
                {c.city}
              </Link>
            ))}
            <Link to="/for-new-providers" className="text-teal-700 hover:underline">
              For providers
            </Link>
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
            Luminexa is a booking and business app for local service providers.
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
      simpleHero
      primaryTo="/for-new-providers"
      primaryLabel="For new providers"
      secondaryTo="/register/business"
      secondaryLabel="Offer services"
      continueTitle="Compare tools, then list"
      continueBody="See which alternative fits, then start the Luminexa Pro trial — no card required."
      continueTo="/register/business"
      continueLabel="Offer services"
      wide
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
      <h2 className="pt-4 text-base font-semibold text-slate-900">New entrepreneurs</h2>
      <p>
        Starting a local service business? Read{' '}
        <Link to="/for-new-providers" className="font-medium text-teal-700">
          best value for new providers
        </Link>{' '}
        and{' '}
        <Link to="/pricing" className="font-medium text-teal-700">
          Luminexa pricing
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
      simpleHero={page.simpleHero !== false}
      primaryTo={page.primaryCtaHref || '/register/business'}
      primaryLabel={page.primaryCtaLabel || 'Start as a provider'}
      secondaryTo={page.secondaryCtaHref || '/pricing'}
      secondaryLabel={page.secondaryCtaLabel || 'See pricing'}
      continueTitle={page.continueTitle}
      continueBody={page.continueBody}
      continueTo={page.continueCtaHref || '/register/business'}
      continueLabel={page.continueCtaLabel || 'Offer services'}
      wide={Boolean(page.comparison)}
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
      <ComparisonTable comparison={page.comparison} />
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
        <Link to="/for-new-providers" className="font-medium text-teal-700">
          for new providers
        </Link>
        ,{' '}
        <Link to="/alternatives" className="font-medium text-teal-700">
          all alternatives
        </Link>
        , and{' '}
        <Link to="/pricing" className="font-medium text-teal-700">
          pricing
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
