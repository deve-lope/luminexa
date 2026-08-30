import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ADDRESS_SEARCH_MIN_CHARS,
  addressSearchDebounceMs,
  addressSearchTerm,
  guessCountryFromAddressQuery,
  shouldSearchAddressQuery,
} from '../../constants/addressSearch';
import { businessesAPI } from '../../utils/api';
import {
  LOCATION_ERROR,
  canUseBrowserGeolocation,
  classifyLocationError,
  requestGeolocationCoordinates,
  shareLocationButtonLabel,
} from '../../utils/geolocationSupport';
import LocationEnablePrompt from './LocationEnablePrompt';
import useAddressCountry from '../../hooks/useAddressCountry';
import { useAuth } from '../../contexts/AuthContext';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';

const DEFAULT_CENTER = [43.6532, -79.3832]; // Toronto

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#7c3aed;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function formatCoords(lat, lng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function buildPayload(lat, lng, address) {
  if (typeof address === 'string') {
    return { lat, lng, address, city: '', state: '', postal_code: '', country: '' };
  }
  return {
    lat,
    lng,
    address: address?.display_name || formatCoords(lat, lng),
    city: address?.city || '',
    state: address?.state || address?.province || '',
    postal_code: address?.postal_code || '',
    country: address?.country || '',
  };
}

export default function MapLocationPicker({ open, onClose, onSelect, country: countryProp }) {
  const { user } = useAuth();
  const { country: detectedCountry } = useAddressCountry({
    initialCountry: countryProp || user?.address_country,
  });
  const country = countryProp || detectedCountry;
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const resolvingRef = useRef(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [gpsErrorKind, setGpsErrorKind] = useState(null);
  const [pendingLabel, setPendingLabel] = useState('');

  useModalBodyLock(open);

  const placeMarker = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, []);

  const confirmLocation = useCallback(async (lat, lng, { zoom = 16, address } = {}) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setResolving(true);
    setError(null);

    const map = mapRef.current;
    if (map) {
      map.setView([lat, lng], zoom);
      placeMarker(lat, lng);
    }

    try {
      let payload;
      if (address) {
        payload = buildPayload(lat, lng, address);
      } else {
        const res = await businessesAPI.reverseGeocode({ lat, lng });
        const data = res.data || {};
        payload = {
          lat,
          lng,
          address: data.display_name || formatCoords(lat, lng),
          city: data.city || '',
          state: data.state || data.province || '',
          postal_code: data.postal_code || '',
          country: data.country || '',
        };
      }
      setPendingLabel(payload.address);
      onSelect(payload);
      onClose();
    } catch {
      const payload = buildPayload(lat, lng, formatCoords(lat, lng));
      setPendingLabel(payload.address);
      onSelect(payload);
      onClose();
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  }, [onClose, onSelect, placeMarker]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setPendingLabel('');
      setResolving(false);
      setLocating(false);
      resolvingRef.current = false;
      return undefined;
    }

    if (!mapEl.current || mapRef.current) return undefined;

    const map = L.map(mapEl.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (event) => {
      const { lat, lng } = event.latlng;
      confirmLocation(lat, lng, { zoom: map.getZoom() });
    });

    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open, confirmLocation]);

  useEffect(() => {
    if (!open || !mapRef.current) return;
    window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [open]);

  const gpsAvailable = canUseBrowserGeolocation();

  const useCurrentLocation = () => {
    if (!gpsAvailable || !mapRef.current) {
      setGpsErrorKind(LOCATION_ERROR.UNSUPPORTED);
      setError(
        'Current location needs HTTPS or localhost. Search an address above or tap the map.'
      );
      return;
    }
    setLocating(true);
    setError(null);
    setGpsErrorKind(null);
    requestGeolocationCoordinates()
      .then((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        return confirmLocation(lat, lng, { zoom: 17 });
      })
      .catch((err) => {
        const kind = classifyLocationError(err);
        setGpsErrorKind(kind);
        if (kind === LOCATION_ERROR.TIMEOUT) {
          setError('Could not get your current location in time. Try again or search the address.');
        } else {
          setError(
            err?.message || 'Could not access your current location. Try searching the address.'
          );
        }
      })
      .finally(() => setLocating(false));
  };

  const runSearch = useCallback(async (query, { selectFirst = false, signal } = {}) => {
    const q = (query || '').trim();
    if (q.length < ADDRESS_SEARCH_MIN_CHARS) {
      setError(`Type at least ${ADDRESS_SEARCH_MIN_CHARS} characters to search.`);
      return [];
    }
    setSearching(true);
    setError(null);
    try {
      const res = await businessesAPI.searchMapLocations(
        q,
        guessCountryFromAddressQuery(q) || country,
        { signal }
      );
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      setSearchResults(results);
      if (selectFirst && results.length > 0) {
        const first = results[0];
        await confirmLocation(first.latitude, first.longitude, {
          zoom: 16,
          address: {
            display_name: first.display_name,
            city: first.city || '',
            state: first.state || first.province || '',
            postal_code: first.postal_code || '',
            country: first.country || '',
          },
        });
      } else if (!results.length) {
        setError(
          country
            ? `No locations found in ${country}. Try a more specific address or city.`
            : 'No locations found. Try a more specific address or city.'
        );
      }
      return results;
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return [];
      setError('Could not search locations right now.');
      return [];
    } finally {
      setSearching(false);
    }
  }, [confirmLocation, country]);

  useEffect(() => {
    if (!open || !shouldSearchAddressQuery(searchQuery)) {
      setSearchResults([]);
      return undefined;
    }
    const q = addressSearchTerm(searchQuery);
    setSearching(true);
    const controller = new AbortController();
    const delay = addressSearchDebounceMs(searchQuery);
    const run = () => {
      runSearch(q, { selectFirst: false, signal: controller.signal }).finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    };
    const timer = delay === 0 ? null : window.setTimeout(run, delay);
    if (delay === 0) run();
    return () => {
      controller.abort();
      if (timer != null) window.clearTimeout(timer);
    };
  }, [open, runSearch, searchQuery]);

  const searchLocations = async (e) => {
    e.preventDefault();
    await runSearch(searchQuery, { selectFirst: true });
  };

  const pickSearchResult = (item) => {
    confirmLocation(item.latitude, item.longitude, {
      zoom: 16,
      address: {
        display_name: item.display_name,
        city: item.city || '',
        state: item.state || item.province || '',
        postal_code: item.postal_code || '',
        country: item.country || '',
      },
    });
  };

  const preventBlurForPick = (e) => {
    e.preventDefault();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="lx-modal-overlay fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">Pick service location</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tap a search result or click the map
              {gpsAvailable ? ' — your location is saved right away' : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={resolving || locating}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={searchLocations} className="border-b border-slate-100 p-4">
          <label htmlFor="map-location-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search location
          </label>
          <div className="flex gap-2">
            <input
              id="map-location-search"
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, landmark, city..."
              className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            <button
              type="submit"
              disabled={searching || resolving}
              className="min-h-[44px] rounded-lg bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {searchResults.map((item) => (
                <li key={`${item.latitude}-${item.longitude}-${item.display_name}`}>
                  <button
                    type="button"
                    onPointerDown={preventBlurForPick}
                    onTouchStart={preventBlurForPick}
                    onMouseDown={preventBlurForPick}
                    onClick={() => pickSearchResult(item)}
                    disabled={resolving}
                    className="block w-full border-b border-slate-100 px-3 py-3 text-left text-sm text-slate-700 last:border-b-0 active:bg-violet-50 disabled:opacity-50"
                  >
                    {item.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="relative">
          <div ref={mapEl} className="h-[360px] w-full bg-slate-100" />
          {(resolving || locating) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-700">
              {locating ? 'Getting your location…' : 'Saving location…'}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 p-4">
          {gpsAvailable ? (
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating || resolving}
              className="min-h-[44px] w-full rounded-lg border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-luminexa-accent disabled:opacity-50"
            >
              {shareLocationButtonLabel({ locating })}
            </button>
          ) : null}

          {pendingLabel && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{pendingLabel}</p>
          )}
          {error && (
            <LocationEnablePrompt
              error={error}
              errorKind={gpsErrorKind}
              locating={locating}
              onRetry={useCurrentLocation}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
