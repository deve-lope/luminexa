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
      <label htmlFor="gig-category" className="mb-1 block text-sm font-medium text-slate-700">
        Category
      </label>
      <select
        id="gig-category"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.slug || cat.id} value={cat.slug}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
