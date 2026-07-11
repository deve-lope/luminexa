import { useEffect, useRef, useState } from 'react';
import { businessesAPI } from '../utils/api';
import {
  addressSearchDebounceMs,
  addressSearchTerm,
  ADDRESS_SEARCH_MIN_CHARS,
  shouldSearchAddressQuery,
} from '../constants/addressSearch';

function isAbortError(err) {
  return (
    err?.code === 'ERR_CANCELED'
    || err?.name === 'CanceledError'
    || err?.message === 'canceled'
  );
}

/**
 * Live address search while typing — fires every 2+ chars or immediately on space.
 */
export default function useAddressSearch(query, country) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!shouldSearchAddressQuery(query)) {
      setResults([]);
      setError(null);
      setSearching(false);
      return undefined;
    }

    const q = addressSearchTerm(query);
    setSearching(true);
    setError(null);
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const delay = addressSearchDebounceMs(query);

    const run = () => {
      businessesAPI
        .searchMapLocations(q, country, { signal: controller.signal })
        .then((res) => {
          if (cancelled || requestId !== requestIdRef.current) return;
          const list = Array.isArray(res.data?.results) ? res.data.results : [];
          setResults(list);
          if (!list.length) {
            setError('No matches — keep typing or try a more specific address.');
          }
        })
        .catch((err) => {
          if (cancelled || requestId !== requestIdRef.current || isAbortError(err)) return;
          setResults([]);
          setError('Could not search right now. Type your address manually.');
        })
        .finally(() => {
          if (!cancelled && requestId === requestIdRef.current) {
            setSearching(false);
          }
        });
    };

    const timer = delay === 0 ? null : window.setTimeout(run, delay);
    if (delay === 0) run();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer != null) window.clearTimeout(timer);
    };
  }, [query, country]);

  return { results, searching, error, setResults, setError };
}

export { ADDRESS_SEARCH_MIN_CHARS };
