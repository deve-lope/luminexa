import {
  formatServiceCatalogLabel,
  formatServicePrice,
  serviceThumbnailUrl,
} from './serviceDisplay';

describe('serviceThumbnailUrl', () => {
  test('uses the cover photo when it is set', () => {
    expect(
      serviceThumbnailUrl({
        image_url: '/media/services/public/cover.png',
        gallery: [{ image_url: '/media/services/gallery/other.png' }],
      })
    ).toBe('/media/services/public/cover.png');
  });

  test('falls back to the first gallery photo when there is no cover', () => {
    expect(
      serviceThumbnailUrl({
        image_url: null,
        gallery: [{ image_url: '/media/services/gallery/two-color.png' }],
      })
    ).toBe('/media/services/gallery/two-color.png');
  });

  test('returns empty when the service has no photos', () => {
    expect(serviceThumbnailUrl({ name: 'Garden cleanup' })).toBe('');
  });
});

describe('formatServicePrice', () => {
  test('does not show $0 for unset fixed prices', () => {
    expect(formatServicePrice({ pricing_type: 'fixed', base_price: '0', show_price: true })).toBeNull();
    expect(formatServicePrice({ pricing_type: 'fixed', base_price: '49', show_price: true })).toMatch(/49/);
  });
});

describe('formatServiceCatalogLabel', () => {
  test('shows fixed price only when set', () => {
    expect(
      formatServiceCatalogLabel({ pricing_type: 'fixed', base_price: '75', show_price: true })
    ).toMatch(/75/);
    expect(
      formatServiceCatalogLabel({ pricing_type: 'fixed', base_price: '0', show_price: true })
    ).toBeNull();
  });

  test('shows quote hint for quote-first services', () => {
    expect(formatServiceCatalogLabel({ pricing_type: 'quote', base_price: '0' })).toBe(
      'Quote on request'
    );
  });
});
