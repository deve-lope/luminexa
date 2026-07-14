/** Default radius when searching by PIN / postal code. */
export const DEFAULT_RADIUS_MILES = 25;

export const MILES_TO_KM = 1.609344;
export const MILES_TO_METERS = 1609.344;

export const RADIUS_MILE_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
];

export function milesToKm(miles) {
  return Math.round(Number(miles) * MILES_TO_KM * 10) / 10;
}

export function formatRadiusMiles(miles) {
  const rounded = Math.round(Number(miles) * 10) / 10;
  const mi = Number.isInteger(rounded) ? rounded : rounded;
  const km = milesToKm(mi);
  return `${mi} mi (${km} km)`;
}
