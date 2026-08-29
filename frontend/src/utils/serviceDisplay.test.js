import { serviceThumbnailUrl } from './serviceDisplay';

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
