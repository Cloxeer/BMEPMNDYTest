/**
 * @file js/pages/locations.js
 * @summary The Locations page: every place on our map you can go to, grouped by kind.
 *
 * WHAT IT DOES : One list per category in config.yml (Study, Housing, Parks, Food,
 *                Staff Academic, Historic, Parking), each headed by the category's icon and colour, with
 *                its places A to Z. Historic also lists study and living buildings that
 *                have an official historic designation. Tapping a place closes the page, flies the map
 *                there and opens its sheet (even if that category is switched off
 *                in Map filters).
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../core/html.js,
 *                #locations-popup in index.html (Framework7 lists).
 * CONTROLS     : #places-list.
 * USED BY      : js/pages/menu.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml, iconHtml } from '../core/html.js';

/**
 * The small grey line under a place's name: "HJLC · 2902 Mcfie Cir." or "Coffee · Corbett Center Student Union".
 * @param {object} place
 * @returns {string}
 */
function subtitleFor(place) {
  const parts = [];
  if (place.code) {
    parts.push(place.code);
  }
  if (place.kind) {
    parts.push(place.kind);
  }
  if (place.permitColor) {
    parts.push(place.permitColor); // parking: its permit color
  }
  if (place.insideName) {
    parts.push(place.insideName);
  } else if (place.campus) {
    parts.push(place.campus);
  } else if (place.address) {
    parts.push(place.address);
  }
  return parts.join(' · ');
}

/**
 * Sort places A to Z by name (the list is copied, not changed).
 * @param {object[]} places
 * @returns {object[]}
 */
function sortedByName(places) {
  const copy = places.slice();
  copy.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return copy;
}

export class LocationsPage {
  /**
   * @param {object[]} places - every building and place
   * @param {object} page - the Framework7 popup for this page
   */
  constructor(places, page) {
    const holder = document.querySelector('#places-list');
    for (const category of Object.keys(CONFIG.categories)) {
      const inCategory = [];
      for (const place of places) {
        const historicToo = category === 'historic' && place.historic;
        if (place.category === category || historicToo) {
          inCategory.push(place);
        }
      }
      if (inCategory.length === 0) {
        continue;
      }
      holder.appendChild(this.makeGroup(category, sortedByName(inCategory), page));
    }
  }

  /**
   * One category: a title with its icon, then a list of its places.
   * @param {string} category
   * @param {object[]} places - already sorted
   * @param {object} page - closed when a place is tapped
   * @returns {HTMLElement}
   */
  makeGroup(category, places, page) {
    const look = CONFIG.categories[category];
    const group = document.createElement('div');
    group.className = 'places-group';
    group.style.setProperty('--row-color', look.color);
    group.innerHTML =
      '<div class="block-title places-title">' + iconHtml(look.icon, look.iconSet) +
      '<span>' + escapeHtml(look.label) + ' (' + places.length + ')</span></div>' +
      '<div class="list media-list inset"><ul></ul></div>';
    const list = group.querySelector('ul');

    for (const place of places) {
      const row = document.createElement('li');
      row.innerHTML =
        '<a href="#" class="item-link item-content"><div class="item-inner">' +
        '<div class="item-title-row"><div class="item-title">' + escapeHtml(place.name) + '</div></div>' +
        '<div class="item-subtitle">' + escapeHtml(subtitleFor(place)) + '</div></div></a>';
      row.querySelector('a').addEventListener('click', (event) => {
        event.preventDefault();
        page.close();
        store.selectBuilding(place, 'search');
      });
      list.appendChild(row);
    }
    return group;
  }
}
