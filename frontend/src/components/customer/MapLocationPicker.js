import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { businessesAPI } from '../../utils/api';

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

export default function MapLocationPicker({ open, onClose, onSelect }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);

  const placeMarker = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, []);

  const selectCoordinates = useCallback(async (lat, lng, { zoom = 16, address } = {}) => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([lat, lng], zoom);
    placeMarker(lat, lng);
    setResolving(true);
    setError(null);
    if (address) {
      setSelected({
        lat,
        lng,
        address: typeof address === 'string' ? address : address.display_name || formatCoords(lat, lng),
        city: address.city || '',
        state: address.state || address.province || '',
        postal_code: address.postal_code || '',
      });
      setResolving(false);
      return;
    }
    try {
      const res = await businessesAPI.reverseGeocode({ lat, lng });
      const data = res.data || {};
      const displayName = data.display_name || formatCoords(lat, lng);
      setSelected({
        lat,
        lng,
        address: displayName,
        city: data.city || '',
        state: data.state || data.province || '',
        postal_code: data.postal_code || '',
        country: data.country || '',
      });
    } catch {
      setSelected({ lat, lng, address: formatCoords(lat, lng), city: '', state: '', postal_code: '' });
      setError('Could not find an address for that point. Coordinates will be used.');
    } finally {
      setResolving(false);
    }
  }, [placeMarker]);

  useEffect(() => {
    if (!open || !mapEl.current || mapRef.current) return undefined;

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
      selectCoordinates(lat, lng, { zoom: map.getZoom() });
    });

    mapRef.current = map;

    window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open, selectCoordinates]);

  useEffect(() => {
    if (!open || !mapRef.current) return;
    window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [open]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation || !mapRef.current) {
      setError('Browser location is not available.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        selectCoordinates(lat, lng, { zoom: 17 }).finally(() => setLocating(false));
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission was blocked. Allow location access in your browser, or search the address above.');
        } else if (err.code === err.TIMEOUT) {
          setError('Could not get your current location in time. Try again or search the address.');
        } else {
          setError('Could not access your current location. Try searching the address.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const runSearch = useCallback(async (query, { selectFirst = false } = {}) => {
    const q = (query || '').trim();
    if (q.length < 3) {
      setError('Type at least 3 characters to search.');
      return [];
    }
    setSearching(true);
    setError(null);
    try {
      const res = await businessesAPI.searchMapLocations(q);
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      setSearchResults(results);
      if (selectFirst && results.length > 0) {
        const first = results[0];
        await selectCoordinates(first.latitude, first.longitude, {
          zoom: 16,
          address: {
            display_name: first.display_name,
            city: first.city || '',
            state: first.state || first.province || '',
            postal_code: first.postal_code || '',
          },
        });
      } else if (!results.length) {
        setError('No locations found. Try a more specific address or city.');
      }
      return results;
    } catch {
      setError('Could not search locations right now.');
      return [];
    } finally {
      setSearching(false);
    }
  }, [selectCoordinates]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      runSearch(q, { selectFirst: false });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchQuery]);

  const searchLocations = async (e) => {
    e.preventDefault();
    await runSearch(searchQuery, { selectFirst: true });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">Pick service location</h2>
            <p className="mt-1 text-sm text-slate-600">
              Search an address, use your current location, or click the map.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, landmark, city..."
              className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            <button
              type="submit"
              disabled={searching}
              className="min-h-[44px] rounded-lg bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {searchResults.map((item) => (
                <li key={`${item.latitude}-${item.longitude}-${item.display_name}`}>
                  <button
                    type="button"
                    onClick={() =>
                      selectCoordinates(item.latitude, item.longitude, {
                        zoom: 16,
                        address: {
                          display_name: item.display_name,
                          city: item.city || '',
                          state: item.state || item.province || '',
                          postal_code: item.postal_code || '',
                        },
                      })
                    }
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                  >
                    {item.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div ref={mapEl} className="h-[360px] w-full bg-slate-100" />

        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating || resolving}
              className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {locating ? 'Getting your location…' : 'Use my current location'}
            </button>
            <button
              type="button"
              disabled={!selected || resolving}
              onClick={() => selected && onSelect(selected)}
              className="min-h-[44px] flex-1 rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {resolving ? 'Finding address…' : 'Use selected location'}
            </button>
          </div>

          {selected && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {selected.address}
            </p>
          )}
          {error && <p className="text-sm text-amber-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
