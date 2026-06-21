export function buildProviderTabs(orgSlug, { requestsBadgeCount = 0 } = {}) {
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
  ];
}

export const CUSTOMER_TABS = [
  { id: 'home', label: 'Home', to: '/customer', end: true },
  { id: 'bookings', label: 'Bookings', to: '/customer/bookings' },
  { id: 'history', label: 'History', to: '/customer/history' },
  { id: 'explore', label: 'Services', to: '/services' },
];

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
  bookingUrl,
  publicServicesPreviewUrl,
  providerServicesPath,
  providerSettingsPath,
  providerAccountPath,
  providerSharePath,
  providerNotificationsPath,
  isStaff,
  adminUrl,
}) {
  const items = [];

  items.push({ id: 'section-business', divider: true, label: 'Business' });
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
  if (providerNotificationsPath) {
    items.push({ id: 'notifications', label: 'Notifications', to: providerNotificationsPath });
  }
  if (providerSharePath) {
    items.push({ id: 'my-page', label: 'My page', to: providerSharePath });
  }
  if (providerServicesPath) {
    items.push({ id: 'services', label: 'Services', to: providerServicesPath });
  }

  if (bookingUrl || publicServicesPreviewUrl) {
    items.push({ id: 'section-preview', divider: true, label: 'Preview' });
    if (bookingUrl) {
      items.push({
        id: 'preview-booking',
        label: 'Booking page',
        href: bookingUrl,
        external: true,
        viewOnly: true,
      });
    }
    if (publicServicesPreviewUrl) {
      items.push({
        id: 'preview-services',
        label: 'Services page',
        href: publicServicesPreviewUrl,
        external: true,
        viewOnly: true,
      });
    }
  }

  items.push({ id: 'section-site', divider: true, label: 'Site' });
  items.push({ id: 'luminexa-home', label: 'About Luminexa', to: '/' });
  if (isStaff && adminUrl) {
    items.push({ id: 'admin', label: 'Platform admin', href: adminUrl, external: true });
  }
  items.push({ id: 'logout', label: 'Log out', onClick: logout, danger: true });
  return items;
}

export function buildCustomerMenuItems({ logout }) {
  const items = [];

  items.push({ id: 'section-customer', divider: true, label: 'Customer' });
  items.push({ id: 'customer-home', label: 'Home', to: '/customer' });
  items.push({ id: 'bookings', label: 'My appointments', to: '/customer/bookings' });
  items.push({ id: 'history', label: 'History', to: '/customer/history' });
  items.push({ id: 'explore', label: 'Find & book services', to: '/services' });
  items.push({ id: 'account', label: 'Account', to: '/customer/account' });

  items.push({ id: 'section-site', divider: true, label: 'Site' });
  items.push({ id: 'luminexa-home', label: 'About Luminexa', to: '/' });
  items.push({ id: 'logout', label: 'Log out', onClick: logout, danger: true });
  return items;
}
