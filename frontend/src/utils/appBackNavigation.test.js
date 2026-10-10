import {
  closeTopOverlay,
  performAppBack,
  registerOverlayCloser,
  registeredOverlayCloserCount,
  withServiceHashIfNeeded,
} from './appBackNavigation';

describe('performAppBack', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('closes an open overlay before navigating', () => {
    const navigate = jest.fn();
    const close = jest.fn();
    const unregister = registerOverlayCloser(close);

    const handled = performAppBack({
      pathname: '/customer/provider/acme/42',
      search: '',
      navigate,
    });

    expect(handled).toBe(true);
    expect(close).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    unregister();
  });

  test('prefers returnTo schedule day over bare schedule fallback', () => {
    const navigate = jest.fn();
    const handled = performAppBack({
      pathname: '/provider/acme/schedule/booking/9',
      search: '?returnTo=%2Fprovider%2Facme%2Fschedule%3Fday%3D2026-11-11',
      navigate,
      preferFallback: true,
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      '/provider/acme/schedule?day=2026-11-11',
      { replace: true },
    );
  });

  test('enriches bare schedule back target with remembered day', () => {
    sessionStorage.setItem('luminexa.scheduleSelectedDay.acme', '2026-11-11');
    const navigate = jest.fn();
    const handled = performAppBack({
      pathname: '/provider/acme/schedule/booking/9',
      search: '',
      navigate,
      preferFallback: true,
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      '/provider/acme/schedule?day=2026-11-11',
      { replace: true },
    );
  });
});

describe('withServiceHashIfNeeded', () => {
  test('pins #service-id when returning from detail to the same storefront', () => {
    expect(withServiceHashIfNeeded('/book/acme', '/book/acme/services/42')).toBe(
      '/book/acme#service-42',
    );
  });

  test('keeps customer provider storefront hash', () => {
    expect(
      withServiceHashIfNeeded(
        '/customer/provider/acme',
        '/customer/provider/acme/services/99',
      ),
    ).toBe('/customer/provider/acme#service-99');
  });

  test('does not rewrite unrelated previous paths', () => {
    expect(withServiceHashIfNeeded('/customer/find', '/book/acme/services/42')).toBe(
      '/customer/find',
    );
  });

  test('leaves an existing hash alone', () => {
    expect(
      withServiceHashIfNeeded('/book/acme#service-1', '/book/acme/services/42'),
    ).toBe('/book/acme#service-1');
  });
});

describe('closeTopOverlay', () => {
  test('returns false when nothing is open', () => {
    expect(closeTopOverlay()).toBe(false);
  });
});

describe('registeredOverlayCloserCount', () => {
  test('counts live overlays so menu cleanup can yield to Log out?', () => {
    expect(registeredOverlayCloserCount()).toBe(0);
    const unregister = registerOverlayCloser(() => {});
    expect(registeredOverlayCloserCount()).toBe(1);
    unregister();
    expect(registeredOverlayCloserCount()).toBe(0);
  });
});
