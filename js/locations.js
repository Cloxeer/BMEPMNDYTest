/**
 * @file js/locations.js
 * @summary The "Locations" page: every official NMSU property, nearest first.
 *
 * WHAT IT DOES : Lists all properties from data/campuses.geojson in two
 *                groups (Las Cruces / Around New Mexico). Tapping one closes
 *                the page and flies the map there.
 * DEPENDS ON   : Framework7 (app), ./map.js (showProperty), ./config.js,
 *                the #locations-popup markup in index.html.
 * CONTROLS     : the contents of #locations-list.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { showProperty } from './map.js';

/**
 * Build one tappable row.
 * @param {object} f - a property feature
 * @returns {HTMLElement} <li>
 */
function row(f) {
  const p = f.properties;
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#';
  a.className = 'item-link item-content';
  const where = [p.City, p.Acres ? p.Acres + ' acres' : ''].filter(Boolean).join(' · ');
  a.innerHTML =
    '<div class="item-inner"><div class="item-title">' + p.Name +
    '<div class="item-footer">' + where + '</div></div>' +
    '<div class="item-after">' + p.km + ' km</div></div>';
  li.appendChild(a);
  return li;
}

/**
 * Fill the Locations page and wire each row.
 * @param {Framework7} app
 * @param {maplibregl.Map} map
 * @param {object} campuses - data/campuses.geojson (already sorted nearest first)
 * @param {object} page - the Framework7 popup instance for Locations
 */
export function initLocations(app, map, campuses, page) {
  const near = document.querySelector('#loc-near');
  const far = document.querySelector('#loc-far');

  campuses.features.forEach((f) => {
    const li = row(f);
    li.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      page.close();
      showProperty(map, f);
    });
    (f.properties.km <= CONFIG.nearbyKm ? near : far).appendChild(li);
  });
}
