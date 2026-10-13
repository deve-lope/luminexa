import {
  overlayCleanupShouldPopTrap,
  overlayShouldPushHistoryTrap,
  overlayUnmountShouldPopHistory,
} from './useOverlayHistoryBack';

describe('overlayUnmountShouldPopHistory', () => {
  test('pops the trap when the menu closes on the same page', () => {
    expect(overlayUnmountShouldPopHistory('/customer', '/customer')).toBe(true);
  });

  test('does not pop after a menu link already navigated (phone About Luminexa)', () => {
    expect(overlayUnmountShouldPopHistory('/customer', '/customer/about')).toBe(false);
  });
});

describe('overlayCleanupShouldPopTrap', () => {
  test('keeps the trap when Log out? opens as the menu closes', () => {
    expect(
      overlayCleanupShouldPopTrap({
        successorOverlayCount: 1,
        anchorUrl: '/customer',
        currentUrl: '/customer',
      }),
    ).toBe(false);
  });

  test('pops the trap when the menu closes with nothing stacked on it', () => {
    expect(
      overlayCleanupShouldPopTrap({
        successorOverlayCount: 0,
        anchorUrl: '/customer',
        currentUrl: '/customer',
      }),
    ).toBe(true);
  });

  test('does not pop after logout already replaced the page', () => {
    expect(
      overlayCleanupShouldPopTrap({
        successorOverlayCount: 0,
        anchorUrl: '/customer',
        currentUrl: '/',
      }),
    ).toBe(false);
  });
});

describe('overlayShouldPushHistoryTrap', () => {
  test('reuses an existing overlay trap instead of stacking another', () => {
    expect(overlayShouldPushHistoryTrap({ lxOverlay: true })).toBe(false);
  });

  test('pushes a trap when the current history entry is a real page', () => {
    expect(overlayShouldPushHistoryTrap(null)).toBe(true);
    expect(overlayShouldPushHistoryTrap({})).toBe(true);
  });
});
