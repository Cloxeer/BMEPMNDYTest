/**
 * @file js/app.js
 * @summary Starts the app.
 *
 * WHAT IT DOES : (1) loads config.yml,
 *                (2) starts Framework7 (iOS theme),
 *                (3) loads the building and campus data,
 *                (4) starts the map, building sheet, pill, location button, search,
 *                    menu and welcome screen.
 * DEPENDS ON   : Framework7 (global `Framework7`), every js/ module,
 *                data/buildings.geojson and the campus files from tools/build_campuses.py.
 * CONTROLS     : start-up order, the menu, the welcome screen, the "Report a problem" button.
 * USED BY      : index.html
 */

import { CONFIG, loadConfig } from './config.js';
import { store } from './store.js';
import { initMap } from './map.js';
import { initBuildingSheet } from './buildingSheet.js';
import { initPill } from './pill.js';
import { initSearch } from './search.js';
import { initLocations } from './locations.js';
import { initLocate } from './locate.js';
import { initDirections } from './directions.js';
import { initRouteCard } from './routeCard.js';

/**
 * Start Framework7. While any full-screen popup is open, the bottom pill hides.
 * (Registered here, at creation, so no popup can open before we're listening.)
 * @returns {Framework7}
 */
function startFramework7() {
  const pillBar = document.querySelector('#pill');
  let openPopups = 0;
  return new Framework7({
    el: '#app',
    name: CONFIG.app.name,
    theme: 'ios',
    on: {
      popupOpen() {
        openPopups += 1;
        pillBar.classList.add('pill-hidden');
      },
      popupClose() {
        openPopups = Math.max(0, openPopups - 1);
        if (openPopups === 0) pillBar.classList.remove('pill-hidden');
      },
    },
  });
}

/**
 * Download one data file from data/.
 * @param {string} fileName
 * @returns {Promise<object>}
 */
async function loadData(fileName) {
  const response = await fetch('data/' + fileName);
  if (!response.ok) throw new Error('Could not load data/' + fileName);
  return response.json();
}

/**
 * The full-screen menu: underlines the current page and opens the other pages.
 * @param {Framework7} app
 * @param {object} campuses - data/campuses.geojson (for the Locations page)
 */
function initMenu(app, campuses) {
  const menu = app.popup.create({ el: '#menu-popup' });
  const menuElement = document.querySelector('#menu-popup');
  const pages = {
    locations: app.popup.create({ el: '#locations-popup' }),
    schedule: app.popup.create({ el: '#schedule-popup' }),
    settings: app.popup.create({ el: '#settings-popup' }),
  };
  initLocations(campuses, pages.locations);

  /** @param {string} current - 'map', 'locations', 'schedule' or 'settings' */
  function underline(current) {
    ['map', ...Object.keys(pages)].forEach((name) => {
      document.querySelector('#menu-' + name).classList.toggle('is-current', name === current);
    });
  }
  underline('map');

  // The menu's words fade in one after another while this class is on.
  menu.on('open', () => menuElement.classList.add('menu-open'));
  menu.on('close', () => menuElement.classList.remove('menu-open'));
  document.querySelector('#menu-btn').addEventListener('click', () => menu.open());

  document.querySelector('#menu-map').addEventListener('click', () => {
    underline('map');
    menu.close();
  });
  Object.entries(pages).forEach(([name, page]) => {
    page.on('closed', () => underline('map'));
    document.querySelector('#menu-' + name).addEventListener('click', () => {
      underline(name);
      menu.close();
      page.open();
    });
  });
}

/**
 * Show the welcome screen on the first visit of each browser session.
 * @param {Framework7} app
 */
function initWelcome(app) {
  const key = CONFIG.welcome.storageKey;
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === '1';
  } catch (error) {
    // Private browsing can block storage; then just show the welcome.
  }
  if (!seen) app.popup.open('#welcome-popup');

  document.querySelector('#enter-map').addEventListener('click', () => {
    try {
      sessionStorage.setItem(key, '1');
    } catch (error) {
      // Not being able to remember is harmless.
    }
  });
}

/**
 * "Report a problem" isn't built yet; say so instead of doing nothing.
 * @param {Framework7} app
 */
function initReportButton(app) {
  document.querySelector('#report-btn').addEventListener('click', (event) => {
    event.preventDefault();
    app.dialog.alert(CONFIG.app.reportText, CONFIG.app.reportTitle);
  });
}

/**
 * Replace the page with a readable message when start-up fails.
 * @param {Error} error
 */
function showStartupError(error) {
  console.error(error);
  const box = document.createElement('div');
  box.className = 'startup-error';
  // js-yaml gives the reason and the line where it NOTICED the problem (counted from 0),
  // which can be a line or two after the actual typo.
  if (error.name === 'YAMLException') {
    box.textContent = 'config.yml has a mistake near line ' + (error.mark.line + 1) + ': ' + error.reason + '.';
  } else if (error.name === 'TypeError' && /fetch/i.test(error.message)) {
    // fetch() could not reach the server at all.
    // (CONFIG may be empty if config.yml itself didn't load, so keep a fallback.)
    box.textContent = CONFIG.app ? CONFIG.app.startupErrorText : 'Could not start the app. Check your internet connection and refresh.';
  } else {
    // A missing file or a bug: show what went wrong so it can be fixed.
    box.textContent = 'Could not start the app: ' + error.message;
  }
  document.body.appendChild(box);
}

/** Start everything, in order. */
async function main() {
  await loadConfig();
  const app = startFramework7();

  const [buildingData, campuses, labels, outside, rooms] = await Promise.all([
    loadData('buildings.geojson'),
    loadData('campuses.geojson'), // NMSU class places, nearest first
    loadData('campus-labels.geojson'), // one name per place
    loadData('outside-mask.geojson'), // everything that isn't a class place
    loadData('rooms.json'), // rooms found on our floor plans (tools/build_rooms.py)
  ]);

  // Each building's map position is its point in the data file.
  const buildings = buildingData.features.map((feature) => ({ ...feature.properties, center: feature.geometry.coordinates }));
  const buildingsById = Object.fromEntries(buildings.map((building) => [building.id, building]));

  const map = initMap(buildingsById, campuses, labels, outside);
  initBuildingSheet(app, buildingsById, rooms);
  initPill(buildingsById);
  const locate = initLocate(app, map);
  initDirections(app, map, locate, initRouteCard(), buildingsById);
  initSearch(buildings, rooms, buildingsById);
  initMenu(app, campuses);
  initWelcome(app);
  initReportButton(app);

  // Handy in the browser console while developing.
  Object.assign(window, { app, map, store, CONFIG });
}

main().catch(showStartupError);
