/**
 * @file js/bottomBar/mapFiltersButton.js
 * @summary The round Map filters button right of the pill: show or hide kinds of places.
 *
 * WHAT IT DOES : Tap the button: rows glide up out of it, one per category in
 *                config.yml, each in that category's colour:
 *                  - Study   (crimson: classroom buildings)
 *                  - Living  (orange: residence halls)
 *                  - Parks   (green: outdoor spaces)
 *                A filled circle means that kind of place is on the map; a white
 *                circle means it's hidden. The choice is remembered on this device.
 *                The badges on the map use the same colours, so the rows also
 *                work as a key to what the colours mean.
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../core/html.js, ../core/storage.js,
 *                #filters-anchor in index.html.
 * CONTROLS     : #filters-btn and #map-filters.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/html.js';
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

    this.buildRows();

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

  /** One row per category, top to bottom, in its own colour. */
  buildRows() {
    let html = '';
    for (let row = 0; row < this.categoryNames.length; row += 1) {
      const name = this.categoryNames[row];
      const look = this.categories[name];
      const slot = this.categoryNames.length - 1 - row; // --i staggers the glide: the bottom row goes first
      html += '<button class="map-option" type="button" data-category="' + escapeHtml(name) + '" data-color' +
        ' style="--i: ' + slot + '; --row-color: ' + escapeHtml(look.color) + '">' +
        '<span class="map-option-icon"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(look.icon) + '</i></span>' +
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

  /** Start with the categories this device hid last time. */
  restoreSavedChoice() {
    let saved;
    try {
      saved = JSON.parse(readSaved(this.settings.storageKey) || '[]');
    } catch (error) {
      return; // a broken saved value: show everything
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

    // Only while looking at the map (the sheet covers it; directions hide the whole bar).
    const show = !state.sheetOpen;
    this.button.classList.toggle('is-hidden', !show);
    this.button.inert = !show;
    if (!show) {
      this.setOpen(false);
    }
  }
}
