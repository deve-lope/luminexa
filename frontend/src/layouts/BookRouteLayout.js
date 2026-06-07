import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import CustomerLayout from './CustomerLayout';
import { ProviderOrgProvider } from '../contexts/ProviderOrgContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PUBLIC_BOOK_TABS,
  buildProviderMenuItems,
  buildProviderTabs,
  buildPublicBookMenuItems,
} from '../config/navigation';
import { isOrgStaff } from '../utils/bookingAccess';
import { getCustomerBookingUrl, getPublicAppUrl } from '../utils/bookingLink';
import { getDjangoAdminUrl } from '../utils/djangoAdmin';
import { businessPage, publicServicesCatalog } from '../utils/customerPaths';
import {
  providerHome,
  providerNotifications,
  providerSettings,
  providerShare,
} from '../utils/providerPaths';

function BookOwnerShell({ orgSlug, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = useMemo(() => buildProviderTabs(orgSlug), [orgSlug]);
  const bookingUrl = useMemo(() => getCustomerBookingUrl(orgSlug), [orgSlug]);
  const publicServicesPreviewUrl = useMemo(
    () => (orgSlug ? `${getPublicAppUrl()}${publicServicesCatalog(orgSlug)}` : null),
    [orgSlug]
  );

  const menuItems = useMemo(
    () =>
      buildProviderMenuItems({
        logout: () => logout().then(() => navigate('/')),
        bookingUrl,
        publicServicesPreviewUrl,
        providerServicesPath: `/provider/${orgSlug}/services`,
        providerSettingsPath: providerSettings(orgSlug),
        providerSharePath: providerShare(orgSlug),
        providerNotificationsPath: providerNotifications(orgSlug),
        isStaff: user?.is_staff,
        adminUrl: getDjangoAdminUrl(),
      }),
    [logout, navigate, bookingUrl, publicServicesPreviewUrl, orgSlug, user?.is_staff]
  );

  const onServicesPage = location.pathname.endsWith('/services');
  const title = onServicesPage ? 'Services' : 'Booking page';
  const eyebrow = onServicesPage ? 'Public catalog' : 'Your business';

  return (
    <AppShell
      brand="Luminexa"
      eyebrow={eyebrow}
      title={title}
      tabs={tabs}
      menuItems={menuItems}
      menuTitle="Provider menu"
      showBack
      backTo={providerHome(orgSlug)}
    >
      {children}
    </AppShell>
  );
}

function BookGuestShell({ children }) {
  const location = useLocation();
  const { slug } = useParams();
  const onServicesPage = location.pathname.endsWith('/services');

  return (
    <AppShell
      brand="Luminexa"
      eyebrow="Book"
      title={onServicesPage ? 'Services' : 'Provider'}
      tabs={PUBLIC_BOOK_TABS}
      menuItems={buildPublicBookMenuItems()}
      menuTitle="Menu"
      showBack
      backTo={onServicesPage ? businessPage(slug) : '/'}
    >
      {children}
    </AppShell>
  );
}

/**
 * Wraps /book/:slug/* with the right shell: provider dashboard nav, customer app, or public guest nav.
 */
export default function BookRouteLayout() {
  const { slug } = useParams();
  const { isAuthenticated, loading, memberships } = useAuth();
  const [searchParams] = useSearchParams();

  const staffOfOrg = useMemo(
    () => isOrgStaff(memberships, slug),
    [memberships, slug]
  );

  const providerOrgs = useMemo(
    () => (memberships || []).filter((m) => m.role === 'owner' || m.role === 'staff'),
    [memberships]
  );

  const ownerPreviewMode =
    searchParams.get('mode') === 'owner' || searchParams.get('view') === 'provider';

  /** Public book URLs always use the customer/guest experience unless explicitly previewing as owner. */
  const variant = useMemo(() => {
    if (!isAuthenticated) return 'guest';
    if (ownerPreviewMode && staffOfOrg) return 'owner';
    return 'customer';
  }, [isAuthenticated, ownerPreviewMode, staffOfOrg]);

  const outletContext = useMemo(() => ({ variant, orgSlug: slug }), [variant, slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (variant === 'owner') {
    return (
      <ProviderOrgProvider providerOrgs={providerOrgs} orgSlug={slug}>
        <BookOwnerShell>
          <Outlet context={outletContext} />
        </BookOwnerShell>
      </ProviderOrgProvider>
    );
  }

  if (variant === 'customer') {
    return (
      <CustomerLayout>
        <Outlet context={outletContext} />
      </CustomerLayout>
    );
  }

  return (
    <BookGuestShell>
      <Outlet context={outletContext} />
    </BookGuestShell>
  );
}
