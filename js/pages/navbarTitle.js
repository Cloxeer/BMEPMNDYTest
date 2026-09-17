/**
 * @file js/pages/navbarTitle.js
 * @summary The title in the crimson bar at the top: "Campus", or where directions are going.
 *
 * WHAT IT DOES : Shows "Campus" normally. During directions it shows "To Zuhl Library",
 *                or "To Room 228" with the building's name on a small second line.
 * DEPENDS ON   : ../core/config.js, ../core/store.js, the .navbar .title in index.html.
 * CONTROLS     : the navbar title.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';

/**
 * Keep the navbar title up to date.
 * @param {Object.<string, object>} buildingsById
 */
export function followNavbarTitle(buildingsById) {
  const title = document.querySelector('.navbar .title');
  const normalTitle = title.textContent;

  store.subscribe((state) => {
    const trip = state.directionsTo;
    if (!trip) {
      title.textContent = normalTitle;
      return;
    }
    const building = buildingsById[trip.buildingId];
    let place = building.name;
    if (trip.room) {
      place = CONFIG.search.roomText + ' ' + trip.room.number;
    }
    title.textContent = CONFIG.directions.toText + ' ' + place;

    if (trip.room) {
      // Framework7's small second line under the title: which building the room is in.
      const subtitle = document.createElement('span');
      subtitle.className = 'subtitle';
      subtitle.textContent = building.name;
      title.appendChild(subtitle);
    }
  });
}
