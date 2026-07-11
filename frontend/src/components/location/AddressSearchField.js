import React, { useEffect, useRef, useState } from 'react';
import useAddressCountry from '../../hooks/useAddressCountry';
import useAddressSearch from '../../hooks/useAddressSearch';
import { useAuth } from '../../contexts/AuthContext';
import { ADDRESS_SEARCH_MIN_CHARS, shouldSearchAddressQuery } from '../../constants/addressSearch';

/**
 * Type-to-search address picker with live results as you type.
 */
export default function AddressSearchField({
  id = 'address-search',
  label = 'Search address',
  placeholder = 'Search street, city, or landmark…',
  value,
  onChange,
  onSelect,
  country: countryProp,
  className = '',
  dark = false,
}) {
  const { user } = useAuth();
  const { country: detectedCountry } = useAddressCountry({
    initialCountry: countryProp || user?.address_country,
  });
  const country = countryProp || detectedCountry;
  const isControlled = value !== undefined;
  const [internalQuery, setInternalQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const blurTimerRef = useRef(null);
  const pickingRef = useRef(false);

  const committedValue = isControlled ? (value ?? '') : internalQuery;
  const displayQuery = focused ? draftQuery : committedValue;
  const searchQuery = focused ? draftQuery : '';

  const { results, searching, error, setResults } = useAddressSearch(searchQuery, country);

  useEffect(() => () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
  }, []);

  const updateCommitted = (next) => {
    if (isControlled) {
      onChange?.(next);
    } else {
      setInternalQuery(next);
    }
  };

  const handleFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setFocused(true);
    setDraftQuery(committedValue);
  };

  const handleBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      if (pickingRef.current) {
        pickingRef.current = false;
        return;
      }
      setFocused(false);
      setResults([]);
      const trimmed = draftQuery.trim();
      if (trimmed && trimmed !== committedValue.trim()) {
        updateCommitted(trimmed);
      }
    }, 250);
  };

  const handleChange = (e) => {
    const next = e.target.value;
    setDraftQuery(next);
    if (!isControlled) {
      setInternalQuery(next);
      onChange?.(next);
    }
  };

  const pick = (item) => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    pickingRef.current = false;
    const displayName = item.display_name || '';
    onSelect?.({
      address: displayName,
      city: item.city || '',
      state: item.state || item.province || '',
      postal_code: item.postal_code || '',
      country: item.country || country || '',
      lat: item.latitude,
      lng: item.longitude,
    });
    updateCommitted(displayName);
    setDraftQuery(displayName);
    setFocused(false);
    setResults([]);
  };

  const preventBlurForPick = (e) => {
    e.preventDefault();
    pickingRef.current = true;
  };

  const labelClass = dark
    ? 'mb-1 block text-sm font-medium text-luminexa-mist'
    : 'mb-1 block text-sm font-medium text-slate-700';
  const inputCls = dark
    ? 'w-full min-h-[48px] rounded-lg border border-white/10 bg-luminexa-navy/80 px-3 text-base text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent'
    : 'w-full min-h-[48px] rounded-lg border border-slate-200 px-3 text-base text-slate-900 outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';
  const hintClass = dark ? 'text-luminexa-mist/60' : 'text-slate-500';
  const errorClass = dark ? 'text-amber-300' : 'text-amber-700';
  const listClass = dark
    ? 'mt-2 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-luminexa-navy shadow-sm'
    : 'mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm';
  const itemClass = dark
    ? 'block w-full border-b border-white/10 px-3 py-3 text-left text-sm text-luminexa-mist last:border-b-0 active:bg-violet-500/20'
    : 'block w-full border-b border-slate-100 px-3 py-3 text-left text-sm text-slate-700 last:border-b-0 active:bg-violet-50';

  const trimmed = displayQuery.trim();
  const showHint = focused && trimmed.length > 0 && !shouldSearchAddressQuery(displayQuery);

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={displayQuery}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="street-address"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        className={inputCls}
      />
      {showHint && (
        <p className={`mt-1 text-xs ${hintClass}`}>
          Type {ADDRESS_SEARCH_MIN_CHARS}+ characters for suggestions…
        </p>
      )}
      {focused && searching && shouldSearchAddressQuery(displayQuery) && (
        <p className={`mt-1 text-xs ${hintClass}`}>Searching…</p>
      )}
      {focused && error && !searching && shouldSearchAddressQuery(displayQuery) && (
        <p className={`mt-1 text-xs ${errorClass}`}>{error}</p>
      )}
      {focused && results.length > 0 && (
        <ul className={listClass} role="listbox" aria-label="Address suggestions">
          {results.map((item) => (
            <li key={`${item.latitude}-${item.longitude}-${item.display_name}`} role="option">
              <button
                type="button"
                onPointerDown={preventBlurForPick}
                onTouchStart={preventBlurForPick}
                onMouseDown={preventBlurForPick}
                onClick={() => pick(item)}
                className={itemClass}
              >
                {item.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
