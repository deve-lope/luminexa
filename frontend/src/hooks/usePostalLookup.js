import { useCallback, useEffect, useMemo, useState } from 'react';
import { businessesAPI } from '../utils/api';

function normalizePostal(value) {
  return (value || '').replace(/[\s-]+/g, '').toUpperCase();
}

function isReadyForLookup(postal) {
  if (/^[A-Z]\d[A-Z]$/.test(postal)) return true; // Canadian FSA
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) return true; // Canada
  if (/^\d{5}$/.test(postal)) return true; // US ZIP
  if (/^\d{6}$/.test(postal)) return true; // India PIN
  return postal.length >= 5;
}

export default function usePostalLookup(postalCode, { onResolved } = {}) {
  const normalized = useMemo(() => normalizePostal(postalCode), [postalCode]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const canLookup = isReadyForLookup(normalized);

  const lookupNow = useCallback(() => {
    if (!canLookup) {
      setStatus('idle');
      setMessage('');
      return Promise.resolve(null);
    }

    setStatus('loading');
    setMessage('Looking up city and province…');
    return businessesAPI
      .lookupPostalCode(normalized)
      .then((res) => {
        const city = res.data?.city || '';
        const state = res.data?.province || res.data?.state || '';
        if (city || state) {
          onResolved?.({ city, state, country: res.data?.country || '' });
          setStatus('success');
          setMessage(
            [city, state].filter(Boolean).length
              ? `Found ${[city, state].filter(Boolean).join(', ')}.`
              : 'Location found.'
          );
        } else {
          setStatus('not_found');
          setMessage('Could not auto-fill city/province for this code.');
        }
        return res.data;
      })
      .catch(() => {
        setStatus('not_found');
        setMessage('Could not auto-fill city/province for this code.');
        return null;
      });
  }, [canLookup, normalized, onResolved]);

  useEffect(() => {
    if (!normalized) {
      setStatus('idle');
      setMessage('');
      return undefined;
    }
    if (!canLookup) {
      setStatus('idle');
      setMessage('');
      return undefined;
    }

    const timer = window.setTimeout(() => {
      lookupNow().then(() => {});
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canLookup, lookupNow, normalized]);

  return { status, message, normalized, canLookup, lookupNow };
}
