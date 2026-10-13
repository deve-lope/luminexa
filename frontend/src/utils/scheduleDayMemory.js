/** Remember the last schedule day so Back can restore it even if the URL lost ?day=. */

const PREFIX = 'luminexa.scheduleSelectedDay.';

function storageKey(orgSlug) {
  return `${PREFIX}${orgSlug || ''}`;
}

export function isScheduleDayKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function rememberScheduleDay(orgSlug, day) {
  if (!orgSlug || !isScheduleDayKey(day)) return;
  try {
    sessionStorage.setItem(storageKey(orgSlug), day);
  } catch {
    /* private mode / quota */
  }
}

export function readRememberedScheduleDay(orgSlug) {
  if (!orgSlug) return null;
  try {
    const day = sessionStorage.getItem(storageKey(orgSlug));
    return isScheduleDayKey(day) ? day : null;
  } catch {
    return null;
  }
}

/**
 * If `path` is a provider schedule list URL missing ?day=, append the remembered day.
 * Leaves detail URLs and unrelated paths unchanged.
 */
export function withRememberedScheduleDay(path, orgSlug) {
  if (!path || !orgSlug) return path;
  const [pathAndQuery, hash = ''] = String(path).split('#');
  const qIndex = pathAndQuery.indexOf('?');
  const pathname = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex);
  const search = qIndex === -1 ? '' : pathAndQuery.slice(qIndex + 1);
  const base = `/provider/${orgSlug}/schedule`;
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized !== base) return path;

  const params = new URLSearchParams(search);
  if (isScheduleDayKey(params.get('day'))) return path;

  const remembered = readRememberedScheduleDay(orgSlug);
  if (!remembered) return path;
  params.set('day', remembered);
  const qs = params.toString();
  return `${pathname}?${qs}${hash ? `#${hash}` : ''}`;
}
