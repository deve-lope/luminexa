import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookableServiceCard from '../../components/customer/BookableServiceCard';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import LocationFilterBar from '../../components/customer/LocationFilterBar';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import { DEFAULT_RADIUS_MILES } from '../../constants/locationSearch';
import { businessesAPI } from '../../utils/api';

export default function CustomerFindPage() {
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

  const loadCatalog = useCallback(() => {
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

  return (
    <div className="space-y-6">
      <ServiceSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search car wash, plumbing, pet grooming…"
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
              <section className="rounded-xl bg-white p-6 text-center shadow-sm">
                <p className="text-slate-600">No services match your search or location.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different PIN, widen the mile radius, or pick another category.
                </p>
                {(postal || city || state || query) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setPostal('');
                      setRadiusMiles(DEFAULT_RADIUS_MILES);
                      setCity('');
                      setState('');
                    }}
                    className="mt-4 text-sm font-medium text-luminexa-accent"
                  >
                    Reset filters
                  </button>
                )}
              </section>
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

      <p className="text-center text-sm text-slate-500">
        <Link to="/services" className="font-medium text-luminexa-accent">
          Public services page →
        </Link>
      </p>
    </div>
  );
}
