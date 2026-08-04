import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import CustomerInvoicePaymentPrompt from '../components/customer/CustomerInvoicePaymentPrompt';
import CustomerNotificationBell from '../components/customer/CustomerNotificationBell';
import { useAuth } from '../contexts/AuthContext';
import { CUSTOMER_TABS, buildCustomerMenuItems } from '../config/navigation';
import { jobsAPI } from '../utils/api';
import { isProviderMember } from '../utils/postLoginRoute';
import { getOnboardingPath, needsOnboarding } from '../utils/profileSetup';
import { firstProviderHome } from '../utils/providerPaths';
import { resolveCustomerBack } from '../utils/navigationBack';
import { NOTIFICATIONS_CHANGED_EVENT } from '../utils/customerNotifications';

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
    () => resolveCustomerBack(location.pathname, location.search),
    [location.pathname, location.search]
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
    const onChanged = () => loadNotificationCount();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
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
    if (location.pathname.endsWith('/customer/categories')) {
      return { eyebrow: 'Browse', title: 'All categories' };
    }
    if (/^\/customer\/bookings\/[^/]+$/.test(location.pathname)) {
      return { eyebrow: 'Bookings', title: 'Appointment' };
    }
    if (location.pathname.endsWith('/customer/bookings')) {
      return { eyebrow: 'Bookings', title: 'Upcoming' };
    }
    if (location.pathname.endsWith('/customer/messages')) {
      return { eyebrow: 'Messages', title: 'Conversations' };
    }
    if (location.pathname.endsWith('/customer/notifications')) {
      return { eyebrow: 'Updates', title: 'All notifications' };
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
      <CustomerNotificationBell
        unreadCount={notificationCount}
        onCountChange={setNotificationCount}
      />
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
