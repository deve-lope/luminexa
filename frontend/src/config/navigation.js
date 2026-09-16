import { authPathWithNext } from '../utils/postLoginRoute';

export function buildProviderTabs(
  orgSlug,
  { requestsBadgeCount = 0, messagesBadgeCount = 0, includeGigs = true } = {},
) {
  const base = `/provider/${orgSlug}`;
  const tabs = [
    { id: 'today', label: 'Home', to: base, end: true },
    { id: 'schedule', label: 'Schedule', to: `${base}/schedule` },
    {
      id: 'requests',
      label: 'Requests',
      to: `${base}/requests`,
      badgeCount: requestsBadgeCount > 0 ? requestsBadgeCount : undefined,
    },
  ];
  if (includeGigs) {
    tabs.push({ id: 'gigs', label: 'Gigs', to: `${base}/gigs` });
  }
  tabs.push({
    id: 'messages',
    label: 'Messages',
    to: `${base}/messages`,
    badgeCount: messagesBadgeCount > 0 ? messagesBadgeCount : undefined,
  });
  return tabs;
}

export function buildCustomerTabs({
  messagesBadgeCount = 0,
  bookingsBadgeCount = 0,
  includeGigs = true,
} = {}) {
  const tabs = [
    { id: 'home', label: 'Home', to: '/customer', end: true },
    { id: 'book', label: 'Book', to: '/customer/find' },
  ];
  if (includeGigs) {
    tabs.push({ id: 'gigs', label: 'Gigs', to: '/customer/gigs' });
  }
  tabs.push(
    {
      id: 'bookings',
      label: 'Bookings',
      to: '/customer/bookings',
      badgeCount: bookingsBadgeCount > 0 ? bookingsBadgeCount : undefined,
    },
    {
      id: 'messages',
      label: 'Messages',
      to: '/customer/messages',
      badgeCount: messagesBadgeCount > 0 ? messagesBadgeCount : undefined,
    },
  );
  return tabs;
}

/** @deprecated Prefer buildCustomerTabs — kept for any static imports */
export const CUSTOMER_TABS = buildCustomerTabs();

/** Guest / public booking pages (/book/:slug) */
export const PUBLIC_BOOK_TABS = [
  { id: 'home', label: 'Home', to: '/', end: true },
  { id: 'explore', label: 'Services', to: '/services' },
];

/**
 * Prepends primary tab routes to the drawer menu (mobile / phone app).
 * Drops duplicate links that share the same path as a tab.
 */
export function mergeTabsIntoMenuItems(tabs, menuItems) {
  if (!tabs?.length) return menuItems || [];
  const tabPaths = new Set(tabs.map((t) => t.to));
  const rest = (menuItems || []).filter(
    (item) => item.divider || !item.to || !tabPaths.has(item.to)
  );
  const tabEntries = tabs.map((tab) => ({
    id: `tab-${tab.id}`,
    label: tab.label,
    to: tab.to,
    end: tab.end,
    iconId: tab.id,
    badgeCount: tab.badgeCount,
  }));
  return [
    { id: 'section-main-nav', divider: true, label: 'Menu' },
    ...tabEntries,
    ...rest,
  ];
}

export function buildPublicBookMenuItems(nextPath) {
  return [
    { id: 'signin', label: 'Sign in', to: authPathWithNext('/login', nextPath) },
    { id: 'register', label: 'Create account', to: authPathWithNext('/register', nextPath) },
    {
      id: 'business',
      label: 'For your business',
      to: authPathWithNext('/register/business', nextPath),
    },
  ];
}

export function buildProviderMenuItems({
  logout,
  aboutPath,
  providerServicesPath,
  providerSettingsPath,
  providerAccountPath,
  providerSharePath,
  providerAnalyticsPath,
  providerClientsPath,
  providerJobsPath,
  providerGigsPath,
  includeGigs = false,
  providerNotificationsPath,
  notificationsBadgeCount = 0,
  isStaff,
  adminUrl,
}) {
  const items = [];

  // Messages lives in primary tabs (desktop sidebar + mobile bottom bar) — do not
  // duplicate it here or the PC sidebar shows Messages twice.
  items.push({ id: 'section-business', divider: true, label: 'Business' });
  if (providerJobsPath) {
    items.push({
      id: 'jobs',
      label: 'Jobs',
      to: providerJobsPath,
      iconId: 'jobs',
    });
  }
  if (includeGigs && providerGigsPath) {
    items.push({
      id: 'gigs',
      label: 'Gig wall',
      to: providerGigsPath,
      iconId: 'gigs',
    });
  }
  if (providerAnalyticsPath) {
    items.push({
      id: 'analytics',
      label: 'Analytics & books',
      to: providerAnalyticsPath,
      iconId: 'analytics',
    });
  }
  if (providerClientsPath) {
    items.push({
      id: 'clients',
      label: 'Clients',
      to: providerClientsPath,
      iconId: 'account',
    });
  }
  if (providerNotificationsPath) {
    items.push({
      id: 'notifications',
      label: 'Notifications',
      to: providerNotificationsPath,
      iconId: 'bell',
      badgeCount: notificationsBadgeCount > 0 ? notificationsBadgeCount : undefined,
    });
  }
  if (providerAccountPath) {
    items.push({
      id: 'account',
      label: 'My account',
      to: providerAccountPath,
      iconId: 'account',
    });
  }
  if (providerSettingsPath) {
    items.push({
      id: 'settings',
      label: 'Settings',
      to: providerSettingsPath,
      iconId: 'settings',
    });
  }
  if (providerSharePath) {
    items.push({ id: 'my-page', label: 'My page', to: providerSharePath });
  }
  if (providerServicesPath) {
    items.push({ id: 'services', label: 'Services', to: providerServicesPath });
  }

  items.push({ id: 'section-site', divider: true, label: 'Site' });
  if (aboutPath) {
    items.push({ id: 'luminexa-home', label: 'About Luminexa', to: aboutPath });
  }
  if (isStaff && adminUrl) {
    items.push({ id: 'admin', label: 'Platform admin', href: adminUrl, external: true });
  }
  items.push({ id: 'logout', label: 'Log out', onClick: logout, danger: true });
  return items;
}

export function buildCustomerMenuItems({
  logout,
  messagesBadgeCount = 0,
  includeGigs = false,
} = {}) {
  const items = [];

  items.push({ id: 'section-more', divider: true, label: 'More' });
  if (includeGigs) {
    items.push({
      id: 'gigs',
      label: 'Gig wall',
      to: '/customer/gigs',
      iconId: 'gigs',
    });
  }
  items.push({
    id: 'account',
    label: 'Account',
    to: '/customer/account',
    iconId: 'account',
  });
  items.push({
    id: 'messages',
    label: 'Messages',
    to: '/customer/messages',
    iconId: 'messages',
    badgeCount: messagesBadgeCount > 0 ? messagesBadgeCount : undefined,
  });
  items.push({ id: 'completed', label: 'Past jobs', to: '/customer/completed' });
  items.push({ id: 'referrals', label: 'Referrals', to: '/customer/referrals' });
  items.push({ id: 'luminexa-home', label: 'About Luminexa', to: '/customer/about' });
  items.push({ id: 'logout', label: 'Log out', onClick: logout, danger: true });
  return items;
}
