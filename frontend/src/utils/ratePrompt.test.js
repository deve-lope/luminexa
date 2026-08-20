import {
  isPaidCompletedBooking,
  localDateKey,
  markRatePromptRated,
  markRatePromptShown,
  pickRatePromptBooking,
  shouldPromptRate,
} from './ratePrompt';

describe('rate prompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const paid = {
    id: 9,
    status: 'completed',
    can_rate: true,
    invoice: { status: 'paid' },
  };

  test('asks after pay when never shown', () => {
    expect(shouldPromptRate(paid)).toBe(true);
    expect(isPaidCompletedBooking({ ...paid, invoice: { status: 'issued' } })).toBe(false);
  });

  test('does not ask again the same day after dismiss', () => {
    const now = new Date('2026-08-19T18:00:00');
    markRatePromptShown(9, now);
    expect(shouldPromptRate(paid, now)).toBe(false);
  });

  test('asks once more on a later day, then stops', () => {
    markRatePromptShown(9, new Date('2026-08-19T18:00:00'));
    const nextOpen = new Date('2026-08-20T09:00:00');
    expect(shouldPromptRate(paid, nextOpen)).toBe(true);
    markRatePromptShown(9, nextOpen);
    expect(shouldPromptRate(paid, nextOpen)).toBe(false);
    expect(shouldPromptRate(paid, new Date('2026-08-21T09:00:00'))).toBe(false);
  });

  test('stops after they rate', () => {
    markRatePromptRated(9);
    expect(shouldPromptRate(paid)).toBe(false);
    expect(pickRatePromptBooking([paid])).toBeNull();
  });

  test('localDateKey is YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 7, 9))).toBe('2026-08-09');
  });
});
