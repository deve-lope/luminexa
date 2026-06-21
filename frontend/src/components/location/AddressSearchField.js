import React, { useEffect, useState } from 'react';
import { businessesAPI } from '../../utils/api';

/**
 * Type-to-search address picker (works on HTTP — no GPS permission needed).
 */
export default function AddressSearchField({
  id = 'address-search',
  label = 'Search address',
  placeholder = 'Search street, city, or landmark…',
  onSelect,
  className = '',
  dark = false,
}) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      businessesAPI
        .searchMapLocations(q)
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res.data?.results) ? res.data.results : [];
          setResults(list);
          if (!list.length) {
            setError('No matches — try a more specific address.');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setError('Could not search right now. Type your address manually.');
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const pick = (item) => {
    onSelect({
      address: item.display_name || '',
      city: item.city || '',
      state: item.state || item.province || '',
      postal_code: item.postal_code || '',
      lat: item.latitude,
      lng: item.longitude,
    });
    setQuery(item.display_name || '');
    setResults([]);
    setError(null);
  };

  const labelClass = dark
    ? 'mb-1 block text-sm font-medium text-luminexa-mist'
    : 'mb-1 block text-sm font-medium text-slate-700';
  const inputCls = dark
    ? 'w-full min-h-[44px] rounded-lg border border-white/10 bg-luminexa-navy/80 px-3 text-sm text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent'
    : 'w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';
  const hintClass = dark ? 'text-luminexa-mist/60' : 'text-slate-500';
  const errorClass = dark ? 'text-amber-300' : 'text-amber-700';
  const listClass = dark
    ? 'mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-luminexa-navy shadow-sm'
    : 'mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm';
  const itemClass = dark
    ? 'block w-full border-b border-white/10 px-3 py-2.5 text-left text-sm text-luminexa-mist last:border-b-0 hover:bg-violet-500/20'
    : 'block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 last:border-b-0 hover:bg-violet-50';

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="street-address"
        className={inputCls}
      />
      {searching && <p className={`mt-1 text-xs ${hintClass}`}>Searching…</p>}
      {error && !searching && <p className={`mt-1 text-xs ${errorClass}`}>{error}</p>}
      {results.length > 0 && (
        <ul className={listClass}>
          {results.map((item) => (
            <li key={`${item.latitude}-${item.longitude}-${item.display_name}`}>
              <button type="button" onClick={() => pick(item)} className={itemClass}>
                {item.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
