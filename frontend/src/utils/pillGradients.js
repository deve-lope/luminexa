/**
 * Light theme pill tones — one accent family (teal), one direction.
 * First item in a row is the deep anchor; the rest are airy tints
 * with dark ink text so rows read light but never flat white.
 */
export const LX_PILL_RAMP = [
  { surface: 'bg-gradient-to-br from-teal-800 to-teal-600', onDark: true },
  { surface: 'bg-gradient-to-br from-teal-600 to-emerald-500', onDark: true },
  { surface: 'bg-gradient-to-br from-teal-100 to-emerald-50', onDark: false },
  { surface: 'bg-gradient-to-br from-sky-50 to-teal-50', onDark: false },
];

export function lxPillTone(index = 0, count = LX_PILL_RAMP.length) {
  const n = Math.max(1, count);
  const i = Math.abs(index) % n;
  const rampIndex =
    n <= 1 ? 0 : Math.round((i / (n - 1)) * (LX_PILL_RAMP.length - 1));
  const tone = LX_PILL_RAMP[rampIndex];

  if (tone.onDark) {
    return {
      ...tone,
      title: 'text-white',
      body: 'text-teal-50/85',
      meta: 'text-teal-100/70',
      ring: 'ring-white/15',
      chip: 'bg-white/15 text-white ring-1 ring-white/20',
      link: 'text-teal-50 hover:text-white',
      hoverRow: 'hover:bg-white/10',
      border: 'border-white/15',
      btn: 'border-white/25 bg-white/10 text-white hover:bg-white/20',
      statusOk: 'bg-emerald-300/25 text-emerald-50 ring-1 ring-emerald-200/30',
      statusWarn: 'bg-amber-300/25 text-amber-50 ring-1 ring-amber-200/30',
      statusNeutral: 'bg-white/15 text-white/85 ring-1 ring-white/20',
    };
  }
  return {
    ...tone,
    title: 'text-slate-900',
    body: 'text-slate-600',
    meta: 'text-slate-500',
    ring: 'ring-teal-100',
    chip: 'bg-teal-600 text-white',
    link: 'text-teal-700 hover:text-teal-900',
    hoverRow: 'hover:bg-teal-900/5',
    border: 'border-teal-100',
    btn: 'border-teal-200 bg-white/80 text-teal-800 hover:bg-white',
    statusOk: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    statusWarn: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    statusNeutral: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  };
}

/** @deprecated use lxPillTone */
export function lxPillGradient(index = 0, count) {
  return lxPillTone(index, count ?? LX_PILL_RAMP.length).surface;
}
