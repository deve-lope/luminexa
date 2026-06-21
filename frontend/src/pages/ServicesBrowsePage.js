import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BookableServiceCard from '../components/customer/BookableServiceCard';
import BusinessTypeTileGrid from '../components/customer/BusinessTypeTileGrid';
import CustomerSearchMapView from '../components/customer/CustomerSearchMapView';
import LocationSearchBar from '../components/customer/LocationSearchBar';
import ServiceSearchBar from '../components/customer/ServiceSearchBar';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_RADIUS_MILES } from '../constants/locationSearch';
import { businessesAPI } from '../utils/api';
import { bookService } from '../utils/customerPaths';

export default function ServicesBrowsePage({ embedded = false }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useState('list');
  const [query, setQuery] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [types, setTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBrowse = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    const q = query.trim();
    if (q) params.q = q;
    if (locationLat != null && locationLng != null) {
      params.lat = locationLat.toFixed(6);
      params.lng = locationLng.toFixed(6);
      params.radius_miles = radiusMiles;
    }

    businessesAPI
      .browseServices(params)
      .then((res) => {
        const data = res.data || {};
        setTypes(Array.isArray(data.business_types) ? data.business_types : []);
        setServices(Array.isArray(data.services) ? data.services : []);
      })
      .catch(() => setError('Could not load services.'))
      .finally(() => setLoading(false));
  }, [query, locationLat, locationLng, radiusMiles]);

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

  const handleLocationChange = useCallback(({ lat, lng, label, radiusMiles: r }) => {
    setLocationLat(lat);
    setLocationLng(lng);
    setLocationLabel(label || '');
    if (r != null) setRadiusMiles(r);
  }, []);

  const handleRadiusChange = useCallback((next) => {
    setRadiusMiles(next);
  }, []);

  const handleLocationClear = useCallback(() => {
    setLocationLat(null);
    setLocationLng(null);
    setLocationLabel('');
    setRadiusMiles(DEFAULT_RADIUS_MILES);
  }, []);

  const handleMapLocationSearch = useCallback(
    ({ lat, lng, radiusMiles: r }) => {
      setLocationLat(lat);
      setLocationLng(lng);
      if (r != null) setRadiusMiles(r);
    },
    []
  );

  const viewToggle = (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition ${
          viewMode === 'list' ? 'bg-luminexa-accent text-white' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3" cy="6" r="1" fill="currentColor" />
          <circle cx="3" cy="12" r="1" fill="currentColor" />
          <circle cx="3" cy="18" r="1" fill="currentColor" />
        </svg>
        List
      </button>
      <button
        type="button"
        onClick={() => setViewMode('map')}
        className={`flex flex-1 items-center justify-center gap-1.5 border-l border-slate-200 py-2.5 text-sm font-medium transition ${
          viewMode === 'map' ? 'bg-luminexa-accent text-white' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
        Map
      </button>
    </div>
  );

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Find a service</h1>
          <p className="mt-1 text-sm text-slate-600">
            Car wash, pet grooming, plumbing, electrical, and more — book local providers.
          </p>
        </div>
      )}

      {viewToggle}

      {viewMode === 'map' ? (
        <CustomerSearchMapView
          services={services}
          onLocationSearch={handleMapLocationSearch}
        />
      ) : (
        <>
          <ServiceSearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search plumbing, car wash, pet grooming…"
          />

          <LocationSearchBar
            radiusMiles={radiusMiles}
            locationLabel={locationLabel}
            onLocationChange={handleLocationChange}
            onRadiusChange={handleRadiusChange}
            onClear={handleLocationClear}
            services={services}
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
      )}
    </div>
  );

  if (embedded) return content;

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
      <main className="mx-auto max-w-2xl px-4 py-6">{content}</main>
    </div>
  );
}
