/**
 * @file js/settings.js
 * @summary The switches on the Settings page.
 *
 * WHAT IT DOES : "Building names" shows or hides the names above the info
 *                badges on the map. The choice is remembered on this device;
 *                until someone changes it, config.yml (map.buildingNames)
 *                decides.
 * DEPENDS ON   : ./config.js, ./map.js (setBuildingNames), the
 *                #setting-building-names toggle in index.html.
 * CONTROLS     : the Settings page switches.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
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

  toggle.checked = readChoice(key, CONFIG.map.buildingNames);
  setBuildingNames(toggle.checked);

  toggle.addEventListener('change', () => {
    saveChoice(key, toggle.checked);
    setBuildingNames(toggle.checked);
  });
}
