import data from './cities.json';

export function fillCityCopy(str, city, neighbourhood = '') {
  return String(str)
    .replaceAll('{city}', city)
    .replaceAll('{neighbourhood}', neighbourhood);
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

export function neighbourhoodBySlug(city, slug) {
  if (!city?.neighbourhoods) return null;
  return city.neighbourhoods.find((n) => n.slug === slug) || null;
}

export function nearMeCategories() {
  const slugs = data.nearMeCategorySlugs || [];
  return data.categories.filter((c) => slugs.includes(c.slug));
}

export function alternativeBySlug(slug) {
  return data.alternatives?.pages?.find((p) => p.slug === slug) || null;
}

export function neighbourhoodNames(city) {
  return (city?.neighbourhoods || []).map((n) => n.name);
}

export const citySeo = data;
