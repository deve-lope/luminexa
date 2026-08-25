import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import { PLAY_STORE_URL } from '../utils/storeLinks';
import { cityBySlug, citySeo, resolvedCategories } from '../seo/citySeo';

function useSeoCity() {
  const { pathname } = useLocation();
  return cityBySlug(pathname.split('/').filter(Boolean)[0]);
}

function CityLayout({
  city,
  title,
  description,
  canonical,
  h1,
  lead,
  image,
  jsonLd,
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
            {city.city}
          </p>
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
              to="/services"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 text-sm font-semibold text-white"
            >
              Find help in {city.city}
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
            <Link to="/privacy" className="hover:text-teal-700">
              Privacy
            </Link>
            <a href={PLAY_STORE_URL} className="hover:text-teal-700">
              Google Play
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
      city={city}
      title={city.hub.title}
      description={city.hub.description}
      canonical={canonical}
      h1={city.hub.h1}
      lead={city.hub.intro}
      image={citySeo.home.heroImage}
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
      <h2 className="pt-4 text-base font-semibold text-slate-900">Neighbourhoods</h2>
      <p>
        Customers use Luminexa from across {city.city}, including {city.neighbourhoods.join(', ')}.
      </p>
      {city.faq.map((item) => (
        <section key={item.q}>
          <h2 className="pt-4 text-base font-semibold text-slate-900">{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
    </CityLayout>
  );
}

export function CityCategoryPage() {
  const city = useSeoCity();
  const { slug } = useParams();
  if (!city) return <Navigate to="/" replace />;

  const cat = resolvedCategories(city.city).find((c) => c.slug === slug);
  if (!cat) return <Navigate to={`/${city.slug}`} replace />;

  const canonical = `${citySeo.siteUrl}/${city.slug}/${cat.slug}/`;
  return (
    <CityLayout
      city={city}
      title={cat.title}
      description={cat.description}
      canonical={canonical}
      h1={cat.h1}
      lead={cat.blurb}
      image={cat.image}
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
        service area covers you.
      </p>
      <p>
        <Link to={`/${city.slug}`} className="font-medium text-teal-700">
          All {city.city} services
        </Link>
      </p>
    </CityLayout>
  );
}

/** @deprecated Use CityHubPage */
export const OttawaHubPage = CityHubPage;
/** @deprecated Use CityCategoryPage */
export const OttawaCategoryPage = CityCategoryPage;
