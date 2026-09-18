/**
 * @file js/pages/welcome.js
 * @summary Takes the boot screen away once the app is ready.
 *
 * WHAT IT DOES : The welcome ("boot") screen is plain HTML at the top of index.html, so it
 *                paints the instant the page arrives, long before the libraries have loaded.
 *                Its own little script handles "Enter Map". This file is called when the app
 *                has started: if the visitor already tapped "Enter Map" (or was welcomed
 *                earlier in this tab), the screen fades away; otherwise it waits for the tap.
 *                Once gone, it is removed, so it costs nothing afterwards.
 * DEPENDS ON   : #boot in index.html (and its script).
 * CONTROLS     : #boot.
 * USED BY      : js/main.js
 */

/**
 * Wait until every stylesheet in index.html has arrived. They load without holding up the
 * first paint, so the app waits for them here before Framework7 lays anything out.
 * @returns {Promise<void>}
 */
export function stylesReady() {
  const waits = [];
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    if (link.media !== 'all') {
      // Still on its way ("print"): its onload switches it on. A failed one must not stop the app.
      waits.push(new Promise((done) => {
        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
      }));
    }
  }
  // Then the rest of the page may be laid out (it was hidden while booting, see index.html).
  return Promise.all(waits).then(() => document.body.classList.remove('booting'));
}

/** The app is ready: let "Enter Map" open it at once, and fade the screen away if it was already tapped. */
export function appIsReady() {
  window.appIsReady = true;
  const boot = document.querySelector('#boot');
  const waiting = boot.classList.contains('is-leaving') || boot.classList.contains('is-splash');
  if (waiting) {
    boot.classList.add('is-gone');
  }
  // Once it has faded (now or after "Enter Map"), take it out of the page.
  boot.addEventListener('transitionend', () => boot.remove(), { once: true });
}
