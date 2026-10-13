import {
  APP_TOUR_AUTO_START_DELAY_MS,
  APP_TOUR_ELIGIBLE_KEY,
  APP_TOUR_VERSION,
  GUIDED_TOUR_START_EVENT,
  buildAppTourSteps,
  hasCompletedAppTour,
  markAppTourComplete,
  markAppTourEligible,
  resetAppTour,
  shouldAutoStartAppTour,
  startGuidedTour,
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
    expect(APP_TOUR_AUTO_START_DELAY_MS).toBe(10_000);
  });

  test('customer book/search steps target the controls to tap', () => {
    const steps = buildAppTourSteps('customer', { includeGigs: false });
    const book = steps.find((s) => s.id === 'book');
    const search = steps.find((s) => s.id === 'search');
    expect(book?.target).toBe('tab-book');
    expect(book?.path).toBe('/customer');
    expect(search?.target).toBe('find-search');
    expect(search?.path).toBe('/customer/find');
  });

  test('provider steps keep tab tips on home so targets stay visible', () => {
    const steps = buildAppTourSteps('provider', { orgSlug: 'acme', includeGigs: false });
    expect(steps.find((s) => s.id === 'schedule')?.path).toBe('/provider/acme');
    expect(steps.find((s) => s.id === 'schedule')?.target).toBe('tab-schedule');
    expect(steps.some((s) => s.id === 'gigs')).toBe(false);
  });

  test('provider last step points to Training', () => {
    const steps = buildAppTourSteps('provider', { orgSlug: 'acme', includeGigs: false });
    const last = steps[steps.length - 1];
    expect(last.id).toBe('training');
    expect(last.body.toLowerCase()).toContain('training');
    expect(last.target).toBe('menu');
    expect(last.cta).toEqual({
      label: 'Open Training',
      path: '/provider/acme/training',
    });
  });

  test('startGuidedTour dispatches without clearing first-run completion', () => {
    markAppTourComplete('provider', 9);
    const steps = [{ id: 'x', title: 'X', body: 'Y', path: '/provider/acme' }];
    const handler = jest.fn();
    window.addEventListener(GUIDED_TOUR_START_EVENT, handler);
    startGuidedTour({ role: 'provider', steps });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ role: 'provider', steps });
    expect(hasCompletedAppTour('provider', 9)).toBe(true);
    window.removeEventListener(GUIDED_TOUR_START_EVENT, handler);
  });
});
