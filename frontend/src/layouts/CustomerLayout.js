import React, { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { CUSTOMER_TABS, buildCustomerMenuItems } from '../config/navigation';
import { isProviderMember } from '../utils/postLoginRoute';
import { firstProviderHome } from '../utils/providerPaths';
import { resolveCustomerBack } from '../utils/navigationBack';

export default function CustomerLayout({ children }) {
  const { isAuthenticated, loading, user, memberships, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    if (location.pathname.endsWith('/customer/history')) {
      return { eyebrow: 'History', title: 'Past activity' };
    }
    if (location.pathname.endsWith('/services')) {
      return { eyebrow: 'Explore', title: 'Find a service' };
    }
    if (location.pathname.endsWith('/customer/account')) {
      return { eyebrow: 'Account', title: 'Profile & password' };
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

  return (
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
    >
      {children ?? <Outlet />}
    </AppShell>
  );
}
