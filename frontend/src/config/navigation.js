export function buildProviderTabs(
  orgSlug,
  { requestsBadgeCount = 0, messagesBadgeCount = 0 } = {},
) {
  const base = `/provider/${orgSlug}`;
  return [
    { id: 'today', label: 'Home', to: base, end: true },
    { id: 'schedule', label: 'Schedule', to: `${base}/schedule` },
    {
      id: 'requests',
      label: 'Requests',
      to: `${base}/requests`,
      badgeCount: requestsBadgeCount > 0 ? requestsBadgeCount : undefined,
    },
    {
      id: 'messages',
      label: 'Messages',
      to: `${base}/messages`,
      badgeCount: messagesBadgeCount > 0 ? messagesBadgeCount : undefined,
    },
  ];
}

export function buildCustomerTabs({ messagesBadgeCount = 0 } = {}) {
  return [
    { id: 'home', label: 'Home', to: '/customer', end: true },
    { id: 'book', label: 'Book', to: '/customer/find' },
    { id: 'bookings', label: 'Bookings', to: '/customer/bookings' },
    {
      id: 'messages',
      label: 'Messages',
      to: '/customer/messages',
      badgeCount: messagesBadgeCount > 0 ? messagesBadgeCount : undefined,
    },
  ];
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

export function buildPublicBookMenuItems() {
  return [
    { id: 'signin', label: 'Sign in', to: '/login' },
    { id: 'register', label: 'Create account', to: '/register' },
    { id: 'business', label: 'For your business', to: '/register/business' },
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
  isStaff,
  adminUrl,
}) {
  const items = [];

  // Messages lives in primary tabs (desktop sidebar + mobile bottom bar) — do not
  // duplicate it here or the PC sidebar shows Messages twice.
  items.push({ id: 'section-business', divider: true, label: 'Business' });
  if (providerAnalyticsPath) {
    items.push({
      id: 'analytics',
      label: 'Analytics',
      to: providerAnalyticsPath,
      iconId: 'analytics',
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

export function buildCustomerMenuItems({ logout, messagesBadgeCount = 0 } = {}) {
  const items = [];

  items.push({ id: 'section-more', divider: true, label: 'More' });
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
  items.push({ id: 'history', label: 'History', to: '/customer/history' });
  items.push({ id: 'luminexa-home', label: 'About Luminexa', to: '/customer/about' });
  items.push({ id: 'logout', label: 'Log out', onClick: logout, danger: true });
  return items;
}
