import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import OrgSwitcher from '../components/provider/OrgSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { ProviderOrgProvider, useProviderOrg } from '../contexts/ProviderOrgContext';
import { buildProviderMenuItems, buildProviderTabs } from '../config/navigation';
import { isProviderMember } from '../utils/postLoginRoute';
import { getCustomerBookingUrl, getPublicAppUrl } from '../utils/bookingLink';
import { publicServicesCatalog } from '../utils/customerPaths';
import { getDjangoAdminUrl } from '../utils/djangoAdmin';
import { jobsAPI } from '../utils/api';
import {
  firstProviderHome,
  providerAccount,
  providerNotifications,
  providerServices,
  providerSettings,
  providerShare,
} from '../utils/providerPaths';
import { resolveProviderBack } from '../utils/navigationBack';

function ProviderShell() {
  const { user, memberships, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { orgSlug, activeOrg } = useProviderOrg();
  const [alertCount, setAlertCount] = useState(0);

  const loadAlerts = useCallback(() => {
    if (!orgSlug) return;
    jobsAPI
      .getProviderDashboard(orgSlug)
      .then((res) => {
        const stats = res.data?.stats || {};
        const pending = stats.pending_requests_count || 0;
        const inquiries = stats.customer_inquiries_count || 0;
        setAlertCount(pending + inquiries);
      })
      .catch(() => {});
  }, [orgSlug]);

  useEffect(() => {
    loadAlerts();
    const id = window.setInterval(loadAlerts, 60000);
    return () => window.clearInterval(id);
  }, [loadAlerts]);

  const tabs = useMemo(
    () => buildProviderTabs(orgSlug, { requestsBadgeCount: alertCount }),
    [orgSlug, alertCount]
  );
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
        providerServicesPath: providerServices(orgSlug),
        providerSettingsPath: providerSettings(orgSlug),
        providerAccountPath: providerAccount(orgSlug),
        providerSharePath: providerShare(orgSlug),
        providerNotificationsPath: providerNotifications(orgSlug),
        isStaff: user?.is_staff,
        adminUrl: getDjangoAdminUrl(),
      }),
    [logout, navigate, bookingUrl, publicServicesPreviewUrl, orgSlug, user?.is_staff]
  );

  const providerHomePath = `/provider/${orgSlug}`;
  const isProviderHome = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '') || '/';
    return path === providerHomePath;
  }, [location.pathname, providerHomePath]);

  const backNav = useMemo(
    () => resolveProviderBack(location.pathname, orgSlug),
    [location.pathname, orgSlug]
  );

  const { eyebrow, title } = useMemo(() => {
    const base = `/provider/${orgSlug}`;
    if (location.pathname.startsWith(`${base}/notifications`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Notifications' };
    }
    if (location.pathname.startsWith(`${base}/services`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Services catalog' };
    }
    if (location.pathname.startsWith(`${base}/requests/`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Request details' };
    }
    if (location.pathname.startsWith(`${base}/requests`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Service requests' };
    }
    if (location.pathname.startsWith(`${base}/my-page`) || location.pathname.startsWith(`${base}/share`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'My page' };
    }
    if (location.pathname.startsWith(`${base}/settings`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Settings' };
    }
    if (location.pathname.startsWith(`${base}/account`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'My account' };
    }
    if (location.pathname.match(/\/schedule\/booking\//)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Booking details' };
    }
    if (location.pathname.match(/\/schedule\/(slot|block)\//)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Schedule item' };
    }
    if (location.pathname.includes('/schedule')) {
      return { eyebrow: activeOrg?.organization_name, title: 'Open times & bookings' };
    }
    if (location.pathname.includes('/tasks/new')) {
      return { eyebrow: activeOrg?.organization_name, title: 'Add task' };
    }
    if (location.pathname.includes('/tasks')) {
      return { eyebrow: activeOrg?.organization_name, title: 'Tasks' };
    }
    return {
      eyebrow: activeOrg?.organization_name,
      title: 'Today',
    };
  }, [location.pathname, activeOrg, orgSlug]);

  return (
    <AppShell
      brand="Luminexa"
      eyebrow={eyebrow}
      title={title}
      headerExtra={<OrgSwitcher />}
      tabs={tabs}
      menuItems={menuItems}
      menuTitle="Provider menu"
      showBack={!isProviderHome && Boolean(backNav?.to)}
      backTo={backNav?.to}
      homeTo={providerHomePath}
    >
      <Outlet context={{ bookingUrl }} />
    </AppShell>
  );
}

export default function ProviderLayout() {
  const { orgSlug: urlSlug } = useParams();
  const { isAuthenticated, loading, memberships } = useAuth();
  const navigate = useNavigate();

  const providerOrgs = useMemo(
    () => (memberships || []).filter((m) => m.role === 'owner' || m.role === 'staff'),
    [memberships]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-luminexa-navy text-luminexa-mist">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  if (!isProviderMember(memberships)) {
    navigate('/customer', { replace: true });
    return null;
  }

  if (!providerOrgs.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-6 text-center">
        <p className="text-slate-700">No business linked to this account yet.</p>
        <Link to="/register/business" className="font-medium text-luminexa-accent">
          Register your business
        </Link>
      </div>
    );
  }

  if (!urlSlug) {
    return <Navigate to={firstProviderHome(memberships)} replace />;
  }

  const allowed = providerOrgs.some((m) => m.organization_slug === urlSlug);
  if (!allowed) {
    return <Navigate to={firstProviderHome(memberships)} replace />;
  }

  return (
    <ProviderOrgProvider providerOrgs={providerOrgs} orgSlug={urlSlug}>
      <ProviderShell />
    </ProviderOrgProvider>
  );
}
