import {
  closeTopOverlay,
  performAppBack,
  registerOverlayCloser,
} from './appBackNavigation';

describe('performAppBack', () => {
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
});

describe('closeTopOverlay', () => {
  test('returns false when nothing is open', () => {
    expect(closeTopOverlay()).toBe(false);
  });
});
