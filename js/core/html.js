/**
 * @file js/core/html.js
 * @summary Two helpers for putting data into HTML safely.
 *
 * WHAT IT DOES : escapeHtml() makes text safe to put inside HTML, and safeUrl()
 *                only lets normal web links through. Use them whenever data from
 *                a data file goes into innerHTML, so a stray "<" or a bad link
 *                in a data file can never break the page or run code.
 * DEPENDS ON   : nothing.
 * USED BY      : every file that builds HTML from data.
 */

/**
 * Make text safe to put in HTML, including inside quoted attributes.
 * @param {string|number} text
 * @returns {string} e.g. 'A & B "C"' -> 'A &amp; B &quot;C&quot;'
 */
export function escapeHtml(text) {
  let safe = String(text);
  safe = safe.replace(/&/g, '&amp;'); // first, so the & in the others isn't changed again
  safe = safe.replace(/</g, '&lt;');
  safe = safe.replace(/>/g, '&gt;');
  safe = safe.replace(/"/g, '&quot;');
  safe = safe.replace(/'/g, '&#39;');
  return safe;
}

/**
 * Only allow https links; anything else (e.g. "javascript:...") becomes "#".
 * @param {string} url
 * @returns {string} a link that is safe to put in href, already escaped
 */
export function safeUrl(url) {
  if (String(url).startsWith('https://')) { // String(): a missing link (undefined) is simply not allowed
    return escapeHtml(url);
  }
  return '#';
}
