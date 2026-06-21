import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressSearchField from './AddressSearchField';
import { businessesAPI } from '../../utils/api';
import {
  DEFAULT_RADIUS_MILES,
  MILES_TO_METERS,
  RADIUS_MILE_OPTIONS,
  formatRadiusMiles,
} from '../../constants/locationSearch';
import useCurrentLocation from '../../hooks/useCurrentLocation';
import { canUseBrowserGeolocation } from '../../utils/geolocationSupport';
import { roundCoordinatePair } from '../../utils/coordinates';

const DEFAULT_CENTER = [43.6532, -79.3832];

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#7c3aed;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function milesToMeters(miles) {
  return Number(miles) * MILES_TO_METERS;
}

function fitMapToCircle(map, circle, { animate = true } = {}) {
  if (!map || !circle) return;
  map.fitBounds(circle.getBounds(), {
    padding: [36, 36],
    maxZoom: 14,
    animate,
  });
}

/**
 * Marketplace-style service area picker: search or tap map, draggable center, geodesic radius circle.
 */
export default function ServiceAreaRadiusMap({
  lat,
  lng,
  radiusMiles = DEFAULT_RADIUS_MILES,
  onLocationChange,
  onRadiusChange,
  disabled = false,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const radiusRef = useRef(radiusMiles);
  const centerLatRef = useRef(lat);
  const centerLngRef = useRef(lng);
  const onLocationChangeRef = useRef(onLocationChange);
  const disabledRef = useRef(disabled);
  const [error, setError] = useState(null);
  const gpsAvailable = canUseBrowserGeolocation();
  const { locating, error: locError, setError: setLocError, fetchCurrentLocation } =
    useCurrentLocation();

  useEffect(() => {
    radiusRef.current = radiusMiles;
  }, [radiusMiles]);

  useEffect(() => {
    centerLatRef.current = lat;
    centerLngRef.current = lng;
  }, [lat, lng]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (markerRef.current?.dragging) {
      if (disabled) markerRef.current.dragging.disable();
      else markerRef.current.dragging.enable();
    }
  }, [disabled]);

  const hasCenter = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  const reverseAndApply = useCallback(async (nextLat, nextLng) => {
    const { lat: roundedLat, lng: roundedLng } = roundCoordinatePair(nextLat, nextLng);
    setError(null);
    try {
      const res = await businessesAPI.reverseGeocode({ lat: roundedLat, lng: roundedLng });
      const data = res.data || {};
      onLocationChangeRef.current?.({
        lat: roundedLat,
        lng: roundedLng,
        address: data.display_name || '',
        city: data.city || '',
        state: data.state || data.province || '',
        postal_code: data.postal_code || '',
      });
    } catch {
      onLocationChangeRef.current?.({
        lat: roundedLat,
        lng: roundedLng,
        address: '',
        city: '',
        state: '',
        postal_code: '',
      });
      setError('Could not look up the address for that point.');
    }
  }, []);

  const ensureCircle = useCallback((nextLat, nextLng, nextRadius) => {
    const map = mapRef.current;
    if (!map || nextLat == null || nextLng == null) return;

    const radiusMeters = milesToMeters(nextRadius);
    if (!circleRef.current) {
      circleRef.current = L.circle([nextLat, nextLng], {
        radius: radiusMeters,
        color: '#7c3aed',
        fillColor: '#7c3aed',
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([nextLat, nextLng]);
      circleRef.current.setRadius(radiusMeters);
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([nextLat, nextLng], {
        icon: pinIcon,
        draggable: !disabledRef.current,
      }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        reverseAndApply(pos.lat, pos.lng);
      });
    } else {
      markerRef.current.setLatLng([nextLat, nextLng]);
    }
  }, [reverseAndApply]);

  const syncCircle = useCallback((nextLat, nextLng, nextRadius, { fitMap = false, animate = true } = {}) => {
    ensureCircle(nextLat, nextLng, nextRadius);
    if (fitMap && mapRef.current && circleRef.current) {
      fitMapToCircle(mapRef.current, circleRef.current, { animate });
    }
  }, [ensureCircle]);

  const applySearchResult = useCallback((payload) => {
    if (payload.lat == null || payload.lng == null) return;
    const { lat: nextLat, lng: nextLng } = roundCoordinatePair(payload.lat, payload.lng);
    syncCircle(nextLat, nextLng, radiusRef.current, { fitMap: true, animate: false });
    onLocationChangeRef.current?.({
      lat: nextLat,
      lng: nextLng,
      address: payload.address || payload.display_name || '',
      city: payload.city || '',
      state: payload.state || payload.province || '',
      postal_code: payload.postal_code || '',
    });
  }, [syncCircle]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;

    const map = L.map(mapEl.current, {
      center: DEFAULT_CENTER,
      zoom: 9,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.control.scale({ imperial: true, metric: true }).addTo(map);

    map.on('click', (event) => {
      if (disabledRef.current) return;
      const { lat: clickLat, lng: clickLng } = event.latlng;
      syncCircle(clickLat, clickLng, radiusRef.current, { fitMap: true, animate: false });
      reverseAndApply(clickLat, clickLng);
    });

    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
  }, [reverseAndApply, syncCircle]);

  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current || !hasCenter) {
      if (!hasCenter) initialFitDoneRef.current = false;
      return;
    }
    ensureCircle(lat, lng, radiusMiles);
    if (!initialFitDoneRef.current && circleRef.current) {
      initialFitDoneRef.current = true;
      fitMapToCircle(mapRef.current, circleRef.current, { animate: false });
    }
  }, [hasCenter, lat, lng, radiusMiles, ensureCircle]);

  const handleRadiusInput = (e) => {
    const next = Number(e.target.value);
    onRadiusChange?.(next);
    ensureCircle(centerLatRef.current, centerLngRef.current, next);
  };

  const handleUseCurrentLocation = async () => {
    setLocError(null);
    const result = await fetchCurrentLocation();
    if (!result) return;
    applySearchResult(result);
  };

  return (
    <div className="space-y-4">
      <div>
        <AddressSearchField
          id="service-area-search"
          label="Search city or address"
          placeholder="Search city, neighborhood, or address…"
          onSelect={applySearchResult}
        />
        {gpsAvailable && !disabled && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="mt-2 min-h-[44px] w-full rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-luminexa-accent disabled:opacity-50"
          >
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div ref={mapEl} className="h-[320px] w-full bg-slate-100" />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="service-radius" className="text-sm font-medium text-slate-700">
            Service radius
          </label>
          <span className="text-sm font-semibold text-luminexa-accent">
            {formatRadiusMiles(radiusMiles)}
          </span>
        </div>
        <input
          id="service-radius"
          type="range"
          min={RADIUS_MILE_OPTIONS[0].value}
          max={RADIUS_MILE_OPTIONS[RADIUS_MILE_OPTIONS.length - 1].value}
          step={1}
          value={radiusMiles}
          disabled={disabled || !hasCenter}
          onInput={handleRadiusInput}
          onChange={handleRadiusInput}
          className="w-full accent-luminexa-accent"
        />
        {!hasCenter && (
          <p className="mt-1 text-xs text-amber-700">Pick a location on the map first, then adjust the radius.</p>
        )}
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          {RADIUS_MILE_OPTIONS.map((opt) => (
            <span key={opt.value}>{opt.value} mi</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Circle edge is the real distance from your pin (check the map scale). Drag the slider to
          grow or shrink it — zoom the map yourself to compare with roads and towns.
        </p>
      </div>

      {(error || locError) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error || locError}</p>
      )}
    </div>
  );
}
