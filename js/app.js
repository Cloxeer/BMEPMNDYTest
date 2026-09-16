/**
 * @file js/app.js
 * @summary The app's ON switch — loads data, starts everything, wires the menu.
 *
 * WHAT IT DOES : (1) boots Framework7 (iOS theme),
 *                (2) loads data/buildings.geojson,
 *                (3) starts the map, full-page sheet, pill, and search,
 *                (4) wires the full-screen fade menu + first-visit welcome.
 * DEPENDS ON   : Framework7 (global `Framework7`), all the js/ modules,
 *                data/buildings.geojson.
 * CONTROLS     : app start-up order and the menu/welcome flows.
 * USED BY      : index.html (loaded as the page's module).
 */

import { store } from './store.js';
import { initMap } from './map.js';
import { initSheet } from './buildingSheet.js';
import { initPill } from './pill.js';
import { initSearch } from './search.js';

const VISITED_KEY = 'bnm_visited';

/**
 * Find the middle point of a polygon's outer ring (for the pin + fly-to).
 * @param {number[][]} ring - array of [lng, lat] points
 * @returns {number[]} [lng, lat] center
 */
function centroid(ring) {
  let lng = 0;
  let lat = 0;
  const pts = ring.slice(0, -1); // last point repeats the first
  pts.forEach((p) => {
    lng += p[0];
    lat += p[1];
  });
  return [lng / pts.length, lat / pts.length];
}

/** Boot Framework7 (draws the navbar, menu, popups, sheet in iOS style). */
function startUI() {
  return new Framework7({ el: '#app', name: 'Better NMSU Maps', theme: 'ios' });
}

/** Wire the hamburger to the fade menu, and the menu links to the popups. */
function initMenu(app) {
  const menu = app.popup.create({ el: '#menu-popup' });
  const menuEl = document.querySelector('#menu-popup');
  menu.on('open', () => menuEl.classList.add('menu-open'));
  menu.on('close', () => menuEl.classList.remove('menu-open'));

  document.querySelector('#menu-btn').addEventListener('click', () => menu.open());
  document.querySelector('#menu-map').addEventListener('click', () => menu.close());
  document.querySelector('#menu-schedule').addEventListener('click', () => {
    menu.close();
    app.popup.open('#schedule-popup');
  });
  document.querySelector('#menu-settings').addEventListener('click', () => {
    menu.close();
    app.popup.open('#settings-popup');
  });
}

/** Show the welcome popup only on the first visit this session. */
function initWelcome(app) {
  let seen = false;
  try {
    seen = sessionStorage.getItem(VISITED_KEY) === '1';
  } catch (e) {
    seen = false;
  }
  if (!seen) app.popup.open('#welcome-popup');

  document.querySelector('#enter-map').addEventListener('click', () => {
    try {
      sessionStorage.setItem(VISITED_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  });
}

/** Hide the bottom pill while any full-screen popup is open. */
function initPillVisibility(app) {
  const pill = document.querySelector('#pill');
  let openCount = 0;
  app.on('popupOpen', () => {
    openCount++;
    pill.classList.add('pill-hidden');
  });
  app.on('popupClose', () => {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) pill.classList.remove('pill-hidden');
  });
}

/** Wire the placeholder "Report an issue" button. */
function wirePlaceholders(app) {
  document.querySelector('#report-btn').addEventListener('click', (e) => {
    e.preventDefault();
    app.dialog.alert('Issue reporting arrives later.', 'Coming soon');
  });
}

/** Load data, then start every part of the app. */
async function main() {
  const app = startUI();

  // Build quick lookups from the one data file.
  const geojson = await fetch('data/buildings.geojson').then((r) => r.json());
  const byId = {};
  const list = [];
  geojson.features.forEach((f) => {
    const record = { ...f.properties, center: centroid(f.geometry.coordinates[0]) };
    byId[record.id] = record;
    list.push(record);
  });

  const map = initMap(store, geojson, byId);
  initSheet(app, store, byId);
  initPill(store, byId);
  initSearch(app, store, list, byId);
  initMenu(app);
  initPillVisibility(app); // must run BEFORE initWelcome so it catches the popup opening
  initWelcome(app);
  wirePlaceholders(app);

  window.app = app;
  window.map = map;
  window.store = store;
}

// If anything above fails, show a plain message instead of a blank page.
main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:sans-serif;color:#8C0B42;background:#fff;z-index:99999">' +
      'Could not start the app. Check your internet connection and refresh.</div>'
  );
});
