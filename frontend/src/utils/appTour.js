/** First-run app walkthrough — local persistence + role-specific steps. */

export const APP_TOUR_START_EVENT = 'lx-app-tour-start';
/** Replayable Training / “Show me” spotlights (does not mark first-run done). */
export const GUIDED_TOUR_START_EVENT = 'lx-guided-tour-start';
export const APP_TOUR_VERSION = 2;
export const APP_TOUR_ELIGIBLE_KEY = 'lx_app_tour_eligible';
/** Wait on Home so the first open isn’t covered by the tour immediately. */
export const APP_TOUR_AUTO_START_DELAY_MS = 10_000;

/** Auto-show only for recently onboarded users (or this browser session after setup). */
const AUTO_START_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const DONE_PREFIX = 'lx_app_tour_done:';

function storageKey(role, userId) {
  return `${DONE_PREFIX}v${APP_TOUR_VERSION}:${role}:${userId || 'anon'}`;
}

export function hasCompletedAppTour(role, userId) {
  if (!role || typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey(role, userId)) === '1';
  } catch {
    return true;
  }
}

export function markAppTourComplete(role, userId) {
  if (!role || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(role, userId), '1');
    window.sessionStorage.removeItem(APP_TOUR_ELIGIBLE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resetAppTour(role, userId) {
  if (!role || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(role, userId));
  } catch {
    /* ignore */
  }
}

/** Call right after profile onboarding completes so the tour can open. */
export function markAppTourEligible() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(APP_TOUR_ELIGIBLE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldAutoStartAppTour(role, user) {
  if (!role || !user?.id) return false;
  if (hasCompletedAppTour(role, user.id)) return false;
  try {
    if (window.sessionStorage.getItem(APP_TOUR_ELIGIBLE_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  const completed = user.onboarding_completed_at;
  if (!completed) return false;
  const t = Date.parse(completed);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < AUTO_START_WINDOW_MS;
}

/** Open the tour (e.g. from Account). Clears “done” so it can run again. */
export function requestAppTour(role, userId) {
  resetAppTour(role, userId);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_TOUR_START_EVENT, { detail: { role, userId } })
  );
}

/**
 * Run a short spotlight walkthrough (Training “Show me”).
 * Does not clear or set first-run completion.
 * @param {{ role: string, steps: Array<{ id?: string, title: string, body: string, target?: string, path?: string, cta?: { label: string, path: string } }> }} opts
 */
export function startGuidedTour({ role, steps } = {}) {
  if (typeof window === 'undefined') return;
  if (!role || !Array.isArray(steps) || steps.length === 0) return;
  window.dispatchEvent(
    new CustomEvent(GUIDED_TOUR_START_EVENT, { detail: { role, steps } })
  );
}

/**
 * @param {'customer' | 'provider'} role
 * @param {{ orgSlug?: string, includeGigs?: boolean }} opts
 */
export function buildAppTourSteps(role, { orgSlug = '', includeGigs = true } = {}) {
  if (role === 'provider') {
    const base = orgSlug ? `/provider/${orgSlug}` : '/provider';
    const steps = [
      {
        id: 'welcome',
        title: 'Welcome to Luminexa',
        body: 'A quick tour of your provider tools — schedule, requests, and messages. You can skip anytime.',
        path: base,
      },
      {
        id: 'today',
        title: 'Home',
        body: 'See today’s jobs, tasks, and what needs attention first.',
        target: 'tab-today',
        path: base,
      },
      {
        id: 'schedule',
        title: 'Schedule',
        body: 'Manage open times and bookings. Tap Schedule in the bar to open your calendar.',
        target: 'tab-schedule',
        path: base,
      },
      {
        id: 'requests',
        title: 'Requests',
        body: 'New booking requests and customer inquiries land here for you to accept or reply.',
        target: 'tab-requests',
        path: base,
      },
    ];
    if (includeGigs) {
      steps.push({
        id: 'gigs',
        title: 'Gig wall',
        body: 'Browse open gigs from customers nearby and send bids when you want the work.',
        target: 'tab-gigs',
        path: base,
      });
    }
    steps.push(
      {
        id: 'messages',
        title: 'Messages',
        body: 'Chat with customers about bookings, quotes, and job details.',
        target: 'tab-messages',
        path: base,
      },
      {
        id: 'training',
        title: 'Training',
        body: 'More help anytime: Menu → Training. Short lessons that point you to each screen.',
        target: 'menu',
        path: base,
        cta: { label: 'Open Training', path: `${base}/training` },
      }
    );
    return steps;
  }

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to Luminexa',
      body: 'Here’s how to find providers, book services, and stay in touch. Skip anytime if you prefer to explore.',
      path: '/customer',
    },
    {
      id: 'home',
      title: 'Home',
      body: 'Your starting point — recent activity, shortcuts, and what’s coming up.',
      target: 'tab-home',
      path: '/customer',
    },
    {
      id: 'book',
      title: 'Book',
      body: 'Tap Book in the bar below to find providers near you.',
      target: 'tab-book',
      // Stay on Home so the spotlight points at the tab to tap, not the Find page.
      path: '/customer',
    },
    {
      id: 'search',
      title: 'Search',
      body: 'Type a service or set your location here to see who can come to you.',
      target: 'find-search',
      path: '/customer/find',
    },
  ];
  if (includeGigs) {
    steps.push({
      id: 'gigs',
      title: 'Gig wall',
      body: 'Post a job when you need something custom, then review bids from providers.',
      target: 'tab-gigs',
      path: '/customer',
    });
  }
  steps.push(
    {
      id: 'bookings',
      title: 'Bookings',
      body: 'Track upcoming appointments, quotes, and completed jobs in one place.',
      target: 'tab-bookings',
      path: '/customer',
    },
    {
      id: 'messages',
      title: 'Messages',
      body: 'Message your provider about timing, access, or job details.',
      target: 'tab-messages',
      path: '/customer',
    },
    {
      id: 'menu',
      title: 'Menu',
      body: 'Account, referrals, and more live in the menu. You’re all set — book when you’re ready.',
      target: 'menu',
      path: '/customer',
    }
  );
  return steps;
}

/** Prefer the visible target (mobile tabs vs desktop sidebar). */
export function queryTourTarget(targetId) {
  if (!targetId || typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${targetId}"]`));
  return (
    nodes.find((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none'
      );
    }) || null
  );
}
