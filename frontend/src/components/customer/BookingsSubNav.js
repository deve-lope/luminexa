import React from 'react';
import { NavLink } from 'react-router-dom';
import { customerBookings, customerCompleted, customerQuotes } from '../../utils/customerPaths';

const TABS = [
  { to: customerBookings(), label: 'Coming up', end: true },
  { to: customerQuotes(), label: 'Quotes', end: true },
  { to: customerCompleted(), label: 'Done', end: true },
];

export default function BookingsSubNav() {
  return (
    <nav aria-label="Your bookings" className="rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60">
      <div className="grid grid-cols-3 gap-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center justify-center rounded-xl px-2 text-center text-sm transition ${
                isActive
                  ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                  : 'font-medium text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
