/**
 * @file js/settings.js
 * @summary The switches on the Settings page.
 *
 * WHAT IT DOES : "Building names" shows or hides the names above the info
 *                badges on the map (Map settings has the same switch; both follow
 *                the store). The choice is remembered on this device;
 *                until someone changes it, config.yml (map.buildingNames)
 *                decides.
 * DEPENDS ON   : ./config.js, ./store.js, ./map.js (setBuildingNames), the
 *                #setting-building-names toggle in index.html.
 * CONTROLS     : the Settings page switches.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { setBuildingNames } from './map.js';

/**
 * Read a remembered on/off choice.
 * @param {string} key - localStorage key
 * @param {boolean} fallback - used when nothing is saved (or storage is blocked)
 * @returns {boolean}
 */
function readChoice(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : saved === 'on';
  } catch (error) {
    return fallback; // private browsing can block storage
  }
}

/**
 * Remember an on/off choice.
 * @param {string} key
 * @param {boolean} on
 */
function saveChoice(key, on) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch (error) {
    // Not being able to remember is harmless: it still applies for this visit.
  }
}

/** Wire the Settings page switches. */
export function initSettings() {
  const key = CONFIG.settings.buildingNamesKey;
  const toggle = document.querySelector('#setting-building-names');

  // Start with this device's saved choice (or config.yml's default).
  store.setShowNames(readChoice(key, CONFIG.map.buildingNames));
  toggle.addEventListener('change', () => store.setShowNames(toggle.checked));

  // The choice can also change from Map settings, so follow the store.
  let shown = null;
  store.subscribe((state) => {
    toggle.checked = state.showNames;
    if (state.showNames === shown) return;
    shown = state.showNames;
    setBuildingNames(shown);
    saveChoice(key, shown);
  });
}
