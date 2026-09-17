/**
 * @file js/bottomBar/mapFiltersButton.js
 * @summary The round Map filters button right of the pill: show or hide kinds of places.
 *
 * WHAT IT DOES : Tap the button: rows glide up out of it, one per category in
 *                config.yml, each in that category's colour. The most used sits at the
 *                bottom, closest to your thumb:
 *                  - Study (crimson), Housing (orange), Parks (green), Food (pink): on at first
 *                  - Staff Academic (teal), Historic (brown), Parking (indigo): off at first
 *                A filled circle means that kind of place is on the map; a white
 *                circle means it's hidden. The choice is remembered on this device.
 *                Which rows the button has is chosen in Settings > Map filters (also
 *                remembered); with no rows at all, the button hides.
 *                The badges on the map use the same colours, so the rows also
 *                work as a key to what the colours mean.
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../core/html.js, ../core/storage.js,
 *                #filters-anchor in index.html.
 * CONTROLS     : #filters-btn and #map-filters.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml, iconHtml } from '../core/html.js';
import { readSaved, save } from '../core/storage.js';

export class MapFiltersButton {
  /**
   * @param {CampusMap} campusMap - hides and shows the badges
   */
  constructor(campusMap) {
    this.campusMap = campusMap;
    this.settings = CONFIG.mapFilters;
    this.categories = CONFIG.categories;
    this.categoryNames = Object.keys(this.categories);
    this.button = document.querySelector('#filters-btn');
    this.buttonIcon = this.button.querySelector('i');
    this.stack = document.querySelector('#map-filters');
    this.lastHidden = null; // the hidden categories last put on the map, e.g. "study,park"
    this.lastOptions = null; // the rows last built, e.g. "study,living"

    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.setOpen(!this.stack.classList.contains('is-open'));
    });
    this.stack.addEventListener('click', (event) => {
      event.stopPropagation(); // tapping a row keeps the list open
      const row = event.target.closest('[data-category]');
      if (row) {
        store.toggleCategory(row.dataset.category);
      }
    });
    document.addEventListener('click', () => this.setOpen(false)); // tap anywhere else: close

    this.restoreSavedChoice();
    store.subscribe((state) => this.update(state));
    this.setOpen(false);
  }

  /**
   * One row per chosen category, in its own colour. The first category in config.yml is the bottom row.
   * @param {string[]} options - the categories that have a row
   */
  buildRows(options) {
    const shownNames = [];
    for (const name of this.categoryNames) {
      if (options.includes(name)) {
        shownNames.push(name);
      }
    }
    let html = '';
    for (let row = shownNames.length - 1; row >= 0; row -= 1) {
      const name = shownNames[row];
      const look = this.categories[name];
      const slot = row; // --i staggers the glide: the bottom row (the first category) goes first
      html += '<button class="map-option" type="button" data-category="' + escapeHtml(name) + '" data-color' +
        ' style="--i: ' + slot + '; --row-color: ' + escapeHtml(look.color) + '">' +
        '<span class="map-option-icon">' + iconHtml(look.icon, look.iconSet) + '</span>' +
        '<span class="map-option-label">' + escapeHtml(look.label) + '</span></button>';
    }
    this.stack.innerHTML = html;
  }

  /** @param {boolean} open - show or hide the rows */
  setOpen(open) {
    this.stack.classList.toggle('is-open', open);
    this.stack.inert = !open;
    this.button.classList.toggle('is-open', open);
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      this.buttonIcon.textContent = 'xmark';
    } else {
      this.buttonIcon.textContent = this.settings.icon;
    }
  }

  /** Start with the rows and hidden categories this device chose last time, or config.yml's defaults. */
  restoreSavedChoice() {
    this.restoreSavedOptions();
    this.restoreHiddenCategories();
  }

  /** The rows the button had last time, or (first visit) the categories config.yml marks inFilters. */
  restoreSavedOptions() {
    let options = [];
    const savedText = readSaved(this.settings.optionsKey);
    if (savedText !== null) {
      try {
        options = JSON.parse(savedText);
      } catch (error) {
        options = []; // a broken saved value: use the defaults below
      }
    }
    if (savedText === null || !Array.isArray(options)) {
      options = [];
      for (const name of this.categoryNames) {
        if (this.categories[name].inFilters) {
          options.push(name);
        }
      }
    }
    const kept = [];
    for (const name of options) {
      if (this.categories[name]) {
        kept.push(name); // only categories that still exist in config.yml
      }
    }
    store.setFilterOptions(kept);
  }

  /** The categories this device hid last time, or (first visit) the ones config.yml starts hidden. */
  restoreHiddenCategories() {
    const savedText = readSaved(this.settings.storageKey);
    let saved = [];
    if (savedText === null) {
      for (const name of this.categoryNames) {
        if (this.categories[name].startHidden) {
          saved.push(name);
        }
      }
    } else {
      try {
        saved = JSON.parse(savedText);
      } catch (error) {
        return; // a broken saved value: show everything
      }
    }
    if (!Array.isArray(saved)) {
      return;
    }
    const hidden = [];
    for (const name of saved) {
      if (this.categories[name]) {
        hidden.push(name); // only categories that still exist in config.yml
      }
    }
    store.setHiddenCategories(hidden);
  }

  /**
   * Show the rows, the map and the button for the current state.
   * @param {object} state
   */
  update(state) {
    // The rows: rebuilt only when Settings changes which ones there are.
    const options = state.filterOptions.join(',');
    if (options !== this.lastOptions) {
      this.lastOptions = options;
      this.buildRows(state.filterOptions);
      save(this.settings.optionsKey, JSON.stringify(state.filterOptions));
    }

    // Rows: filled = shown, white = hidden.
    for (const row of this.stack.querySelectorAll('[data-category]')) {
      const shown = !state.hiddenCategories.includes(row.dataset.category);
      row.classList.toggle('is-on', shown);
      row.setAttribute('aria-pressed', String(shown));
    }

    // The map and the saved choice only change when the choice does.
    const hidden = state.hiddenCategories.join(',');
    if (hidden !== this.lastHidden) {
      this.lastHidden = hidden;
      const shownCategories = [];
      for (const name of this.categoryNames) {
        if (!state.hiddenCategories.includes(name)) {
          shownCategories.push(name);
        }
      }
      this.campusMap.setShownCategories(shownCategories);
      save(this.settings.storageKey, JSON.stringify(state.hiddenCategories));
    }

    // Only while looking at the map (the sheet covers it; directions hide the whole bar), and only with rows to show.
    const show = !state.sheetOpen && state.filterOptions.length > 0;
    this.button.classList.toggle('is-hidden', !show);
    this.button.inert = !show;
    if (!show) {
      this.setOpen(false);
    }
  }
}
