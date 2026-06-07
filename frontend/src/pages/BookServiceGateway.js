import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import CustomerLayout from '../layouts/CustomerLayout';
import CustomerBookServicePage from './customer/CustomerBookServicePage';
import { useAuth } from '../contexts/AuthContext';

export default function BookServiceGateway() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <CustomerLayout>
      <CustomerBookServicePage />
    </CustomerLayout>
  );
}
