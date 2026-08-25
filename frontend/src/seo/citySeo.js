import data from './cities.json';

export function fillCityCopy(str, city) {
  return String(str).replaceAll('{city}', city);
}

export function cityBySlug(slug) {
  return data.cities.find((c) => c.slug === slug) || null;
}

export function resolvedCategories(cityName) {
  return data.categories.map((c) => ({
    ...c,
    title: fillCityCopy(c.title, cityName),
    description: fillCityCopy(c.description, cityName),
    h1: fillCityCopy(c.h1, cityName),
    blurb: fillCityCopy(c.blurb, cityName),
    extra: c.extra ? fillCityCopy(c.extra, cityName) : '',
  }));
}

export const citySeo = data;
