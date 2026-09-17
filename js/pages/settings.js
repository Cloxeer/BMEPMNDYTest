/**
 * @file js/pages/settings.js
 * @summary The Settings page, and every choice the app remembers on this device.
 *
 * WHAT IT DOES : Map: "Building names" on or off (Map settings has the same switch).
 *                Directions: travel by Walk / Bike / Drive, and units (ft/mi or m/km).
 *                Saved on this device: Reset forgets everything the app remembers.
 *                Data: each data file the app loaded, its format, how many things
 *                are in it, and where it comes from.
 *                At the bottom: our credit, and the website's version.
 *                The choices live in the store. This file brings them back when
 *                the app starts, and saves them whenever they change, from anywhere.
 * DEPENDS ON   : Framework7 (the Reset question), ../core/config.js, ../core/store.js,
 *                ../core/html.js, ../core/storage.js, the #settings-popup page in index.html.
 * CONTROLS     : the Settings page, and the bnm_* values saved on this device.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/html.js';
import { readSaved, save, forgetAllStartingWith } from '../core/storage.js';

export class SettingsPage {
  /**
   * @param {Framework7} app
   * @param {CampusMap} campusMap - shows or hides the building names
   * @param {object} counts - how many of each thing the app loaded, for the Data list
   */
  constructor(app, campusMap, counts) {
    this.app = app;
    this.campusMap = campusMap;
    this.words = CONFIG.settings;
    this.directionWords = CONFIG.directions;
    this.namesToggle = document.querySelector('#setting-building-names');
    this.travelSwitch = document.querySelector('#setting-travel');
    this.unitsSwitch = document.querySelector('#setting-units');
    this.shownNames = null; // the Building names choice last put on the map

    this.restoreSavedChoices();

    // Tapping a control changes the store...
    this.namesToggle.addEventListener('change', () => store.setShowNames(this.namesToggle.checked));
    this.travelSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (button) {
        store.setTravelMode(button.dataset.value);
      }
    });
    this.unitsSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (button) {
        store.setUnits(button.dataset.value);
      }
    });
    document.querySelector('#setting-reset').addEventListener('click', (event) => {
      event.preventDefault();
      this.askToReset();
    });

    // ...and whatever changed the store (here, Map settings, or the directions card) is shown and saved.
    store.subscribe((state) => this.update(state));

    this.fillData(counts);
  }

  /** Bring back this device's saved choices, or config.yml's defaults. */
  restoreSavedChoices() {
    const savedNames = readSaved(this.words.buildingNamesKey);
    if (savedNames === null) {
      store.setShowNames(CONFIG.map.buildingNames);
    } else {
      store.setShowNames(savedNames === 'on');
    }

    const savedMode = readSaved(this.directionWords.modeStorageKey);
    if (savedMode && this.directionWords.modes[savedMode]) {
      store.setTravelMode(savedMode);
    }

    const savedUnits = readSaved(this.words.unitsKey);
    if (savedUnits === 'metric' || savedUnits === 'imperial') {
      store.setUnits(savedUnits);
    } else {
      store.setUnits(this.directionWords.units);
    }
  }

  /** Ask before forgetting everything; yes starts the app fresh. */
  askToReset() {
    const dialog = this.app.dialog.create({
      title: this.words.resetTitle,
      text: this.words.resetText,
      buttons: [
        { text: this.words.resetNo },
        {
          text: this.words.resetYes,
          bold: true,
          color: 'red',
          onClick: () => {
            forgetAllStartingWith(this.words.savedPrefix);
            location.reload(); // start fresh with the defaults
          },
        },
      ],
    });
    dialog.open();
  }

  /**
   * Highlight the chosen button of a Framework7 segmented switch.
   * @param {HTMLElement} switchElement - holds buttons with data-value
   * @param {string} value - the chosen value
   */
  showChoice(switchElement, value) {
    for (const button of switchElement.querySelectorAll('[data-value]')) {
      const chosen = button.dataset.value === value;
      button.classList.toggle('button-active', chosen);
      button.setAttribute('aria-checked', String(chosen));
    }
  }

  /**
   * Show the current choices, and save them.
   * @param {object} state
   */
  update(state) {
    this.namesToggle.checked = state.showNames;
    this.showChoice(this.travelSwitch, state.travelMode);
    this.showChoice(this.unitsSwitch, state.units);
    save(this.directionWords.modeStorageKey, state.travelMode);
    save(this.words.unitsKey, state.units);

    if (state.showNames !== this.shownNames) {
      this.shownNames = state.showNames;
      this.campusMap.setBuildingNames(this.shownNames);
      if (this.shownNames) {
        save(this.words.buildingNamesKey, 'on');
      } else {
        save(this.words.buildingNamesKey, 'off');
      }
    }
  }

  /**
   * Fill the Data list from what the app really loaded, and the credit at the bottom.
   * @param {object} counts - { buildings, parks, rooms, entrances, places, floorPlans, photos }
   */
  fillData(counts) {
    document.querySelector('#website-version').textContent = this.words.versionText + ' ' + this.words.version;
    document.querySelector('#data-note').textContent = this.words.dataNote;
    document.querySelector('#settings-credit').textContent = this.words.credit;

    let html = '';
    for (const item of this.words.dataSources) {
      let count = '';
      if (item.count) {
        count = counts[item.count] + ' ' + item.countText + ' · '; // e.g. "45 buildings · "
      }
      html += '<li><div class="item-content"><div class="item-inner">' +
        '<div class="item-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="item-subtitle">' + escapeHtml(count + item.files) + '</div>' +
        '<div class="item-text">' + escapeHtml(item.source) + '</div>' +
        '</div></div></li>';
    }
    document.querySelector('#data-sources').innerHTML = html;
  }
}
