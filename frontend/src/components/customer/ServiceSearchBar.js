import React from 'react';

export default function ServiceSearchBar({ value, onChange, placeholder = 'What do you need?' }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 bg-slate-50/95 pb-3 pt-1 backdrop-blur">
      <label htmlFor="service-search" className="sr-only">
        Search
      </label>
      <input
        id="service-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
      />
    </div>
  );
}
