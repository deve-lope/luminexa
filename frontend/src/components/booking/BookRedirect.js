import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { customerProviderPage } from '../../utils/customerPaths';

/** Redirect legacy /customer/provider/... to canonical customer provider URL. */
export function RedirectToBookProvider() {
  const { orgSlug, providerKey } = useParams();
  const key = providerKey || orgSlug;
  return <Navigate to={customerProviderPage(key)} replace />;
}

export function RedirectToBookService() {
  const { orgSlug, serviceId } = useParams();
  return <Navigate to={`/book/${orgSlug}/${serviceId}`} replace />;
}
