/**
 * @file js/pages/locations.js
 * @summary The Locations page: every NMSU class place, nearest first.
 *
 * WHAT IT DOES : Lists the places from data/campuses.geojson in two groups,
 *                "Las Cruces" and "Around New Mexico". Tapping one closes the page
 *                and moves the map there. Distances follow the Units setting.
 * DEPENDS ON   : ../core/config.js, ../core/html.js, ../core/store.js (units),
 *                ../logic/turns.js (formatDistance), #locations-popup in index.html.
 * CONTROLS     : the #loc-near and #loc-far lists.
 * USED BY      : js/pages/menu.js
 */

import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/html.js';
import { store } from '../core/store.js';
import { formatDistance } from '../logic/turns.js';

/**
 * One tappable row: the name and distance on top, "city · acres" below
 * (Framework7's media-list layout: item-title-row, then item-subtitle).
 * @param {object} place - a feature from data/campuses.geojson
 * @returns {HTMLLIElement}
 */
function placeRow(place) {
  const info = place.properties;
  const parts = [];
  if (info.City) {
    parts.push(info.City);
  }
  if (info.Acres) {
    parts.push(info.Acres + ' ' + CONFIG.locations.acresText);
  }
  const where = parts.join(' · ');
  const distance = formatDistance(info.km * 1000, store.get().units);

  const row = document.createElement('li');
  row.innerHTML =
    '<a href="#" class="item-link item-content"><div class="item-inner">' +
    '<div class="item-title-row"><div class="item-title">' + escapeHtml(info.Name) + '</div>' +
    '<div class="item-after">' + escapeHtml(distance) + '</div></div>' +
    '<div class="item-subtitle">' + escapeHtml(where) + '</div></div></a>';
  return row;
}

export class LocationsPage {
  /**
   * @param {object} campuses - data/campuses.geojson (already nearest first)
   * @param {object} page - the Framework7 popup for this page
   * @param {CampusMap} campusMap - to move the map
   */
  constructor(campuses, page, campusMap) {
    const nearList = document.querySelector('#loc-near');
    const farList = document.querySelector('#loc-far');
    this.rows = []; // { row, km } for every place

    for (const place of campuses.features) {
      const row = placeRow(place);
      row.querySelector('a').addEventListener('click', (event) => {
        event.preventDefault();
        page.close();
        // Picking a place isn't app state (nothing gets chosen), so the map is moved directly.
        campusMap.showPlace(place);
      });
      if (place.properties.km <= CONFIG.map.nearbyKm) {
        nearList.appendChild(row);
      } else {
        farList.appendChild(row);
      }
      this.rows.push({ row: row, km: place.properties.km });
    }

    // When the Units setting changes, change every distance.
    store.subscribe((state) => {
      for (const item of this.rows) {
        item.row.querySelector('.item-after').textContent = formatDistance(item.km * 1000, state.units);
      }
    });
  }
}
