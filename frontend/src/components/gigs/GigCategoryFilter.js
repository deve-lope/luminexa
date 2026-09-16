import React, { useEffect, useState } from 'react';
import { businessesAPI } from '../../utils/api';

export default function GigCategoryFilter({ value, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    businessesAPI
      .listBusinessTypes()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCategories(list.filter((c) => c.is_active !== false));
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Category
      </p>
      <div
        className="gig-chip-rail"
        role="listbox"
        aria-label="Filter by category"
        aria-busy={loading || undefined}
      >
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => onChange(null)}
          className={`gig-chip${!value ? ' gig-chip--active' : ''}`}
        >
          All
        </button>
        {categories.map((cat) => {
          const slug = cat.slug || String(cat.id);
          const active = value === slug;
          return (
            <button
              key={slug}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(slug)}
              className={`gig-chip${active ? ' gig-chip--active' : ''}`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
