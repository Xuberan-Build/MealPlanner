// src/utils/safeRedirect.js
//
// The ?redirect= value on login/registration links comes from the URL, so anyone can set it.
// Only paths inside this app are followed; anything else falls back to the home page.

/**
 * @param {string|null|undefined} value - Raw redirect value from the URL
 * @returns {string|null} A same-app path such as "/recipe-book?x=1", or null
 */
export function safeRedirectPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
  if (/[\u0000-\u001f\\]/.test(path)) return null;
  try {
    const base = 'https://app.invalid';
    const url = new URL(path, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    return null;
  }
}
