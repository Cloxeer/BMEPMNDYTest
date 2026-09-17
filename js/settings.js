/**
 * @file js/settings.js
 * @summary The Settings page, and every choice the app remembers on this device.
 *
 * WHAT IT DOES : Map: "Building names" on/off (Map settings has the same switch).
 *                Directions: travel by Walk / Bike / Drive, and units (ft/mi or m/km).
 *                Saved on this device: Reset clears everything the app remembers.
 *                Data: each data file the app loaded, its format, how many things
 *                are in it, and where it comes from.
 *                At the bottom: credit, and the website's version.
 *                All choices live in the store; this file restores them when the
 *                app starts and saves them whenever they change, from anywhere.
 * DEPENDS ON   : Framework7 (reset question), ./config.js, ./store.js, ./html.js,
 *                ./map.js (setBuildingNames), the #settings-popup page in index.html.
 * CONTROLS     : the Settings page, and the bnm_* entries in localStorage.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';
import { setBuildingNames } from './map.js';

/**
 * Read a remembered value.
 * @param {string} key - localStorage key
 * @returns {string|null} null when nothing is saved (or storage is blocked)
 */
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null; // private browsing can block storage
  }
}

/**
 * Remember a value.
 * @param {string} key
 * @param {string} value
 */
function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Not being able to remember is harmless: it still applies for this visit.
  }
}

/**
 * Wire a Framework7 segmented switch to a store value.
 * @param {HTMLElement} switchElement - buttons with data-value
 * @param {(value: string) => void} choose - called when a button is tapped
 * @returns {(value: string) => void} call it to highlight the current value
 */
function segmented(switchElement, choose) {
  switchElement.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (button) choose(button.dataset.value);
  });
  return (value) => {
    switchElement.querySelectorAll('[data-value]').forEach((button) => {
      const chosen = button.dataset.value === value;
      button.classList.toggle('button-active', chosen);
      button.setAttribute('aria-checked', String(chosen));
    });
  };
}

/**
 * Fill the Data list from what the app really loaded.
 * @param {object} counts - { buildings, parks, rooms, entrances, places, floorPlans, photos }
 */
function fillData(counts) {
  const words = CONFIG.settings;
  document.querySelector('#website-version').textContent = words.versionText + ' ' + words.version;
  document.querySelector('#data-note').textContent = words.dataNote;
  document.querySelector('#settings-credit').textContent = words.credit;
  document.querySelector('#data-sources').innerHTML = words.dataSources
    .map((item) => {
      const count = item.count ? counts[item.count] + ' ' + item.countText + ' · ' : '';
      return '<li><div class="item-content"><div class="item-inner">' +
        '<div class="item-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="item-subtitle">' + escapeHtml(count + item.files) + '</div>' +
        '<div class="item-text">' + escapeHtml(item.source) + '</div>' +
        '</div></div></li>';
    })
    .join('');
}

/**
 * Wire the Settings page.
 * @param {Framework7} app
 * @param {object} counts - how many of each thing the app loaded (for the Data list)
 */
export function initSettings(app, counts) {
  const words = CONFIG.settings;
  const directions = CONFIG.directions;
  const namesToggle = document.querySelector('#setting-building-names');

  // 1. Restore this device's saved choices (or config.yml's defaults).
  const savedNames = read(words.buildingNamesKey);
  store.setShowNames(savedNames === null ? CONFIG.map.buildingNames : savedNames === 'on');
  const savedMode = read(directions.modeStorageKey);
  if (savedMode && directions.modes[savedMode]) store.setTravelMode(savedMode);
  const savedUnits = read(words.unitsKey);
  store.setUnits(savedUnits === 'metric' || savedUnits === 'imperial' ? savedUnits : directions.units);

  // 2. Controls change the store...
  namesToggle.addEventListener('change', () => store.setShowNames(namesToggle.checked));
  const showMode = segmented(document.querySelector('#setting-travel'), (mode) => store.setTravelMode(mode));
  const showUnits = segmented(document.querySelector('#setting-units'), (units) => store.setUnits(units));

  document.querySelector('#setting-reset').addEventListener('click', (event) => {
    event.preventDefault();
    app.dialog.create({
      title: words.resetTitle,
      text: words.resetText,
      buttons: [
        { text: words.resetNo },
        {
          text: words.resetYes,
          bold: true,
          color: 'red',
          onClick: () => {
            try {
              Object.keys(localStorage).filter((key) => key.startsWith(words.savedPrefix)).forEach((key) => localStorage.removeItem(key));
            } catch (error) {
              // Storage blocked: there was nothing saved anyway.
            }
            location.reload(); // start fresh with the defaults
          },
        },
      ],
    }).open();
  });

  // 3. ...and whatever changed them (here, Map settings, the directions card), show and save it.
  let shownNames = null;
  store.subscribe((state) => {
    namesToggle.checked = state.showNames;
    showMode(state.travelMode);
    showUnits(state.units);
    save(directions.modeStorageKey, state.travelMode);
    save(words.unitsKey, state.units);
    if (state.showNames !== shownNames) {
      shownNames = state.showNames;
      setBuildingNames(shownNames);
      save(words.buildingNamesKey, shownNames ? 'on' : 'off');
    }
  });

  fillData(counts);
}
