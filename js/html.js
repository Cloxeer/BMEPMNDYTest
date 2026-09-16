/**
 * @file js/html.js
 * @summary Two small helpers for putting data into HTML safely.
 *
 * WHAT IT DOES : escapeHtml() makes text safe to put inside HTML, and safeUrl()
 *                only lets web links through. Use them whenever data from
 *                data/*.geojson goes into innerHTML, so a stray "<" or a bad
 *                link in a data file can never break the page or run code.
 * DEPENDS ON   : nothing.
 * USED BY      : js/buildingSheet.js, js/locations.js, js/search.js
 */

/**
 * Make text safe to put in HTML, including inside quoted attributes.
 * @param {string|number} text
 * @returns {string} e.g. 'A & B "C"' -> 'A &amp; B &quot;C&quot;'
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only allow normal https links; anything else (e.g. "javascript:...") becomes "#".
 * @param {string} url
 * @returns {string} a URL that is safe to put in href, already escaped
 */
export function safeUrl(url) {
  return /^https:\/\//.test(url) ? escapeHtml(url) : '#';
}
