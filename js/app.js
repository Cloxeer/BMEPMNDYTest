/**
 * @file js/app.js
 * @summary The app's ON switch — loads data, starts everything, wires the menu.
 *
 * WHAT IT DOES : (1) boots Framework7 (iOS theme),
 *                (2) loads buildings + the NMSU campus files,
 *                (3) starts the map, full-page sheet, pill, and search,
 *                (4) wires the full-screen fade menu + first-visit welcome.
 * DEPENDS ON   : Framework7 (global `Framework7`), all the js/ modules,
 *                data/buildings.geojson, and the campus files made by
 *                tools/build_campuses.py.
 * CONTROLS     : app start-up order and the menu/welcome flows.
 * USED BY      : index.html (loaded as the page's module).
 */

import { store } from './store.js';
import { initMap } from './map.js';
import { initSheet } from './buildingSheet.js';
import { initPill } from './pill.js';
import { initSearch } from './search.js';
import { initLocations } from './locations.js';

const VISITED_KEY = 'bnm_visited';

/**
 * Get a building's [lng, lat] center from its geometry (point or polygon).
 * @param {object} geometry - a GeoJSON geometry
 * @returns {number[]} [lng, lat]
 */
function centerOf(geometry) {
  if (geometry.type === 'Point') return geometry.coordinates;
  const ring = geometry.coordinates[0].slice(0, -1); // polygon: average the corners
  let lng = 0;
  let lat = 0;
  ring.forEach((p) => {
    lng += p[0];
    lat += p[1];
  });
  return [lng / ring.length, lat / ring.length];
}

/** Boot Framework7 (draws the navbar, menu, popups, sheet in iOS style). */
function startUI() {
  return new Framework7({ el: '#app', name: 'Better NMSU Maps', theme: 'ios' });
}

/** Wire the fade menu, underline the current page, and open the sub-pages. */
function initMenu(app, map, campuses) {
  const menu = app.popup.create({ el: '#menu-popup' });
  const menuEl = document.querySelector('#menu-popup');
  const schedule = app.popup.create({ el: '#schedule-popup' });
  const settings = app.popup.create({ el: '#settings-popup' });
  const locations = app.popup.create({ el: '#locations-popup' });
  initLocations(app, map, campuses, locations);

  /** Underline whichever page we're currently on. */
  function setCurrent(page) {
    ['map', 'locations', 'schedule', 'settings'].forEach((p) => {
      document.querySelector('#menu-' + p).classList.toggle('is-current', p === page);
    });
  }
  setCurrent('map');

  menu.on('open', () => menuEl.classList.add('menu-open'));
  menu.on('close', () => menuEl.classList.remove('menu-open'));
  schedule.on('closed', () => setCurrent('map'));
  settings.on('closed', () => setCurrent('map'));
  locations.on('closed', () => setCurrent('map'));

  document.querySelector('#menu-btn').addEventListener('click', () => menu.open());
  document.querySelector('#menu-map').addEventListener('click', () => {
    setCurrent('map');
    menu.close();
  });
  document.querySelector('#menu-locations').addEventListener('click', () => {
    setCurrent('locations');
    menu.close();
    locations.open();
  });
  document.querySelector('#menu-schedule').addEventListener('click', () => {
    setCurrent('schedule');
    menu.close();
    schedule.open();
  });
  document.querySelector('#menu-settings').addEventListener('click', () => {
    setCurrent('settings');
    menu.close();
    settings.open();
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

  // The buildings, plus the 3 campus files made by tools/build_campuses.py.
  const load = (file) => fetch('data/' + file).then((r) => r.json());
  const [geojson, campuses, labels, outside] = await Promise.all([
    load('buildings.geojson'),
    load('campuses.geojson'), // NMSU class places, nearest first
    load('campus-labels.geojson'), // one name label per place
    load('outside-mask.geojson'), // everything that isn't a class place
  ]);

  const byId = {};
  const list = [];
  geojson.features.forEach((f) => {
    const record = { ...f.properties, center: centerOf(f.geometry) };
    byId[record.id] = record;
    list.push(record);
  });

  const map = initMap(store, byId, campuses, labels, outside);
  initSheet(app, store, byId);
  initPill(store, byId);
  initSearch(app, store, list, byId);
  initMenu(app, map, campuses);
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
