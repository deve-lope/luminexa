import {
  resolveCustomerBack,
  resolveOwnerBookBack,
  resolveProviderBack,
  resolvePublicBack,
  withReturnTo,
} from './navigationBack';
import {
  consumePreviousInAppPath,
  isUsefulBackPath,
  recordInAppLocation,
} from './inAppNavStack';

describe('resolveOwnerBookBack', () => {
  test('service preview returns to the provider services catalog', () => {
    expect(resolveOwnerBookBack('/book/anu-garden/services/42', 'anu-garden')).toEqual({
      to: '/provider/anu-garden/services',
    });
  });

  test('public catalog preview returns to provider services', () => {
    expect(resolveOwnerBookBack('/book/anu-garden/services', 'anu-garden')).toEqual({
      to: '/provider/anu-garden/services',
    });
  });

  test('honors returnTo', () => {
    expect(
      resolveOwnerBookBack(
        '/book/anu-garden/services/42',
        'anu-garden',
        '?returnTo=%2Fprovider%2Fanu-garden%2Fservices'
      )
    ).toEqual({ to: '/provider/anu-garden/services' });
  });
});

describe('resolvePublicBack', () => {
  test('service detail returns to the public catalog, not home', () => {
    expect(resolvePublicBack('/book/anu-garden/services/42')).toEqual({
      to: '/book/anu-garden/services',
    });
  });

  test('catalog returns to storefront', () => {
    expect(resolvePublicBack('/book/anu-garden/services')).toEqual({
      to: '/book/anu-garden',
    });
  });
});

describe('resolveProviderBack', () => {
  test('client detail returns to clients list, not home', () => {
    expect(resolveProviderBack('/provider/anu-garden/clients/9', 'anu-garden')).toEqual({
      to: '/provider/anu-garden/clients',
    });
  });
});

describe('resolveCustomerBack', () => {
  test('honors returnTo on nested pages', () => {
    expect(
      resolveCustomerBack('/customer/find', '?returnTo=%2Fcustomer%2Fbookings')
    ).toEqual({ to: '/customer/bookings' });
  });
});

describe('withReturnTo', () => {
  test('appends returnTo query', () => {
    expect(withReturnTo('/book/x/services/1', '/provider/x/services')).toBe(
      '/book/x/services/1?returnTo=%2Fprovider%2Fx%2Fservices'
    );
  });
});

describe('inAppNavStack', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('back from preview returns to services, not home', () => {
    recordInAppLocation('/provider/anu-garden', 'PUSH');
    recordInAppLocation('/provider/anu-garden/services', 'PUSH');
    recordInAppLocation('/book/anu-garden/services/42', 'PUSH');
    expect(consumePreviousInAppPath('/book/anu-garden/services/42')).toBe(
      '/provider/anu-garden/services'
    );
  });

  test('skips marketing home as a back target', () => {
    expect(isUsefulBackPath('/', '/book/x/services/1')).toBe(false);
    recordInAppLocation('/', 'PUSH');
    recordInAppLocation('/book/anu-garden/services/42', 'PUSH');
    expect(consumePreviousInAppPath('/book/anu-garden/services/42')).toBeNull();
  });
});
