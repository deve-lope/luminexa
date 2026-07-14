import React, { useEffect, useRef, useState } from 'react';

/**
 * Collapses long text with Show more / Show less.
 * Uses line-clamp when collapsed; measures overflow when text exceeds maxChars.
 */
export default function ExpandableText({
  text,
  className = 'text-sm text-slate-600',
  clampClass = 'line-clamp-2',
  maxChars = 120,
  showLess = true,
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef(null);

  const trimmed = (text || '').trim();
  const longByChars = trimmed.length > maxChars || trimmed.split('\n').length > 2;

  useEffect(() => {
    if (!trimmed) {
      setOverflows(false);
      return undefined;
    }
    if (expanded) {
      setOverflows(longByChars);
      return undefined;
    }
    const el = textRef.current;
    if (!el) return undefined;
    const check = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 1 || longByChars);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [trimmed, expanded, longByChars]);

  if (!trimmed) return null;

  const canToggle = overflows || longByChars;

  if (!canToggle) {
    return <p className={`${className} whitespace-pre-wrap`}>{trimmed}</p>;
  }

  return (
    <div>
      <p
        ref={textRef}
        className={`${className} whitespace-pre-wrap ${expanded ? '' : clampClass}`}
      >
        {trimmed}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-xs font-medium text-luminexa-accent hover:underline"
      >
        {expanded && showLess ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
