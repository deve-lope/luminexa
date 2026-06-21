import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookableServiceCard from '../../components/customer/BookableServiceCard';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import CustomerSearchMapView from '../../components/customer/CustomerSearchMapView';
import LocationSearchBar from '../../components/customer/LocationSearchBar';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import { DEFAULT_RADIUS_MILES } from '../../constants/locationSearch';
import { businessesAPI } from '../../utils/api';
import { compareDateKeys, todayKey } from '../../utils/dateRange';

export default function CustomerFindPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [query, setQuery] = useState('');
  const [dateMode, setDateMode] = useState('any'); // 'any' | 'single' | 'range'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [types, setTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasLocation = locationLat != null && locationLng != null;

  const loadCatalog = useCallback(() => {
    if (!hasLocation) {
      setTypes([]);
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = {
      lat: locationLat.toFixed(6),
      lng: locationLng.toFixed(6),
      radius_miles: radiusMiles,
    };
    const q = query.trim();
    if (q) params.q = q;
    if (dateMode === 'single' && dateFrom) {
      params.date_from = dateFrom;
      params.date_to = dateFrom;
    }
    if (dateMode === 'range' && (dateFrom || dateTo)) {
      params.date_from = dateFrom || dateTo;
      params.date_to = dateTo || dateFrom;
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
  }, [hasLocation, query, locationLat, locationLng, radiusMiles, dateMode, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(loadCatalog, 250);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

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

  const handleLocationChange = useCallback(({ lat, lng, label, radiusMiles: r }) => {
    setLocationLat(lat);
    setLocationLng(lng);
    setLocationLabel(label || '');
    if (r != null) setRadiusMiles(r);
  }, []);

  const handleRadiusChange = useCallback((next) => setRadiusMiles(next), []);

  const handleLocationClear = useCallback(() => {
    setLocationLat(null);
    setLocationLng(null);
    setLocationLabel('');
    setRadiusMiles(DEFAULT_RADIUS_MILES);
  }, []);

  const handleMapLocationSearch = useCallback(({ lat, lng, radiusMiles: r }) => {
    setLocationLat(lat);
    setLocationLng(lng);
    if (r != null) setRadiusMiles(r);
  }, []);

  const minDate = todayKey();
  const hasDateFilter =
    (dateMode === 'single' && Boolean(dateFrom)) ||
    (dateMode === 'range' && (Boolean(dateFrom) || Boolean(dateTo)));
  const hasFilter = hasLocation || query.trim() || hasDateFilter;

  const updateDateMode = useCallback((mode) => {
    setDateMode(mode);
    if (mode === 'any') {
      setDateFrom('');
      setDateTo('');
    } else if (mode === 'single') {
      setDateTo('');
    }
  }, []);

  const updateDateFrom = useCallback((value) => {
    setDateFrom(value);
    if (dateMode === 'range' && dateTo && value && compareDateKeys(dateTo, value) < 0) {
      setDateTo(value);
    }
  }, [dateMode, dateTo]);

  const updateDateTo = useCallback((value) => {
    if (dateFrom && value && compareDateKeys(value, dateFrom) < 0) {
      setDateTo(dateFrom);
      return;
    }
    setDateTo(value);
  }, [dateFrom]);

  return (
    <div className="space-y-6">
      {/* List / Map toggle */}
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition ${
            viewMode === 'list' ? 'bg-luminexa-accent text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/>
            <circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>
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
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          Map
        </button>
      </div>

      {viewMode === 'map' && (
        <CustomerSearchMapView services={services} onLocationSearch={handleMapLocationSearch} />
      )}

      {viewMode === 'list' && (
        <>
          <LocationSearchBar
            radiusMiles={radiusMiles}
            locationLabel={locationLabel}
            onLocationChange={handleLocationChange}
            onRadiusChange={handleRadiusChange}
            onClear={handleLocationClear}
            services={services}
          />

          {hasLocation && (
            <ServiceSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search car wash, plumbing, pet grooming…"
            />
          )}

          {hasLocation && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">When do you need it?</h2>
                <p className="text-sm text-slate-500">Any date is selected by default.</p>
              </div>
              {hasDateFilter && (
                <button
                  type="button"
                  onClick={() => updateDateMode('any')}
                  className="min-h-[40px] self-start text-sm font-medium text-luminexa-accent sm:self-auto"
                >
                  Clear date
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-sm">
              {[
                ['any', 'Any'],
                ['single', 'Single date'],
                ['range', 'Range'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateDateMode(mode)}
                  className={`min-h-[44px] px-2 font-medium transition ${
                    dateMode === mode
                      ? 'bg-luminexa-accent text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dateMode !== 'any' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600">
                  {dateMode === 'single' ? 'Date' : 'Start date'}
                  <input
                    type="date"
                    min={minDate}
                    value={dateFrom}
                    onChange={(e) => updateDateFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                  />
                </label>
                {dateMode === 'range' && (
                  <label className="block text-xs font-medium text-slate-600">
                    End date
                    <input
                      type="date"
                      min={dateFrom || minDate}
                      value={dateTo}
                      onChange={(e) => updateDateTo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </label>
                )}
              </div>
            )}
          </section>
          )}

          {!hasLocation ? (
            <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
              <svg className="mx-auto h-10 w-10 text-luminexa-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <p className="mt-3 text-base font-semibold text-slate-800">Set your location to get started</p>
              <p className="mt-1 text-sm text-slate-500">
                Choose a city, address, or use GPS above so we can show providers near you.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              {loading ? (
                <p className="text-sm text-slate-500">Loading available services…</p>
              ) : (
                <>
                  <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Categories
                    </h2>
                    {filteredTypes.length === 0 ? (
                      <p className="text-sm text-slate-500">No categories match your search.</p>
                    ) : (
                      <BusinessTypeTileGrid types={filteredTypes} />
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
                      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
                        <p className="text-slate-600">No services found in this area.</p>
                        <p className="mt-2 text-sm text-slate-500">
                          Try a different city, widen the radius, or search by service name.
                        </p>
                        {hasFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery('');
                              handleLocationClear();
                              updateDateMode('any');
                            }}
                            className="mt-4 text-sm font-medium text-luminexa-accent"
                          >
                            Reset filters
                          </button>
                        )}
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {services.map((s) => (
                          <li key={`${s.organization_slug}-${s.id}`}>
                            <BookableServiceCard service={s} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          <p className="text-center text-sm text-slate-500">
            <Link to="/services" className="font-medium text-luminexa-accent">
              Public services page →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
