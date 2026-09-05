import React from 'react';
import { Navigate } from 'react-router-dom';
import { customerBookings } from '../../utils/customerPaths';

/** Legacy route — redirects to Upcoming. */
export default function CustomerHistoryPage() {
  return <Navigate to={customerBookings()} replace />;
}
