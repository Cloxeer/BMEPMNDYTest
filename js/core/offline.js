/**
 * @file js/core/offline.js
 * @summary Turns on the service worker (sw.js), which keeps the app on the phone for fast, offline opens.
 *
 * WHAT IT DOES : Registers sw.js once the app has started, so it never slows down the
 *                first screen. Browsers without service workers (or pages not on https or
 *                localhost) simply skip it: the app works the same, just over the network.
 * DEPENDS ON   : sw.js
 * USED BY      : js/main.js
 */

/** Register the service worker, after everything else has started. */
export function keepAppOnPhone() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.warn('Could not turn on offline support:', error); // the app still works without it
  });
}
