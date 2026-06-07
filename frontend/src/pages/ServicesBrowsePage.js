import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BookableServiceCard from '../components/customer/BookableServiceCard';
import BusinessTypeTileGrid from '../components/customer/BusinessTypeTileGrid';
import LocationFilterBar from '../components/customer/LocationFilterBar';
import ServiceSearchBar from '../components/customer/ServiceSearchBar';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_RADIUS_MILES } from '../constants/locationSearch';
import { businessesAPI } from '../utils/api';
import { bookService, customerHome } from '../utils/customerPaths';

export default function ServicesBrowsePage({ embedded = false }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [postal, setPostal] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [types, setTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [postalCodes, setPostalCodes] = useState([]);
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBrowse = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    const q = query.trim();
    const p = postal.trim();
    const c = city.trim();
    const s = state.trim();
    if (q) params.q = q;
    if (p) {
      params.postal = p;
      params.radius_miles = radiusMiles;
    }
    if (c) params.city = c;
    if (s) params.state = s;

    businessesAPI
      .browseServices(params)
      .then((res) => {
        const data = res.data || {};
        setTypes(Array.isArray(data.business_types) ? data.business_types : []);
        setServices(Array.isArray(data.services) ? data.services : []);
        setPostalCodes(Array.isArray(data.postal_codes) ? data.postal_codes : []);
        setCities(Array.isArray(data.cities) ? data.cities : []);
        setStates(Array.isArray(data.states) ? data.states : []);
      })
      .catch(() => setError('Could not load services.'))
      .finally(() => setLoading(false));
  }, [query, postal, radiusMiles, city, state]);

  useEffect(() => {
    const timer = setTimeout(loadBrowse, 250);
    return () => clearTimeout(timer);
  }, [loadBrowse]);

  const filteredTypes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return types;
    return types.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.slug?.toLowerCase().includes(q)
    );
  }, [types, query]);

  const typeLink = (typeSlug) => {
    if (isAuthenticated) return `/customer/find/${typeSlug}`;
    return `/login?next=${encodeURIComponent(`/customer/find/${typeSlug}`)}`;
  };

  const bookLink = (orgSlug, serviceId) => {
    const path = bookService(orgSlug, serviceId);
    if (isAuthenticated) return path;
    return `/login?next=${encodeURIComponent(path)}`;
  };

  const content = (
    <>
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Find a service</h1>
            <p className="mt-1 text-sm text-slate-600">
              Car wash, pet grooming, plumbing, electrical, and more — book local providers.
            </p>
          </div>
        )}

        <ServiceSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search plumbing, car wash, pet grooming…"
        />

        <LocationFilterBar
          postal={postal}
          radiusMiles={radiusMiles}
          city={city}
          state={state}
          postalCodes={postalCodes}
          cities={cities}
          states={states}
          onPostalChange={setPostal}
          onRadiusChange={setRadiusMiles}
          onCityChange={setCity}
          onStateChange={setState}
          onClear={() => {
            setPostal('');
            setRadiusMiles(DEFAULT_RADIUS_MILES);
            setCity('');
            setState('');
          }}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading services…</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Service categories
              </h2>
              {filteredTypes.length === 0 ? (
                <p className="text-sm text-slate-500">No categories match your search.</p>
              ) : (
                <BusinessTypeTileGrid types={filteredTypes} getLinkTo={typeLink} />
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Available to book
                {services.length > 0 && (
                  <span className="ml-2 font-normal normal-case text-slate-400">
                    ({services.length})
                  </span>
                )}
              </h2>
              {services.length === 0 ? (
                <div className="rounded-xl bg-white p-5 text-center shadow-sm">
                  <p className="text-sm text-slate-600">
                    No providers listed yet for this search.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Pick a category above or{' '}
                    <Link to="/register/business" className="font-medium text-luminexa-accent">
                      register your business
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {services.map((s) => (
                    <li key={`${s.organization_slug}-${s.id}`}>
                      <BookableServiceCard
                        service={s}
                        bookTo={bookLink(s.organization_slug, s.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {!isAuthenticated && !embedded && (
          <div className="rounded-xl bg-luminexa-navy p-5 text-center text-white">
            <p className="text-sm text-white/80">Sign in to connect with a provider and book.</p>
            <button
              type="button"
              onClick={() => navigate('/login?next=/services')}
              className="mt-3 min-h-[44px] rounded-lg bg-luminexa-accent px-6 font-medium"
            >
              Sign in to book
            </button>
          </div>
        )}
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            Luminexa
          </Link>
          <div className="flex gap-3 text-sm">
            <Link to="/login" className="font-medium text-slate-600">
              Sign in
            </Link>
            <Link to="/register" className="font-medium text-luminexa-accent">
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">{content}</main>
    </div>
  );
}
