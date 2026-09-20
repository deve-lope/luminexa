import {
  APP_TOUR_ELIGIBLE_KEY,
  APP_TOUR_VERSION,
  buildAppTourSteps,
  hasCompletedAppTour,
  markAppTourComplete,
  markAppTourEligible,
  resetAppTour,
  shouldAutoStartAppTour,
} from './appTour';

describe('appTour', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test('marks and reads completion per role/user', () => {
    expect(hasCompletedAppTour('customer', 7)).toBe(false);
    markAppTourComplete('customer', 7);
    expect(hasCompletedAppTour('customer', 7)).toBe(true);
    expect(hasCompletedAppTour('provider', 7)).toBe(false);
    expect(hasCompletedAppTour('customer', 8)).toBe(false);
  });

  test('reset clears completion', () => {
    markAppTourComplete('provider', 3);
    resetAppTour('provider', 3);
    expect(hasCompletedAppTour('provider', 3)).toBe(false);
  });

  test('auto-start for eligible session or recent onboarding', () => {
    const user = { id: 1, onboarding_completed_at: new Date().toISOString() };
    expect(shouldAutoStartAppTour('customer', user)).toBe(true);

    const oldUser = {
      id: 2,
      onboarding_completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(shouldAutoStartAppTour('customer', oldUser)).toBe(false);

    markAppTourEligible();
    expect(window.sessionStorage.getItem(APP_TOUR_ELIGIBLE_KEY)).toBe('1');
    expect(shouldAutoStartAppTour('customer', oldUser)).toBe(true);

    markAppTourComplete('customer', 2);
    expect(shouldAutoStartAppTour('customer', oldUser)).toBe(false);
  });

  test('customer steps omit gigs when includeGigs is false', () => {
    const withGigs = buildAppTourSteps('customer', { includeGigs: true });
    const without = buildAppTourSteps('customer', { includeGigs: false });
    expect(withGigs.some((s) => s.id === 'gigs')).toBe(true);
    expect(without.some((s) => s.id === 'gigs')).toBe(false);
    expect(without[0].id).toBe('welcome');
    expect(APP_TOUR_VERSION).toBeGreaterThan(0);
  });

  test('provider steps use org paths', () => {
    const steps = buildAppTourSteps('provider', { orgSlug: 'acme', includeGigs: false });
    expect(steps.find((s) => s.id === 'schedule')?.path).toBe('/provider/acme/schedule');
    expect(steps.some((s) => s.id === 'gigs')).toBe(false);
  });
});
