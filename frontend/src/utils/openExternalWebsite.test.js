import { normalizeExternalWebsiteUrl } from './openExternalWebsite';

describe('normalizeExternalWebsiteUrl', () => {
  test('returns null for empty input', () => {
    expect(normalizeExternalWebsiteUrl('')).toBeNull();
    expect(normalizeExternalWebsiteUrl('   ')).toBeNull();
  });

  test('adds https when scheme omitted', () => {
    expect(normalizeExternalWebsiteUrl('example.com')).toBe('https://example.com/');
    expect(normalizeExternalWebsiteUrl('www.myshop.ca/about')).toBe('https://www.myshop.ca/about');
  });

  test('keeps explicit https', () => {
    expect(normalizeExternalWebsiteUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  test('rejects javascript URLs', () => {
    expect(normalizeExternalWebsiteUrl('javascript:alert(1)')).toBeNull();
  });
});
