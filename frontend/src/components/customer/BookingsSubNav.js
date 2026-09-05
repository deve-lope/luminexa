import React from 'react';
import { NavLink } from 'react-router-dom';
import { customerBookings, customerCompleted, customerQuotes } from '../../utils/customerPaths';

const TABS = [
  { to: customerBookings(), label: 'Upcoming', end: true },
  { to: customerQuotes(), label: 'Quotes', end: true },
  { to: customerCompleted(), label: 'Completed', end: true },
];

export default function BookingsSubNav() {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full rounded-xl bg-slate-100 p-1 sm:min-w-0">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition sm:flex-none sm:px-5 ${
                  isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
