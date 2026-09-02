import { overlayUnmountShouldPopHistory } from './useOverlayHistoryBack';

describe('overlayUnmountShouldPopHistory', () => {
  test('pops the trap when the menu closes on the same page', () => {
    expect(overlayUnmountShouldPopHistory('/customer', '/customer')).toBe(true);
  });

  test('does not pop after a menu link already navigated (phone About Luminexa)', () => {
    expect(overlayUnmountShouldPopHistory('/customer', '/customer/about')).toBe(false);
  });
});
