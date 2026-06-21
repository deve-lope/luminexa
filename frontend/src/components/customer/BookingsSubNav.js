import React from 'react';
import { NavLink } from 'react-router-dom';
import { customerBookings, customerHistory } from '../../utils/customerPaths';

const TABS = [
  { to: customerBookings(), label: 'Upcoming', end: true },
  { to: customerHistory(), label: 'History', end: true },
];

export default function BookingsSubNav() {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `min-h-[40px] rounded-lg px-4 text-sm font-medium transition flex items-center ${
              isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
