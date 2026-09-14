import {
  formatSubscriptionPeriodEnd,
  formatSubscriptionRemainingLabel,
  subscriptionDaysRemaining,
} from './providerSubscription';

describe('subscriptionDaysRemaining', () => {
  test('returns null for missing/invalid', () => {
    expect(subscriptionDaysRemaining(null)).toBeNull();
    expect(subscriptionDaysRemaining('not-a-date')).toBeNull();
  });
});

describe('formatSubscriptionRemainingLabel', () => {
  test('uses days for short windows', () => {
    const in3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatSubscriptionRemainingLabel(in3)).toBe('3 days left');
  });

  test('uses months for long promos', () => {
    const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatSubscriptionRemainingLabel(in90)).toBe('About 3 months left');
  });

  test('ends today when period end is now', () => {
    expect(formatSubscriptionRemainingLabel(new Date().toISOString())).toBe('Ends today');
  });
});

describe('formatSubscriptionPeriodEnd', () => {
  test('formats a stable date', () => {
    const label = formatSubscriptionPeriodEnd('2026-06-15T12:00:00.000Z');
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/15|Jun|June|6/);
  });
});
