import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { locationEntry, recordInAppLocation } from '../utils/inAppNavStack';

/** Records in-app screens so the header Back button can return to the previous one. */
export default function InAppNavTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    recordInAppLocation(locationEntry(location), navigationType);
  }, [location, navigationType]);

  return null;
}
