import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RegisterBusinessPage from './pages/RegisterBusinessPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CustomerBookingsPage from './pages/customer/CustomerBookingsPage';
import CustomerHistoryPage from './pages/customer/CustomerHistoryPage';
import CustomerAccountPage from './pages/customer/CustomerAccountPage';
import CustomerProviderRoutes from './layouts/CustomerProviderRoutes';
import CustomerBookServicePage from './pages/customer/CustomerBookServicePage';
import AcceptStaffInvitePage from './pages/AcceptStaffInvitePage';
import BookRouteLayout from './layouts/BookRouteLayout';
import BookingStorefrontPage from './pages/BookingStorefrontPage';
import ServicesBrowseWrapper from './pages/ServicesBrowseWrapper';
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
import ProviderNotificationsPage from './pages/provider/ProviderNotificationsPage';
import ProviderAddTaskPage from './pages/provider/ProviderAddTaskPage';
import ProviderTasksPage from './pages/provider/ProviderTasksPage';
import CustomerHomePage from './pages/customer/CustomerHomePage';
import CustomerFindPage from './pages/customer/CustomerFindPage';
import CustomerProvidersByTypePage from './pages/customer/CustomerProvidersByTypePage';
import BookServiceGateway from './pages/BookServiceGateway';
import {
  RedirectToBookProvider,
  RedirectToBookService,
} from './components/booking/BookRedirect';
import ProviderLegacyRedirect from './components/provider/ProviderLegacyRedirect';
import PwaInstallPrompt from './components/PwaInstallPrompt';

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
  const location = useLocation();
  const isAuthShell =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/register/business' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password';

  return (
    <div className={isAuthShell ? 'min-h-screen bg-luminexa-navy' : 'min-h-screen bg-slate-50'}>
      <PwaInstallPrompt />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/business" element={<RegisterBusinessPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-staff-invite" element={<AcceptStaffInvitePage />} />
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
          <Route path="notifications" element={<ProviderNotificationsPage />} />
          <Route path="settings" element={<ProviderSettingsPage />} />
          <Route path="account" element={<CustomerAccountPage variant="provider" />} />
          <Route path="my-page" element={<ProviderSharePage />} />
          <Route path="share" element={<Navigate to="my-page" replace />} />
          <Route path="services" element={<ProviderServicesPage />} />
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
          <Route path="history" element={<CustomerHistoryPage />} />
          <Route path="account" element={<CustomerAccountPage />} />
          <Route path="find" element={<CustomerFindPage />} />
          <Route path="find/:typeSlug" element={<CustomerProvidersByTypePage />} />
          <Route path="provider/:providerKey" element={<CustomerProviderRoutes />}>
            <Route index element={<BookingStorefrontPage />} />
            <Route path="services/:serviceId" element={<CustomerServiceDetailPage />} />
            <Route path=":serviceId" element={<CustomerBookServicePage />} />
          </Route>
        </Route>
        <Route path="/customer/provider/:orgSlug" element={<RedirectToBookProvider />} />
        <Route path="/customer/book/:orgSlug/:serviceId" element={<RedirectToBookService />} />
        <Route path="/services" element={<ServicesBrowseWrapper />} />
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
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
