/** In-app path stack so Back returns to the previous screen, not marketing/home. */

const STORAGE_KEY = 'luminexa.inAppNavStack';
const MAX_ENTRIES = 40;

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'string') return '';
  const [pathAndQuery] = entry.split('#');
  const trimmed = pathAndQuery.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '';
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    const q = trimmed.indexOf('?');
    if (q === -1) return trimmed.replace(/\/$/, '') || '/';
    return `${trimmed.slice(0, q).replace(/\/$/, '')}${trimmed.slice(q)}`;
  }
  return trimmed;
}

export function locationEntry(location) {
  if (!location) return '';
  return normalizeEntry(`${location.pathname || ''}${location.search || ''}`);
}

function readStack() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

function writeStack(stack) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_ENTRIES)));
  } catch {
    /* private mode / quota */
  }
}

/** Landing `/` redirects signed-in users to a dashboard — never treat it as Back. */
export function isUsefulBackPath(path, currentEntry = '') {
  const entry = normalizeEntry(path);
  const current = normalizeEntry(currentEntry);
  if (!entry || entry === current) return false;
  if (entry === '/') return false;
  return true;
}

export function recordInAppLocation(entry, navigationType) {
  const next = normalizeEntry(entry);
  if (!next) return;
  let stack = readStack();

  if (navigationType === 'POP') {
    const idx = stack.lastIndexOf(next);
    if (idx >= 0) stack = stack.slice(0, idx + 1);
    else if (stack[stack.length - 1] !== next) stack = [...stack, next];
  } else if (navigationType === 'REPLACE') {
    stack = stack.length ? [...stack.slice(0, -1), next] : [next];
  } else if (stack[stack.length - 1] !== next) {
    stack = [...stack, next];
  }

  writeStack(stack);
}

export function consumePreviousInAppPath(currentEntry) {
  const current = normalizeEntry(currentEntry);
  let stack = readStack();
  if (stack[stack.length - 1] === current) {
    stack = stack.slice(0, -1);
  }
  while (stack.length && !isUsefulBackPath(stack[stack.length - 1], current)) {
    stack = stack.slice(0, -1);
  }
  const prev = stack[stack.length - 1] || null;
  if (!prev) return null;
  writeStack(stack);
  return prev;
}
