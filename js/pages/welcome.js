/**
 * @file js/pages/welcome.js
 * @summary The welcome screen, shown once each time the browser tab is opened.
 *
 * WHAT IT DOES : Opens the welcome popup unless it was already seen in this tab.
 *                "Enter Map" closes it and remembers that it was seen.
 * DEPENDS ON   : Framework7 (popup), ../core/config.js, ../core/storage.js,
 *                #welcome-popup in index.html.
 * CONTROLS     : #welcome-popup.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { readForThisVisit, saveForThisVisit } from '../core/storage.js';

/**
 * Show the welcome screen on the first visit of each browser session.
 * @param {Framework7} app
 */
export function showWelcome(app) {
  const key = CONFIG.welcome.storageKey;
  const seen = readForThisVisit(key) === '1';
  if (!seen) {
    app.popup.open('#welcome-popup');
  }

  // "Enter Map" closes the popup by itself (it has Framework7's popup-close class).
  document.querySelector('#enter-map').addEventListener('click', () => saveForThisVisit(key, '1'));
}
