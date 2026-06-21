import React, { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { isProviderMember } from '../utils/postLoginRoute';
import { providerBookingRedirectPath } from '../utils/providerBookingGuard';
import {
  providerAccount,
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
        providerAccountPath: providerAccount(orgSlug),
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

  const isProvider = isProviderMember(memberships);

  /** Providers never use the customer booking shell on public /book URLs. */
  const variant = useMemo(() => {
    if (!isAuthenticated) return 'guest';
    if (isProvider) {
      if (staffOfOrg) return 'owner';
      return 'provider_redirect';
    }
    if (ownerPreviewMode && staffOfOrg) return 'owner';
    return 'customer';
  }, [isAuthenticated, isProvider, ownerPreviewMode, staffOfOrg]);

  const providerRedirect = useMemo(
    () => (variant === 'provider_redirect' ? providerBookingRedirectPath(memberships, slug) : null),
    [variant, memberships, slug]
  );

  const outletContext = useMemo(() => ({ variant, orgSlug: slug }), [variant, slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (providerRedirect) {
    return <Navigate to={providerRedirect} replace />;
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
