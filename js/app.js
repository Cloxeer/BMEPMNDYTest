/**
 * @file js/app.js
 * @summary The app's ON switch. Starts Framework7 (the UI) and the map,
 *          and shows the welcome screen on a visitor's first arrival.
 *
 * WHAT IT DOES : (1) boots Framework7 in its iOS theme,
 *                (2) builds the MapLibre map,
 *                (3) shows the welcome popup only on the first visit this
 *                    browser session (remembered in sessionStorage).
 * DEPENDS ON   : Framework7 (global `Framework7`), ./map.js, index.html markup.
 * CONTROLS     : app start-up order and the first-visit welcome flow.
 * USED BY      : index.html (loaded as the page's module).
 */

import { initMap } from './map.js';

// Key we store so a returning visitor skips the welcome screen this session.
const VISITED_KEY = 'bnm_visited';

/**
 * Boot Framework7 (draws the navbar, panel, popups, searchbar in iOS style).
 * @returns {Framework7} the running app instance
 */
function startUI() {
  return new Framework7({
    el: '#app',
    name: 'Better NMSU Maps',
    theme: 'ios', // force the Apple-like look on every device
  });
}

/**
 * Show the welcome popup only if this is the first visit this session.
 * Reading/writing sessionStorage is wrapped in try/catch because some
 * browsers (private mode) throw when you touch it.
 * @param {Framework7} app - the running Framework7 instance
 */
function runWelcomeFlow(app) {
  let seen = false;
  try {
    seen = sessionStorage.getItem(VISITED_KEY) === '1';
  } catch (e) {
    seen = false; // if storage is blocked, just show the welcome
  }

  if (!seen) app.popup.open('#welcome-popup');

  // When they tap "Enter Map", remember it so it won't show again this session.
  document.querySelector('#enter-map').addEventListener('click', () => {
    try {
      sessionStorage.setItem(VISITED_KEY, '1');
    } catch (e) {
      /* ignore — not being able to save is harmless */
    }
  });
}

/**
 * Wire the placeholder "Report an issue" button so it isn't a dead button yet.
 * @param {Framework7} app - the running Framework7 instance
 */
function wirePlaceholders(app) {
  document.querySelector('#report-btn').addEventListener('click', (e) => {
    e.preventDefault();
    app.dialog.alert('Issue reporting arrives with the building dataset.', 'Coming soon');
  });
}

// ---- start everything ----
const app = startUI();
const map = initMap();
runWelcomeFlow(app);
wirePlaceholders(app);

// Handy for debugging in the browser console.
window.app = app;
window.map = map;
