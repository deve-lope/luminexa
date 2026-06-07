import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/** Redirect legacy /customer/... book URLs to /book/... with real slug params. */
export function RedirectToBookProvider() {
  const { orgSlug } = useParams();
  return <Navigate to={`/book/${orgSlug}`} replace />;
}

export function RedirectToBookService() {
  const { orgSlug, serviceId } = useParams();
  return <Navigate to={`/book/${orgSlug}/${serviceId}`} replace />;
}
