import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { providerSettings } from '../../utils/providerPaths';

const MODE_LABEL = {
  recurring: 'Weekly schedule',
  flexi: 'Flexi (manual slots)',
};

export default function SchedulingModeBanner({ orgSlug }) {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    if (!orgSlug) return;
    jobsAPI
      .getBookingContext(orgSlug)
      .then((res) => setMode(res.data?.scheduling_mode || 'flexi'))
      .catch(() => setMode('flexi'));
  }, [orgSlug]);

  if (!mode) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <span className="text-slate-600">
        Availability: <span className="font-medium text-slate-900">{MODE_LABEL[mode] || mode}</span>
      </span>
      <Link to={providerSettings(orgSlug)} className="font-medium text-luminexa-accent">
        Change in settings →
      </Link>
    </div>
  );
}
