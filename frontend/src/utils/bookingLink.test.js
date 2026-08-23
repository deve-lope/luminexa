import { getCustomerBookingUrl, getPublicAppUrl } from './bookingLink';

function setLocationOrigin(origin) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin, protocol: new URL(origin).protocol },
  });
}

describe('getPublicAppUrl', () => {
  const originalEnv = process.env.REACT_APP_PUBLIC_URL;

  afterEach(() => {
    process.env.REACT_APP_PUBLIC_URL = originalEnv;
  });

  test('uses the live origin even when Docker baked localhost into REACT_APP_PUBLIC_URL', () => {
    process.env.REACT_APP_PUBLIC_URL = 'http://localhost:3000';
    setLocationOrigin('https://app.luminex-a.com');
    expect(getPublicAppUrl()).toBe('https://app.luminex-a.com');
    expect(getCustomerBookingUrl('anu-garden')).toBe(
      'https://app.luminex-a.com/book/anu-garden'
    );
  });

  test('keeps localhost when the page itself is local', () => {
    process.env.REACT_APP_PUBLIC_URL = 'http://localhost:3000';
    setLocationOrigin('http://localhost:3001');
    expect(getPublicAppUrl()).toBe('http://localhost:3001');
  });

  test('uses a non-local env URL when the page origin is not http(s)', () => {
    process.env.REACT_APP_PUBLIC_URL = 'https://app.luminex-a.com';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'capacitor://localhost', protocol: 'capacitor:' },
    });
    expect(getPublicAppUrl()).toBe('https://app.luminex-a.com');
  });
});
