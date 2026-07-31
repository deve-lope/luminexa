import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import CustomerInvoicePaymentPrompt from '../components/customer/CustomerInvoicePaymentPrompt';
import { IconBell } from '../components/icons/NavIcons';
import { useAuth } from '../contexts/AuthContext';
import { CUSTOMER_TABS, buildCustomerMenuItems } from '../config/navigation';
import { jobsAPI } from '../utils/api';
import { customerNotifications } from '../utils/customerPaths';
import { isProviderMember } from '../utils/postLoginRoute';
import { getOnboardingPath, needsOnboarding } from '../utils/profileSetup';
import { firstProviderHome } from '../utils/providerPaths';
import { resolveCustomerBack } from '../utils/navigationBack';

export default function CustomerLayout({ children }) {
  const { isAuthenticated, loading, user, memberships, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = useState(0);

  const menuItems = useMemo(
    () =>
      buildCustomerMenuItems({
        logout: () => logout().then(() => navigate('/')),
      }),
    [logout, navigate]
  );

  const isCustomerAppRoute =
    !children && (location.pathname === '/customer' || location.pathname.startsWith('/customer/'));

  const customerHomePath = '/customer';
  const isCustomerHome = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '') || '/';
    return path === customerHomePath;
  }, [location.pathname]);

  const backNav = useMemo(
    () => resolveCustomerBack(location.pathname),
    [location.pathname]
  );

  const loadNotificationCount = useCallback(() => {
    if (!isAuthenticated) return;
    jobsAPI
      .listMyNotifications()
      .then((res) => setNotificationCount(Number(res.data?.count) || 0))
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomerAppRoute) return undefined;
    loadNotificationCount();
    const id = window.setInterval(loadNotificationCount, 60000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, isCustomerAppRoute, loadNotificationCount, location.pathname]);

  const { eyebrow, title } = useMemo(() => {
    if (/^\/book\/[^/]+\/services$/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Services' };
    }
    if (/^\/book\/[^/]+\/[^/]+/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Book appointment' };
    }
    if (/^\/book\/[^/]+$/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Provider' };
    }
    if (location.pathname.includes('/customer/find/')) {
      return { eyebrow: 'Explore', title: 'Choose a provider' };
    }
    if (location.pathname.endsWith('/find')) {
      return { eyebrow: 'Explore', title: 'Book a service' };
    }
    if (location.pathname.endsWith('/customer/bookings')) {
      return { eyebrow: 'Bookings', title: 'Upcoming' };
    }
    if (location.pathname.endsWith('/customer/messages')) {
      return { eyebrow: 'Messages', title: 'Conversations' };
    }
    if (location.pathname.endsWith('/customer/notifications')) {
      return { eyebrow: 'Updates', title: 'Notifications' };
    }
    if (location.pathname.endsWith('/customer/history')) {
      return { eyebrow: 'History', title: 'Past activity' };
    }
    if (location.pathname.endsWith('/services')) {
      return { eyebrow: 'Explore', title: 'Find a service' };
    }
    if (location.pathname.endsWith('/customer/account')) {
      return { eyebrow: 'Account', title: 'Profile & password' };
    }
    if (location.pathname.endsWith('/customer/about')) {
      return { eyebrow: 'More', title: 'About Luminexa' };
    }
    if (/^\/customer\/provider\/[^/]+\/[^/]+$/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Book appointment' };
    }
    if (/^\/customer\/provider\/[^/]+\/services\/[^/]+$/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Service details' };
    }
    if (/^\/customer\/provider\/[^/]+$/.test(location.pathname)) {
      return { eyebrow: 'Book', title: 'Provider' };
    }
    if (location.pathname === '/customer' || location.pathname.endsWith('/customer/')) {
      return {
        eyebrow: 'Home',
        title: user?.full_name ? `Hi, ${user.full_name.split(' ')[0]}` : 'Your services',
      };
    }
    return {
      eyebrow: 'Customer',
      title: user?.full_name ? `Hi, ${user.full_name}` : 'Luminexa',
    };
  }, [location.pathname, user?.full_name]);

  const headerActions = useMemo(
    () => (
      <Link
        to={customerNotifications()}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
        aria-label={
          notificationCount > 0
            ? `Notifications, ${notificationCount} unread`
            : 'Notifications'
        }
      >
        <IconBell className="h-5 w-5" />
        {notificationCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Link>
    ),
    [notificationCount]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated && !children) {
    navigate('/login', { replace: true });
    return null;
  }

  if (isAuthenticated && isCustomerAppRoute && isProviderMember(memberships)) {
    return <Navigate to={firstProviderHome(memberships)} replace />;
  }

  if (isAuthenticated && needsOnboarding(user) && isCustomerAppRoute) {
    const path = getOnboardingPath(user, memberships, `${location.pathname}${location.search}`);
    if (path) return <Navigate to={path} replace />;
  }

  return (
    <>
      <AppShell
        brand="Luminexa"
        eyebrow={eyebrow}
        title={title}
        tabs={CUSTOMER_TABS}
        menuItems={menuItems}
        menuTitle="Menu"
        showBack={!isCustomerHome && Boolean(backNav?.to)}
        backTo={backNav?.to}
        homeTo={customerHomePath}
        headerActions={headerActions}
      >
        {children ?? <Outlet />}
      </AppShell>
      {isAuthenticated && isCustomerAppRoute && <CustomerInvoicePaymentPrompt />}
    </>
  );
}
