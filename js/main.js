/**
 * @file js/main.js
 * @summary Starts the app. Read this file first: it shows every part and the order they start in.
 *
 * WHAT IT DOES : 1. loads config.yml,
 *                2. starts Framework7 (the iOS-style buttons, sheets and popups),
 *                3. loads the data files,
 *                4. creates every part of the app and hands each one what it needs.
 *                If anything goes wrong while starting, it shows a readable message.
 * DEPENDS ON   : Framework7 (the global `Framework7`), every js/ folder, and data/.
 * CONTROLS     : the start-up order.
 * USED BY      : index.html
 *
 * FOLDERS      : core/       shared tools: settings, app state, saving, safe HTML
 *                logic/      pure maths and text (no page code): distances, search, turns, routes
 *                map/        the map, its badges, your location and compass
 *                bottomBar/  the pill and the round buttons at the bottom
 *                directions/ routes, their drawing, and the turn-by-turn card
 *                sheet/      the building sheet: floor plans and photos
 *                pages/      the menu, search, Locations, Settings, welcome, title
 */

import { CONFIG, loadConfig } from './core/config.js';
import { store } from './core/store.js';
import { keepAppOnPhone } from './core/offline.js';
import { CampusMap } from './map/campusMap.js';
import { MyLocation } from './map/myLocation.js';
import { NorthCompass } from './map/northCompass.js';
import { BottomPill } from './bottomBar/bottomPill.js';
import { DirectionsButton } from './bottomBar/directionsButton.js';
import { MapSettingsButton } from './bottomBar/mapSettingsButton.js';
import { MapFiltersButton } from './bottomBar/mapFiltersButton.js';
import { Directions } from './directions/directions.js';
import { RouteCard } from './directions/routeCard.js';
import { BuildingSheet } from './sheet/buildingSheet.js';
import { Search } from './pages/search.js';
import { Menu } from './pages/menu.js';
import { SettingsPage } from './pages/settings.js';
import { showWelcome } from './pages/welcome.js';
import { followNavbarTitle } from './pages/navbarTitle.js';

/**
 * Start Framework7. While any full-screen popup is open, the bottom bar hides.
 * (This is set up here, when Framework7 is created, so no popup can open before we're listening.)
 * @returns {Framework7}
 */
function startFramework7() {
  const bottomBar = document.querySelector('#pill');
  let openPopups = 0;
  return new Framework7({
    el: '#app',
    name: CONFIG.app.name,
    theme: 'ios',
    on: {
      popupOpen() {
        openPopups += 1;
        bottomBar.classList.add('pill-hidden');
      },
      popupClose() {
        openPopups = Math.max(0, openPopups - 1);
        if (openPopups === 0) {
          bottomBar.classList.remove('pill-hidden');
        }
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
  if (!response.ok) {
    throw new Error('Could not load data/' + fileName);
  }
  return response.json();
}

/**
 * Count what the app loaded, for the Data list on the Settings page.
 * @param {object[]} places - every building and place
 * @param {object[]} rooms
 * @param {object[]} entrances
 * @param {object} campuses
 * @returns {object}
 */
function countData(places, rooms, entrances, campuses) {
  const counts = { buildings: 0, park: 0, food: 0, parking: 0, rooms: rooms.length, entrances: entrances.length, places: campuses.features.length, floorPlans: 0, photos: 0 };
  for (const place of places) {
    if (CONFIG.categories[place.category].isPlace) {
      counts[place.category] += 1; // park, food or parking
    } else {
      counts.buildings += 1; // study, living or historic
    }
    counts.floorPlans += Object.keys(place.floorImages).length;
    counts.photos += place.photos.length;
  }
  return counts;
}

/**
 * Replace the page with a readable message when starting fails.
 * @param {Error} error
 */
function showStartupError(error) {
  console.error(error);
  const box = document.createElement('div');
  box.className = 'startup-error';
  if (error.name === 'YAMLException') {
    // js-yaml gives the reason and the line where it NOTICED the problem (counted from 0),
    // which can be a line or two after the actual typo.
    box.textContent = 'config.yml has a mistake near line ' + (error.mark.line + 1) + ': ' + error.reason + '.';
  } else if (error.name === 'TypeError' && /fetch/i.test(error.message)) {
    // fetch() couldn't reach the server at all.
    // CONFIG is empty if config.yml itself didn't load, so there's a message written here too.
    if (CONFIG.app) {
      box.textContent = CONFIG.app.startupErrorText;
    } else {
      box.textContent = 'Could not start the app. Check your internet connection and refresh.';
    }
  } else {
    // A missing file or a bug: show what went wrong, so it can be fixed.
    box.textContent = 'Could not start the app: ' + error.message;
  }
  document.body.appendChild(box);
}

/** Start everything, in order. */
async function startApp() {
  await loadConfig();
  const app = startFramework7();

  // All the data files download at the same time.
  const files = await Promise.all([
    loadData('buildings.geojson'), // buildings (tools/build_buildings.py)
    loadData('campuses.geojson'), // NMSU class places, nearest first (tools/build_campuses.py)
    loadData('campus-labels.geojson'), // one name per place
    loadData('outside-mask.geojson'), // everything that isn't a class place
    loadData('rooms.json'), // rooms (tools/build_rooms.py)
    loadData('entrances.json'), // outside doors on our floor plans (tools/build_entrances.py)
    loadData('places.geojson'), // parks, food and parking lots (tools/build_places.py)
  ]);
  const buildingFile = files[0];
  const campuses = files[1];
  const labels = files[2];
  const outside = files[3];
  const rooms = files[4].rooms;
  const entrances = files[5].entrances;
  const placeFile = files[6];

  // Buildings and places use the same record shape; "category" tells them apart.
  // Each place's map position is the point in its data file.
  const places = [];
  for (const feature of buildingFile.features.concat(placeFile.features)) {
    const place = Object.assign({}, feature.properties);
    place.center = feature.geometry.coordinates;
    places.push(place);
  }
  const buildingsById = {};
  for (const place of places) {
    buildingsById[place.id] = place;
  }

  // Create every part. The order matters: parts that others need come first.
  const campusMap = new CampusMap(buildingsById, campuses, labels, outside);
  const directionsButton = new DirectionsButton(app, buildingsById);
  new BuildingSheet(app, buildingsById, rooms, entrances, () => directionsButton.ask());
  new BottomPill(buildingsById);
  const myLocation = new MyLocation(app, campusMap.map);
  new NorthCompass(campusMap, myLocation.compass);
  new MapSettingsButton(app, myLocation, campusMap);
  new MapFiltersButton(campusMap);
  const routeCard = new RouteCard(app);
  new Directions(app, campusMap, myLocation, routeCard, buildingsById);
  new Search(places, rooms, buildingsById);
  new Menu(app, campuses, campusMap, places);
  showWelcome(app);
  followNavbarTitle(buildingsById);
  new SettingsPage(app, campusMap, countData(places, rooms, entrances, campuses));

  // Handy in the browser's developer console: type `store.get()` to see the app state.
  window.app = app;
  window.map = campusMap.map;
  window.store = store;
  window.CONFIG = CONFIG;

  keepAppOnPhone(); // next time, the app opens from the phone's own copy
}

startApp().catch(showStartupError);
