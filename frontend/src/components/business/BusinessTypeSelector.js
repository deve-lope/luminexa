import React, { useEffect, useRef, useState } from 'react';
import { businessesAPI } from '../../utils/api';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not save.';
}

function normalizeType(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slug = raw.slug;
  const name = raw.name;
  if (!slug || !name) return null;
  return {
    slug: String(slug),
    name: String(name),
    icon: raw.icon || '',
    description: raw.description || '',
  };
}

/**
 * Checkbox list of business types with inline "add new" for registration/settings.
 * Uses div + type="button" only (no nested forms).
 */
export default function BusinessTypeSelector({
  types,
  onTypesChange,
  selectedSlugs,
  onSelectionChange,
  legend = 'Business type (select one or more)',
  variant = 'dark',
}) {
  const listRef = useRef(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [justAddedSlug, setJustAddedSlug] = useState(null);

  const isDark = variant === 'dark';
  const boxClass = isDark
    ? 'max-h-44 space-y-2 overflow-y-auto rounded-lg border border-white/10 p-3'
    : 'max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3';
  const labelClass = isDark
    ? 'flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-white/5'
    : 'flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-slate-800 hover:bg-slate-100';
  const inputClass = isDark
    ? 'w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent'
    : 'w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-base';
  const addBtnClass = isDark
    ? 'text-sm font-medium text-luminexa-accent hover:underline'
    : 'text-sm font-medium text-luminexa-accent';

  useEffect(() => {
    if (!justAddedSlug) return undefined;
    const t = setTimeout(() => setJustAddedSlug(null), 2500);
    return () => clearTimeout(t);
  }, [justAddedSlug]);

  const toggle = (slug) => {
    onSelectionChange(
      selectedSlugs.includes(slug)
        ? selectedSlugs.filter((s) => s !== slug)
        : [...selectedSlugs, slug]
    );
  };

  const createType = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      setAddError('Enter a name (at least 2 characters).');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const res = await businessesAPI.createBusinessType({
        name,
        icon: newIcon.trim(),
      });
      const created = normalizeType(res.data);
      if (!created) {
        setAddError('Server response was invalid. Try again.');
        return;
      }

      const exists = types.some((t) => t.slug === created.slug);
      const nextTypes = exists
        ? types.map((t) => (t.slug === created.slug ? created : t))
        : [...types, created];
      onTypesChange(nextTypes);

      const nextSelected = selectedSlugs.includes(created.slug)
        ? selectedSlugs
        : [...selectedSlugs, created.slug];
      onSelectionChange(nextSelected);

      setJustAddedSlug(created.slug);
      setNewName('');
      setNewIcon('');
      setShowAdd(false);

      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    } catch (err) {
      setAddError(parseApiError(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <fieldset>
      <legend className={`mb-2 text-sm font-medium ${isDark ? '' : 'text-slate-700'}`}>
        {legend}
        {selectedSlugs.length > 0 && (
          <span className={`ml-2 font-normal ${isDark ? 'text-luminexa-mist/60' : 'text-slate-500'}`}>
            ({selectedSlugs.length} selected)
          </span>
        )}
      </legend>

      {justAddedSlug && (
        <p
          className={`mb-2 rounded-lg px-3 py-2 text-sm ${
            isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          Added &ldquo;{types.find((t) => t.slug === justAddedSlug)?.name}&rdquo; — selected
        </p>
      )}

      <div ref={listRef} className={boxClass}>
        {types.length === 0 && !showAdd && (
          <p className={`text-sm ${isDark ? 'text-luminexa-mist/60' : 'text-slate-500'}`}>
            No types yet — add one below.
          </p>
        )}
        {types.map((t) => {
          const selected = selectedSlugs.includes(t.slug);
          const highlight = t.slug === justAddedSlug;
          return (
            <label
              key={t.slug}
              className={`${labelClass} ${highlight ? (isDark ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'bg-emerald-50 ring-1 ring-emerald-300') : ''}`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(t.slug)}
                className="mt-1 h-4 w-4 shrink-0 accent-luminexa-accent"
              />
              <span>
                {t.icon && <span className="mr-1">{t.icon}</span>}
                {t.name}
                {highlight && (
                  <span className={`ml-1 text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    (new)
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {!showAdd ? (
        <button type="button" onClick={() => setShowAdd(true)} className={`mt-2 ${addBtnClass}`}>
          + Add new type
        </button>
      ) : (
        <div
          className={
            isDark
              ? 'mt-3 space-y-2 rounded-lg border border-white/10 bg-luminexa-navy/50 p-3'
              : 'mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3'
          }
        >
          <p className={`text-sm font-medium ${isDark ? 'text-luminexa-mist' : 'text-slate-800'}`}>
            New business type
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createType();
                }
              }}
              placeholder="e.g. Mobile car wash"
              className={inputClass}
              autoFocus
            />
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="Icon (optional emoji)"
              maxLength={4}
              className={inputClass}
            />
            {addError && (
              <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{addError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={adding}
                onClick={createType}
                className="min-h-[44px] flex-1 rounded-lg bg-luminexa-accent text-sm font-medium text-white disabled:opacity-60"
              >
                {adding ? 'Adding…' : 'Add & select'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                }}
                className={`min-h-[44px] rounded-lg px-4 text-sm ${
                  isDark ? 'text-luminexa-mist/70' : 'text-slate-600'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
