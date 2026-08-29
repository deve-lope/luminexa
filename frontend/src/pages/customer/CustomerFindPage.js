import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookableServiceCard from '../../components/customer/BookableServiceCard';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import CustomerSearchMapView from '../../components/customer/CustomerSearchMapView';
import LocationSearchBar from '../../components/customer/LocationSearchBar';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { DEFAULT_RADIUS_MILES } from '../../constants/locationSearch';
import useNearMeLocation from '../../hooks/useNearMeLocation';
import { businessesAPI } from '../../utils/api';
import { compareDateKeys, todayKey } from '../../utils/dateRange';
import {
  canUseBrowserGeolocation,
  shareLocationButtonLabel,
} from '../../utils/geolocationSupport';
import LocationEnablePrompt from '../../components/customer/LocationEnablePrompt';
import { isPostalSearchReady, normalizePostalInput } from '../../utils/postalInput';

export default function CustomerFindPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [query, setQuery] = useState('');
  const [dateMode, setDateMode] = useState('any'); // 'any' | 'single' | 'range'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [postal, setPostal] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [types, setTypes] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationExpanded, setLocationExpanded] = useState(false);

  const {
    location: nearMe,
    locating,
    error: nearMeError,
    errorKind: nearMeErrorKind,
    requestNearMe,
    applyLocation,
    clearLocation,
  } = useNearMeLocation({ defaultRadiusMiles: radiusMiles });

  // Hydrate from persisted near-me on first ready read.
  useEffect(() => {
    if (!nearMe) return;
    setLocationLat(nearMe.lat);
    setLocationLng(nearMe.lng);
    setLocationLabel(nearMe.label || '');
    if (nearMe.postal) setPostal(normalizePostalInput(nearMe.postal));
    if (nearMe.radiusMiles) setRadiusMiles(nearMe.radiusMiles);
  }, [nearMe]);

  const hasCoords = locationLat != null && locationLng != null;
  const hasLocation = hasCoords || isPostalSearchReady(postal);
  const qReady = query.trim().length >= 2;
  const shouldSearch = hasLocation || qReady;
  const gpsAvailable = canUseBrowserGeolocation();

  const loadCatalog = useCallback(() => {
    if (!shouldSearch) {
      setTypes([]);
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Prefer lat/lng when present. Still send postal so ungeocoded ZIP matches are included.
    const params = {};
    if (hasLocation) {
      params.radius_miles = radiusMiles;
    }
    if (hasCoords) {
      params.lat = locationLat;
      params.lng = locationLng;
    }
    if (isPostalSearchReady(postal)) {
      params.postal = normalizePostalInput(postal);
    }
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
  }, [
    shouldSearch,
    hasLocation,
    hasCoords,
    query,
    postal,
    locationLat,
    locationLng,
    radiusMiles,
    dateMode,
    dateFrom,
    dateTo,
  ]);

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

  const handleLocationChange = useCallback(
    ({ postal: nextPostal, lat, lng, label, country, radiusMiles: r }) => {
      const nextLat = lat != null ? Number(lat) : null;
      const nextLng = lng != null ? Number(lng) : null;
      setPostal(normalizePostalInput(nextPostal || ''));
      setLocationLat(nextLat);
      setLocationLng(nextLng);
      if (label) setLocationLabel(label);
      if (r != null) setRadiusMiles(r);
      if (nextLat != null && nextLng != null) {
        applyLocation({
          lat: nextLat,
          lng: nextLng,
          label: label || locationLabel,
          postal: nextPostal || '',
          country: country || '',
          radiusMiles: r != null ? r : radiusMiles,
        });
      }
    },
    [applyLocation, locationLabel, radiusMiles]
  );

  const handleRadiusChange = useCallback(
    (next) => {
      setRadiusMiles(next);
      if (locationLat != null && locationLng != null) {
        applyLocation({
          lat: locationLat,
          lng: locationLng,
          label: locationLabel,
          postal,
          radiusMiles: next,
        });
      }
    },
    [applyLocation, locationLat, locationLng, locationLabel, postal]
  );

  const handleLocationClear = useCallback(() => {
    setPostal('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationLabel('');
    setRadiusMiles(DEFAULT_RADIUS_MILES);
    setLocationExpanded(false);
    clearLocation();
  }, [clearLocation]);

  const handleUseMyLocation = useCallback(() => {
    requestNearMe().then((next) => {
      if (!next) return;
      setLocationLat(next.lat);
      setLocationLng(next.lng);
      setLocationLabel(next.label || '');
      if (next.postal) setPostal(normalizePostalInput(next.postal));
      if (next.radiusMiles) setRadiusMiles(next.radiusMiles);
      setLocationExpanded(true);
    });
  }, [requestNearMe]);

  const handleMapLocationSearch = useCallback(
    ({ postal: nextPostal, lat, lng, radiusMiles: r, label }) => {
      if (nextPostal) setPostal(normalizePostalInput(nextPostal));
      else if (lat != null && lng != null) setPostal('');
      const nextLat = lat != null ? Number(lat) : null;
      const nextLng = lng != null ? Number(lng) : null;
      setLocationLat(nextLat);
      setLocationLng(nextLng);
      if (r != null) setRadiusMiles(r);
      if (nextLat != null && nextLng != null) {
        const display =
          label ||
          locationLabel ||
          (nextPostal ? normalizePostalInput(nextPostal) : `${nextLat.toFixed(5)}, ${nextLng.toFixed(5)}`);
        setLocationLabel(display);
        applyLocation({
          lat: nextLat,
          lng: nextLng,
          label: display,
          postal: nextPostal || '',
          radiusMiles: r != null ? r : radiusMiles,
        });
      }
    },
    [applyLocation, locationLabel, radiusMiles]
  );

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

  const nearLabelShort = locationLabel
    ? locationLabel.length > 42
      ? `${locationLabel.slice(0, 40)}…`
      : locationLabel
    : '';

  return (
    <div className="space-y-6">
      {/* List / Map toggle */}
      <div className="flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-1 shadow-lx-soft">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
            viewMode === 'list' ? 'lx-toggle-active' : 'lx-toggle-idle'
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
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
            viewMode === 'map' ? 'lx-toggle-active' : 'lx-toggle-idle'
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
        <CustomerSearchMapView
          services={services}
          onLocationSearch={handleMapLocationSearch}
          initialLat={locationLat}
          initialLng={locationLng}
          initialRadius={radiusMiles}
        />
      )}

      {viewMode === 'list' && (
        <>
          <ServiceSearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search car wash, plumbing, pet grooming…"
          />

          {/* Near-me chip row */}
          <div className="flex flex-wrap items-center gap-2">
            {hasCoords ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm text-teal-900">
                <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                </svg>
                <span className="truncate font-medium">
                  Near {nearLabelShort || 'your location'}
                </span>
                <button
                  type="button"
                  onClick={() => setLocationExpanded((v) => !v)}
                  className="shrink-0 font-semibold text-teal-800 underline-offset-2 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                {gpsAvailable && (
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    </svg>
                    {shareLocationButtonLabel({ locating })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocationExpanded((v) => !v)}
                  className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {locationExpanded ? 'Hide address' : 'Enter address'}
                </button>
              </>
            )}
          </div>

          {nearMeError && !locationExpanded && (
            <LocationEnablePrompt
              error={nearMeError}
              errorKind={nearMeErrorKind}
              locating={locating}
              onRetry={handleUseMyLocation}
              onEnterAddress={() => setLocationExpanded(true)}
            />
          )}

          {locationExpanded && (
            <LocationSearchBar
              key={hasCoords ? `${locationLat},${locationLng}` : 'empty'}
              radiusMiles={radiusMiles}
              onLocationChange={handleLocationChange}
              onRadiusChange={handleRadiusChange}
              onClear={handleLocationClear}
              onUseMyLocation={handleUseMyLocation}
              locating={locating}
              locationError={nearMeError}
              locationErrorKind={nearMeErrorKind}
              externalLat={locationLat}
              externalLng={locationLng}
              externalLabel={locationLabel}
              services={services}
            />
          )}

          <section className="lx-card">
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

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100/80 p-1 text-sm">
              {[
                ['any', 'Any'],
                ['single', 'Single date'],
                ['range', 'Range'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateDateMode(mode)}
                  className={`min-h-[44px] rounded-lg px-2 font-semibold transition ${
                    dateMode === mode ? 'lx-toggle-active' : 'lx-toggle-idle bg-transparent'
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

          {!shouldSearch ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="mt-3 text-base font-semibold text-slate-800">Search what you need</p>
              <p className="mt-1 text-sm text-slate-500">
                Type a service keyword, or use your location to see what&apos;s nearby.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              {loading ? (
                <div aria-busy="true" aria-label="Loading available services">
                  <Skeleton className="mb-3 h-4 w-28" />
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                  </div>
                  <Skeleton className="mb-3 h-4 w-36" />
                  <SkeletonList count={4} />
                </div>
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
                      <div className="lx-empty">
                        <p className="text-slate-600">
                          {hasLocation
                            ? 'No services found in this area.'
                            : 'No services match that search.'}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {hasLocation
                            ? 'Providers only appear if you are inside their service area and your search radius. Try another area, widen the radius, or change the keyword.'
                            : 'Try another keyword, or share your location to see nearby providers.'}
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
