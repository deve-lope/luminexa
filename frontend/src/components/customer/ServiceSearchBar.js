import React from 'react';

export default function ServiceSearchBar({
  value,
  onChange,
  placeholder = 'What do you need?',
  sticky = true,
}) {
  return (
    <div
      className={
        sticky
          ? 'sticky top-0 z-10 -mx-1 bg-luminexa-canvas/80 pb-3 pt-1 backdrop-blur-md'
          : 'pb-3'
      }
    >
      <label htmlFor="service-search" className="sr-only">
        Search
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <input
          id="service-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="lx-input pl-11"
        />
      </div>
    </div>
  );
}
