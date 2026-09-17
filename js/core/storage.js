/**
 * @file js/core/storage.js
 * @summary Remembering things on this device (the browser's localStorage and sessionStorage).
 *
 * WHAT IT DOES : Small safe wrappers. Some browsers (e.g. private browsing)
 *                block storage and throw an error; these functions catch it,
 *                so the app keeps working and simply doesn't remember.
 *                  - localStorage   : kept until it's cleared (Settings > Reset).
 *                  - sessionStorage : kept until the browser tab is closed.
 * DEPENDS ON   : nothing.
 * USED BY      : js/pages/settings.js, js/pages/search.js, js/pages/welcome.js,
 *                js/bottomBar/mapFiltersButton.js
 */

/**
 * Read a remembered value.
 * @param {string} key
 * @returns {string|null} null when nothing is saved, or storage is blocked
 */
export function readSaved(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

/**
 * Remember a value on this device.
 * @param {string} key
 * @param {string} value
 */
export function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Not being able to remember is harmless: the choice still works for this visit.
  }
}

/**
 * Forget a remembered value.
 * @param {string} key
 */
export function forget(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Nothing could be saved, so there's nothing to forget.
  }
}

/**
 * Forget every remembered value whose key starts with `prefix` (Settings > Reset).
 * @param {string} prefix - e.g. "bnm_"
 */
export function forgetAllStartingWith(prefix) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    // Storage is blocked: nothing was saved anyway.
  }
}

/**
 * Read a value remembered only until the tab is closed.
 * @param {string} key
 * @returns {string|null}
 */
export function readForThisVisit(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

/**
 * Remember a value until the tab is closed.
 * @param {string} key
 * @param {string} value
 */
export function saveForThisVisit(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    // Not being able to remember is harmless.
  }
}
