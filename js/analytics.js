// Thin wrapper around GoatCounter's `count.js`.
//
// GoatCounter auto-tracks the initial pageview. This module only handles
// custom events (case started, verdict called, bad end, etc). Events are
// suppressed on localhost / file:// / preview hostnames so dev runs do not
// pollute production stats. The real script tag lives in `index.html`.

const LOCAL_HOSTS = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|.*\.local)$/i;

function isLocalEnvironment() {
  if (typeof window === 'undefined') return true;
  const { protocol, hostname } = window.location;
  if (protocol === 'file:') return true;
  if (!hostname) return true;
  return LOCAL_HOSTS.test(hostname);
}

const DISABLED = isLocalEnvironment();

function getGoatcounter() {
  if (typeof window === 'undefined') return null;
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return null;
  return gc;
}

function sanitizeSegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// GoatCounter treats events as a single string (the `path`). We flatten
// `{ name, props }` into a slash-separated path so it groups cleanly on the
// dashboard: e.g. `game/verdict/guilty/correct/case-pharmacist`.
function buildPath(name, props) {
  const segments = [sanitizeSegment(name)].filter(Boolean);
  if (props && typeof props === 'object') {
    for (const value of Object.values(props)) {
      const seg = sanitizeSegment(value);
      if (seg) segments.push(seg);
    }
  }
  return segments.join('/') || 'event';
}

/**
 * Fire a custom event to GoatCounter.
 *
 * @param {string} name  Short event key, e.g. 'case-started', 'verdict'.
 * @param {Record<string, string | number | boolean>} [props]
 *   Optional extra dimensions that get appended to the event path.
 */
export function trackEvent(name, props) {
  if (DISABLED) {
    console.log('[analytics] skipped (local):', name, props || {});
    return;
  }
  const gc = getGoatcounter();
  if (!gc) {
    console.log('[analytics] skipped (no goatcounter):', name, props || {});
    return;
  }
  const path = buildPath(name, props);
  try {
    gc.count({ path, title: name, event: true });
    console.log('[analytics] sent:', path);
  } catch (err) {
    console.warn('[analytics] failed:', name, err);
  }
}

/**
 * Fire a manual pageview. Use this for scene-level "screens" we want to
 * appear in GoatCounter's Pages stats (e.g. title, menu). The auto-onload
 * pageview is disabled in `index.html` so this is the only path that counts.
 *
 * @param {string} path   A URL-like identifier, e.g. '/title', '/menu'.
 * @param {string} [title] Optional friendly title for the dashboard.
 */
export function trackPageview(path, title) {
  if (DISABLED) {
    console.log('[analytics] skipped pageview (local):', path);
    return;
  }
  const gc = getGoatcounter();
  if (!gc) {
    console.log('[analytics] skipped pageview (no goatcounter):', path);
    return;
  }
  try {
    gc.count({ path, title: title || path });
    console.log('[analytics] pageview:', path);
  } catch (err) {
    console.warn('[analytics] pageview failed:', path, err);
  }
}

export function isAnalyticsEnabled() {
  return !DISABLED;
}
