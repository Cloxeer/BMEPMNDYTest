/**
 * @file js/locations.js
 * @summary The Locations page: every NMSU class place, nearest first.
 *
 * WHAT IT DOES : Lists the places from data/campuses.geojson in two groups,
 *                "Las Cruces" and "Around New Mexico". Tapping one closes the
 *                page and moves the map there.
 * DEPENDS ON   : ./config.js, ./html.js, ./map.js (showPlace), #locations-popup in index.html.
 * CONTROLS     : the #loc-near and #loc-far lists.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { escapeHtml } from './html.js';
// The Locations page moves the map directly: picking a place isn't app state
// (nothing is selected), so it doesn't go through the store.
import { showPlace } from './map.js';

/**
 * One tappable row: name, "city · acres", distance.
 * @param {object} place - a feature from data/campuses.geojson
 * @returns {HTMLLIElement}
 */
function placeRow(place) {
  const { Name, City, Acres, km } = place.properties;
  const words = CONFIG.locations;
  const where = [City, Acres ? Acres + ' ' + words.acresText : ''].filter(Boolean).join(' · ');
  const row = document.createElement('li');
  row.innerHTML =
    '<a href="#" class="item-link item-content"><div class="item-inner"><div class="item-title">' + escapeHtml(Name) +
    '<div class="item-footer">' + escapeHtml(where) + '</div></div>' +
    '<div class="item-after">' + escapeHtml(km + ' ' + words.kmText) + '</div></div></a>';
  return row;
}

/**
 * Fill the Locations page.
 * @param {object} campuses - data/campuses.geojson (already nearest first)
 * @param {object} page - the Framework7 popup for this page
 */
export function initLocations(campuses, page) {
  const nearList = document.querySelector('#loc-near');
  const farList = document.querySelector('#loc-far');

  campuses.features.forEach((place) => {
    const row = placeRow(place);
    row.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      page.close();
      showPlace(place);
    });
    (place.properties.km <= CONFIG.map.nearbyKm ? nearList : farList).appendChild(row);
  });
}
