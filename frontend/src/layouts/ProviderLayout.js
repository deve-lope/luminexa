import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import OrgSwitcher from '../components/provider/OrgSwitcher';
import { IconBell } from '../components/icons/NavIcons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ProviderOrgProvider, useProviderOrg } from '../contexts/ProviderOrgContext';
import { buildProviderMenuItems, buildProviderTabs } from '../config/navigation';
import { isProviderMember } from '../utils/postLoginRoute';
import { getDjangoAdminUrl } from '../utils/djangoAdmin';
import { getOnboardingPath, needsOnboarding } from '../utils/profileSetup';
import { jobsAPI } from '../utils/api';
import {
  firstProviderHome,
  providerAccount,
  providerAbout,
  providerAnalytics,
  providerNotifications,
  providerServices,
  providerSettings,
  providerShare,
  providerSubscribe,
} from '../utils/providerPaths';
import { resolveProviderBack } from '../utils/navigationBack';
import {
  isProviderSubscriptionExemptPath,
  orgHasActiveSubscription,
} from '../utils/providerSubscription';
import {
  countUnseenRequests,
  markPendingRequestsSeen,
  requestAlertKey,
} from '../utils/providerRequestBadge';
import { MESSAGES_CHANGED_EVENT } from '../utils/messageBadge';
import { PROVIDER_NOTIFICATIONS_CHANGED_EVENT } from '../utils/providerNotifications';

function ProviderShell() {
  const { user, memberships, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { orgSlug, activeOrg } = useProviderOrg();
  const [alertCount, setAlertCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);

  const onRequestsTab = useMemo(() => {
    if (!orgSlug) return false;
    const base = `/provider/${orgSlug}/requests`;
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  }, [location.pathname, orgSlug]);

  const onNotificationsPage = useMemo(() => {
    if (!orgSlug) return false;
    return location.pathname.startsWith(`/provider/${orgSlug}/notifications`);
  }, [location.pathname, orgSlug]);

  const loadAlerts = useCallback(() => {
    if (!orgSlug) return;
    jobsAPI
      .getProviderDashboard(orgSlug)
      .then((res) => {
        const pendingRequests = res.data?.pending_requests || [];
        const inquiries = res.data?.customer_inquiries || [];
        const notifications = res.data?.notifications || [];
        const pendingKeys = [
          ...pendingRequests.map((r) => requestAlertKey('booking', r.id)),
          ...inquiries.map((i) => requestAlertKey('inquiry', i.id)),
        ];

        if (onRequestsTab) {
          markPendingRequestsSeen(orgSlug, pendingKeys);
          setAlertCount(0);
        } else {
          setAlertCount(countUnseenRequests(orgSlug, pendingKeys));
        }
        setNotificationCount(onNotificationsPage ? 0 : notifications.length);

        const payment = notifications.find((n) => n.kind === 'payment_received');
        if (payment) {
          const seenKey = `luminexa.seenProviderPayment.${payment.id}`;
          if (!window.sessionStorage.getItem(seenKey)) {
            window.sessionStorage.setItem(seenKey, '1');
            showToast(payment.message, 'success');
          }
        }
      })
      .catch(() => {});
  }, [orgSlug, showToast, onRequestsTab, onNotificationsPage]);

  const loadMessagesCount = useCallback(() => {
    if (!orgSlug) return;
    jobsAPI
      .listProviderConversations(orgSlug)
      .then((res) => setMessagesCount(Number(res.data?.unread_count) || 0))
      .catch(() => {});
  }, [orgSlug]);

  useEffect(() => {
    loadAlerts();
    const id = window.setInterval(loadAlerts, 60000);
    const onChanged = () => loadAlerts();
    window.addEventListener(PROVIDER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(PROVIDER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [loadAlerts]);

  useEffect(() => {
    loadMessagesCount();
    const id = window.setInterval(loadMessagesCount, 30000);
    const onChanged = () => loadMessagesCount();
    const onFocus = () => loadMessagesCount();
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChanged);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, onChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadMessagesCount, location.pathname]);

  const tabs = useMemo(
    () =>
      buildProviderTabs(orgSlug, {
        requestsBadgeCount: alertCount,
        messagesBadgeCount: messagesCount,
      }),
    [orgSlug, alertCount, messagesCount]
  );
  const menuItems = useMemo(
    () =>
      buildProviderMenuItems({
        logout: () => logout().then(() => navigate('/')),
        aboutPath: providerAbout(orgSlug),
        providerServicesPath: providerServices(orgSlug),
        providerSettingsPath: providerSettings(orgSlug),
        providerAccountPath: providerAccount(orgSlug),
        providerSharePath: providerShare(orgSlug),
        providerAnalyticsPath: providerAnalytics(orgSlug),
        isStaff: user?.can_access_django_admin,
        adminUrl: getDjangoAdminUrl(),
      }),
    [logout, navigate, orgSlug, user?.can_access_django_admin]
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
    if (location.pathname.startsWith(`${base}/analytics`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Analytics' };
    }
    if (location.pathname.startsWith(`${base}/messages`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Messages' };
    }
    if (location.pathname.startsWith(`${base}/notifications/all`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'All updates' };
    }
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
    if (location.pathname.startsWith(`${base}/subscribe`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'Subscribe' };
    }
    if (location.pathname.startsWith(`${base}/account`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'My account' };
    }
    if (location.pathname.startsWith(`${base}/about`)) {
      return { eyebrow: activeOrg?.organization_name, title: 'About Luminexa' };
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

  const headerActions = useMemo(
    () => (
      <Link
        to={providerNotifications(orgSlug)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
        aria-label={
          notificationCount > 0
            ? `Notifications, ${notificationCount} unread`
            : 'Notifications'
        }
      >
        <IconBell className="h-5 w-5" aria-hidden="true" />
        {notificationCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Link>
    ),
    [orgSlug, notificationCount]
  );

  if (needsOnboarding(user) && !location.pathname.includes('/setup')) {
    const path = getOnboardingPath(user, memberships, `${location.pathname}${location.search}`);
    if (path) return <Navigate to={path} replace />;
  }

  const membership =
    (memberships || []).find((m) => m.organization_slug === orgSlug) || activeOrg;
  if (
    membership &&
    !orgHasActiveSubscription(membership) &&
    !isProviderSubscriptionExemptPath(location.pathname, orgSlug)
  ) {
    return <Navigate to={providerSubscribe(orgSlug)} replace />;
  }

  return (
    <AppShell
      brand="Luminexa"
      eyebrow={eyebrow}
      title={title}
      headerExtra={<OrgSwitcher />}
      headerActions={headerActions}
      tabs={tabs}
      menuItems={menuItems}
      menuTitle="Provider menu"
      showBack={!isProviderHome && Boolean(backNav?.to)}
      backTo={backNav?.to}
      homeTo={providerHomePath}
    >
      <Outlet />
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
