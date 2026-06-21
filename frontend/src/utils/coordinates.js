/** Max precision for lat/lng stored in the API (DecimalField decimal_places=6). */
export function roundCoordinate(value) {
  if (value == null || Number.isNaN(Number(value))) return value;
  return Math.round(Number(value) * 1e6) / 1e6;
}

export function roundCoordinatePair(lat, lng) {
  return {
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng),
  };
}
