import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ApiHealthProvider, useApiHealth } from './contexts/ApiHealthContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ConnectionLoadingPage from './pages/ConnectionLoadingPage';
import MaintenancePage from './pages/MaintenancePage';
import LandingRoute from './pages/LandingRoute';
import AboutPage from './pages/AboutPage';
import { CityCategoryPage, CityHubPage } from './pages/OttawaLandingPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import GuestBookingPage from './pages/GuestBookingPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CheckEmailPage from './pages/CheckEmailPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import CustomerBookingsPage from './pages/customer/CustomerBookingsPage';
import CustomerBookingDetailPage from './pages/customer/CustomerBookingDetailPage';
import CustomerInquiryDetailPage from './pages/customer/CustomerInquiryDetailPage';
import CustomerHistoryPage from './pages/customer/CustomerHistoryPage';
import CustomerCompletedPage from './pages/customer/CustomerCompletedPage';
import CustomerQuotesPage from './pages/customer/CustomerQuotesPage';
import CustomerAccountPage from './pages/customer/CustomerAccountPage';
import CustomerProviderRoutes from './layouts/CustomerProviderRoutes';
import CustomerBookServicePage from './pages/customer/CustomerBookServicePage';
import AcceptStaffInvitePage from './pages/AcceptStaffInvitePage';
import BookRouteLayout from './layouts/BookRouteLayout';
import BookingStorefrontPage from './pages/BookingStorefrontPage';
import ServicesBrowseWrapper from './pages/ServicesBrowseWrapper';
import ServicesTypePage from './pages/ServicesTypePage';
import ProviderLayout from './layouts/ProviderLayout';
import CustomerLayout from './layouts/CustomerLayout';
import ProviderTodayPage from './pages/provider/ProviderTodayPage';
import ProviderSharePage from './pages/provider/ProviderSharePage';
import ProviderServicesPage from './pages/provider/ProviderServicesPage';
import PublicProviderServicesPage from './pages/PublicProviderServicesPage';
import CustomerServiceDetailPage from './pages/customer/CustomerServiceDetailPage';
import ProviderSchedulePage from './pages/provider/ProviderSchedulePage';
import ProviderScheduleDetailPage from './pages/provider/ProviderScheduleDetailPage';
import ProviderRequestsPage from './pages/provider/ProviderRequestsPage';
import ProviderRequestDetailPage from './pages/provider/ProviderRequestDetailPage';
import ProviderSettingsPage from './pages/provider/ProviderSettingsPage';
import ProviderSubscribePage from './pages/provider/ProviderSubscribePage';
import ProviderAccountPage from './pages/provider/ProviderAccountPage';
import ProviderBillingPage from './pages/provider/ProviderBillingPage';
import ProviderNotificationsPage from './pages/provider/ProviderNotificationsPage';
import ProviderNotificationsAllPage from './pages/provider/ProviderNotificationsAllPage';
import ProviderMessagesPage from './pages/provider/ProviderMessagesPage';
import ProviderAddTaskPage from './pages/provider/ProviderAddTaskPage';
import ProviderTasksPage from './pages/provider/ProviderTasksPage';
import ProviderAnalyticsPage from './pages/provider/ProviderAnalyticsPage';
import ProviderClientsPage from './pages/provider/ProviderClientsPage';
import ProviderClientDetailPage from './pages/provider/ProviderClientDetailPage';
import CustomerHomePage from './pages/customer/CustomerHomePage';
import CustomerFindPage from './pages/customer/CustomerFindPage';
import CustomerCategoriesPage from './pages/customer/CustomerCategoriesPage';
import CustomerMessagesPage from './pages/customer/CustomerMessagesPage';
import CustomerNotificationsPage from './pages/customer/CustomerNotificationsPage';
import CustomerProvidersByTypePage from './pages/customer/CustomerProvidersByTypePage';
import CustomerSetupPage from './pages/customer/CustomerSetupPage';
import ProviderSetupPage from './pages/provider/ProviderSetupPage';
import BookServiceGateway from './pages/BookServiceGateway';
import BookMultipleGateway from './pages/BookMultipleGateway';
import CustomerBookMultipleServicesPage from './pages/customer/CustomerBookMultipleServicesPage';
import {
  RedirectToBookProvider,
  RedirectToBookService,
} from './components/booking/BookRedirect';
import ProviderLegacyRedirect from './components/provider/ProviderLegacyRedirect';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { bootstrapNativeApp, isNativeApp } from './native/capacitorNative';
import ScrollToTop from './components/ScrollToTop';
import InAppNavTracker from './components/InAppNavTracker';
import AppBackHandler from './components/AppBackHandler';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-luminexa-navy text-luminexa-mist">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { connectionStatus } = useApiHealth();
  const location = useLocation();

  if (connectionStatus === 'connecting') {
    return <ConnectionLoadingPage />;
  }
  if (connectionStatus === 'down') {
    return <MaintenancePage />;
  }

  const isAuthShell =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/register/business' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/check-email' ||
    location.pathname === '/verify-email' ||
    location.pathname === '/customer/setup' ||
    /^\/provider\/[^/]+\/setup$/.test(location.pathname);

  return (
    <div className={isAuthShell ? 'min-h-[100dvh] bg-luminexa-canvas' : 'min-h-[100dvh] bg-slate-50'}>
      {!isNativeApp() && !location.pathname.startsWith('/b/') && <PwaInstallPrompt />}
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/ottawa" element={<CityHubPage />} />
        <Route path="/ottawa/:slug" element={<CityCategoryPage />} />
        <Route path="/ottawa/:slug/" element={<CityCategoryPage />} />
        <Route path="/toronto" element={<CityHubPage />} />
        <Route path="/toronto/:slug" element={<CityCategoryPage />} />
        <Route path="/toronto/:slug/" element={<CityCategoryPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/b/:token" element={<GuestBookingPage />} />
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/business" element={<RegisterBusinessPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/accept-staff-invite" element={<AcceptStaffInvitePage />} />
        <Route
          path="/customer/setup"
          element={
            <PrivateRoute>
              <CustomerSetupPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider/:orgSlug/setup"
          element={
            <PrivateRoute>
              <ProviderSetupPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider/schedule/*"
          element={
            <PrivateRoute>
              <ProviderLegacyRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider/settings"
          element={
            <PrivateRoute>
              <ProviderLegacyRedirect suffix="/settings" />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider/share"
          element={
            <PrivateRoute>
              <ProviderLegacyRedirect suffix="/my-page" />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider"
          element={
            <PrivateRoute>
              <ProviderLayout />
            </PrivateRoute>
          }
        />
        <Route
          path="/provider/:orgSlug"
          element={
            <PrivateRoute>
              <ProviderLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<ProviderTodayPage />} />
          <Route path="tasks" element={<ProviderTasksPage />} />
          <Route path="tasks/new" element={<ProviderAddTaskPage />} />
          <Route path="schedule" element={<ProviderSchedulePage />} />
          <Route path="schedule/:kind/:id" element={<ProviderScheduleDetailPage />} />
          <Route path="requests" element={<ProviderRequestsPage />} />
          <Route path="requests/:kind/:id" element={<ProviderRequestDetailPage />} />
          <Route path="messages" element={<ProviderMessagesPage />} />
          <Route path="notifications" element={<ProviderNotificationsPage />} />
          <Route path="notifications/all" element={<ProviderNotificationsAllPage />} />
          <Route path="settings" element={<ProviderSettingsPage />} />
          <Route path="subscribe" element={<ProviderSubscribePage />} />
          <Route path="account" element={<ProviderAccountPage />} />
          <Route path="billing" element={<ProviderBillingPage />} />
          <Route path="about" element={<AboutPage embedded />} />
          <Route path="my-page" element={<ProviderSharePage />} />
          <Route path="share" element={<Navigate to="my-page" replace />} />
          <Route path="services" element={<ProviderServicesPage />} />
          <Route path="analytics" element={<ProviderAnalyticsPage />} />
          <Route path="clients" element={<ProviderClientsPage />} />
          <Route path="clients/:userId" element={<ProviderClientDetailPage />} />
        </Route>
        <Route
          path="/customer"
          element={
            <PrivateRoute>
              <CustomerLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<CustomerHomePage />} />
          <Route path="bookings" element={<CustomerBookingsPage />} />
          <Route path="bookings/:bookingId" element={<CustomerBookingDetailPage />} />
          <Route path="inquiries/:inquiryId" element={<CustomerInquiryDetailPage />} />
          <Route path="messages" element={<CustomerMessagesPage />} />
          <Route path="notifications" element={<CustomerNotificationsPage />} />
          <Route path="quotes" element={<CustomerQuotesPage />} />
          <Route path="completed" element={<CustomerCompletedPage />} />
          <Route path="history" element={<CustomerHistoryPage />} />
          <Route path="account" element={<CustomerAccountPage />} />
          <Route path="about" element={<AboutPage embedded />} />
          <Route path="find" element={<CustomerFindPage />} />
          <Route path="categories" element={<CustomerCategoriesPage />} />
          <Route path="find/:typeSlug" element={<CustomerProvidersByTypePage />} />
          <Route path="provider/:providerKey" element={<CustomerProviderRoutes />}>
            <Route index element={<BookingStorefrontPage />} />
            <Route path="services/:serviceId" element={<CustomerServiceDetailPage />} />
            <Route path="checkout" element={<CustomerBookMultipleServicesPage />} />
            <Route path=":serviceId" element={<CustomerBookServicePage />} />
          </Route>
        </Route>
        <Route path="/customer/provider/:orgSlug" element={<RedirectToBookProvider />} />
        <Route path="/customer/book/:orgSlug/:serviceId" element={<RedirectToBookService />} />
        <Route path="/services" element={<ServicesBrowseWrapper />} />
        <Route path="/services/:typeSlug" element={<ServicesTypePage />} />
        <Route path="/book/:slug/checkout" element={<BookMultipleGateway />} />
        <Route path="/book/:orgSlug/:serviceId" element={<BookServiceGateway />} />
        <Route path="/book/:slug" element={<BookRouteLayout />}>
          <Route path="services/:serviceId" element={<CustomerServiceDetailPage />} />
          <Route path="services" element={<PublicProviderServicesPage />} />
          <Route index element={<BookingStorefrontPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    bootstrapNativeApp();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <InAppNavTracker />
        <AppBackHandler />
        <ToastProvider>
          <ApiHealthProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </ApiHealthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
