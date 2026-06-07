import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterRegionGroups } from '../../constants/regions';

const defaultInputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';

/**
 * Type-to-search province / state field with full CA + US lists.
 */
export default function SearchableRegionInput({
  id: idProp,
  value = '',
  onChange,
  placeholder = 'Type to search…',
  extraOptions = [],
  className = '',
  inputClassName,
  disabled = false,
}) {
  const inputCls = inputClassName || defaultInputClass;
  const autoId = useId();
  const inputId = idProp || autoId;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const groups = useMemo(
    () => filterRegionGroups(value, extraOptions),
    [value, extraOptions]
  );

  const flatOptions = useMemo(
    () => groups.flatMap((g) => g.options),
    [groups]
  );

  useEffect(() => {
    setHighlight(0);
  }, [value, groups.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const selectOption = (opt) => {
    onChange(opt.label);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open || !flatOptions.length) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1) % flatOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectOption(flatOptions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  let optionIndex = -1;
  const showList = open && flatOptions.length > 0;

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
          {groups.map((group) => (
            <li key={group.title} role="presentation">
              <p className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </p>
              <ul>
                {group.options.map((opt) => {
                  optionIndex += 1;
                  const idx = optionIndex;
                  const active = idx === highlight;
                  return (
                    <li key={`${group.title}-${opt.label}`} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                          active ? 'bg-violet-50 text-luminexa-accent' : 'text-slate-800 hover:bg-slate-50'
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectOption(opt)}
                        onMouseEnter={() => setHighlight(idx)}
                      >
                        <span>{opt.label}</span>
                        {opt.code ? (
                          <span className="shrink-0 text-xs text-slate-400">{opt.code}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {open && value.trim() && flatOptions.length === 0 && (
        <p className="absolute z-40 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          No match — keep typing or use the name shown on mail
        </p>
      )}
    </div>
  );
}
