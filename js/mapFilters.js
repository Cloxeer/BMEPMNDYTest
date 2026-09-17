/**
 * @file js/mapFilters.js
 * @summary The round Map filters button right of the pill: show or hide kinds of places.
 *
 * WHAT IT DOES : Tap the button: rows glide up out of it, one per category in
 *                config.yml, each in that category's colour:
 *                  - Study   (crimson: classroom buildings)
 *                  - Living  (orange: residence halls)
 *                  - Parks   (green: outdoor spaces)
 *                A filled circle means that kind of place is on the map; a white
 *                circle means it's hidden. The choice is remembered on this device.
 *                The same colours are used for the badges on the map, so the
 *                filter rows double as a key to what the colours mean.
 * DEPENDS ON   : ./config.js, ./store.js, ./html.js, ./map.js (setShownCategories),
 *                #filters-anchor in index.html, localStorage.
 * CONTROLS     : #filters-btn and #map-filters.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';
import { setShownCategories } from './map.js';

/** Wire the Map filters button. */
export function initMapFilters() {
  const settings = CONFIG.mapFilters;
  const categories = CONFIG.categories;
  const button = document.querySelector('#filters-btn');
  const buttonIcon = button.querySelector('i');
  const stack = document.querySelector('#map-filters');

  // One row per category, top to bottom; --i staggers the glide (bottom row first).
  const names = Object.keys(categories);
  stack.innerHTML = names
    .map((name, row) => {
      const look = categories[name];
      return '<button class="map-option" type="button" data-category="' + escapeHtml(name) + '" data-color' +
        ' style="--i: ' + (names.length - 1 - row) + '; --row-color: ' + escapeHtml(look.color) + '">' +
        '<span class="map-option-icon"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(look.icon) + '</i></span>' +
        '<span class="map-option-label">' + escapeHtml(look.label) + '</span></button>';
    })
    .join('');

  /** @param {boolean} open - show or hide the rows */
  function setOpen(open) {
    stack.classList.toggle('is-open', open);
    stack.inert = !open;
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    buttonIcon.textContent = open ? 'xmark' : settings.icon;
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!stack.classList.contains('is-open'));
  });
  stack.addEventListener('click', (event) => {
    event.stopPropagation(); // tapping a row keeps the list open
    const row = event.target.closest('[data-category]');
    if (row) store.toggleCategory(row.dataset.category);
  });
  document.addEventListener('click', () => setOpen(false)); // tap anywhere else: close

  // Start with this device's saved choice.
  try {
    const saved = JSON.parse(localStorage.getItem(settings.storageKey) || '[]');
    if (Array.isArray(saved)) store.setHiddenCategories(saved.filter((name) => categories[name]));
  } catch (error) {
    // Nothing saved, or storage blocked: show everything.
  }

  let lastHidden = null;
  store.subscribe((state) => {
    // Rows: filled = shown, white = hidden.
    stack.querySelectorAll('[data-category]').forEach((row) => {
      const shown = !state.hiddenCategories.includes(row.dataset.category);
      row.classList.toggle('is-on', shown);
      row.setAttribute('aria-pressed', String(shown));
    });

    // The map and the saved choice only change when the choice does.
    const hidden = state.hiddenCategories.join(',');
    if (hidden !== lastHidden) {
      lastHidden = hidden;
      setShownCategories(names.filter((name) => !state.hiddenCategories.includes(name)));
      try {
        localStorage.setItem(settings.storageKey, JSON.stringify(state.hiddenCategories));
      } catch (error) {
        // Not being able to remember is harmless.
      }
    }

    // Only while looking at the map (the sheet covers it; directions hide the whole bar).
    const show = !state.sheetOpen;
    button.classList.toggle('is-hidden', !show);
    button.inert = !show;
    if (!show) setOpen(false);
  });
  setOpen(false);
}
