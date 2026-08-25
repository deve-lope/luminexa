import React, { useEffect, useMemo, useRef, useState } from 'react';
import BusinessTypeIcon from '../icons/BusinessTypeIcon';

/**
 * Accessible category picker with a scrollable options list (for long catalogs).
 */
export default function CategorySelect({
  id = 'category-select',
  label = 'Category',
  required = false,
  value,
  options = [],
  onChange,
  placeholder = 'Select a category',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.name === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <button
        id={id}
        type="button"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent disabled:opacity-60"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? (
            <>
              <BusinessTypeIcon
                slug={selected.slug}
                name={selected.name}
                className="mr-1.5 inline-block h-4 w-4 align-[-2px] text-teal-700"
              />
              {selected.name}
            </>
          ) : options.length === 0 ? (
            'No categories available'
          ) : (
            placeholder
          )}
        </span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && options.length > 0 && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((opt) => {
            const isSelected = opt.name === value;
            return (
              <li key={opt.id || opt.name} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-teal-50 ${
                    isSelected ? 'bg-teal-50 font-semibold text-teal-900' : 'text-slate-800'
                  }`}
                  onClick={() => {
                    onChange?.(opt.name);
                    setOpen(false);
                  }}
                >
                  <BusinessTypeIcon
                    slug={opt.slug}
                    name={opt.name}
                    className="h-4 w-4 shrink-0 text-teal-700"
                  />
                  <span>{opt.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Merge catalog categories + business types into unique options (name-keyed). */
export function buildCategoryOptions(categories = [], businessTypes = []) {
  const seen = new Set();
  const out = [];
  const push = (id, name, slug) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: id != null ? String(id) : trimmed,
      name: trimmed,
      slug: slug || '',
    });
  };
  (categories || []).forEach((c) => push(c.id, c.name, c.slug));
  (businessTypes || []).forEach((t) => push(t.slug || t.id, t.name, t.slug));
  return out;
}

export function useMergedCategoryOptions(categories, businessTypes, fallbackLoader) {
  const [fallback, setFallback] = useState([]);
  const base = useMemo(
    () => buildCategoryOptions(categories, businessTypes),
    [categories, businessTypes],
  );

  useEffect(() => {
    if (base.length > 0 || !fallbackLoader) return undefined;
    let cancelled = false;
    fallbackLoader()
      .then((list) => {
        if (!cancelled) setFallback(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setFallback([]);
      });
    return () => {
      cancelled = true;
    };
  }, [base.length, fallbackLoader]);

  return useMemo(
    () => (base.length > 0 ? base : buildCategoryOptions(fallback, [])),
    [base, fallback],
  );
}
