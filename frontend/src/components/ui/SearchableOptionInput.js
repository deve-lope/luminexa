import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const defaultInputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';

/**
 * Type-to-search picker for a flat list of string options (cities, postal codes, etc.).
 */
export default function SearchableOptionInput({
  id: idProp,
  value = '',
  onChange,
  options = [],
  placeholder = 'Type to search…',
  disabled = false,
  className = '',
  inputClassName,
}) {
  const inputCls = inputClassName || defaultInputClass;
  const autoId = useId();
  const inputId = idProp || autoId;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = options.filter(Boolean);
    if (!q) return list;
    return list.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, value]);

  useEffect(() => {
    setHighlight(0);
  }, [value, filtered.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const selectOption = (opt) => {
    onChange(opt);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open || !filtered.length) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && filtered.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={inputId}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={inputCls}
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt, idx) => {
            const active = idx === highlight;
            return (
              <li key={opt} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-2 text-left text-sm ${
                    active ? 'bg-violet-50 text-luminexa-accent' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlight(idx)}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && !disabled && options.length > 0 && filtered.length === 0 && value.trim() && (
        <p className="absolute z-40 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          No match in this area — pick from the list or keep typing
        </p>
      )}
    </div>
  );
}
