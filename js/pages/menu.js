/**
 * @file js/pages/menu.js
 * @summary The full-screen menu: Map, Locations, Other Locations, Settings.
 *
 * WHAT IT DOES : The menu button (top left) fades the menu in, one word after
 *                another. The page you're on is underlined. Tapping a page closes
 *                the menu and opens that page; closing a page takes you back to the map.
 *                Each page is built the first time it's opened, so starting the app
 *                stays fast (the Locations page alone is hundreds of rows).
 * DEPENDS ON   : Framework7 (popups), ./locations.js, ./otherLocations.js, #menu-popup in index.html.
 * CONTROLS     : #menu-popup, and opening the Locations, Other Locations and Settings pages.
 * USED BY      : js/main.js
 */

import { LocationsPage } from './locations.js';
import { OtherLocationsPage } from './otherLocations.js';

const PAGE_NAMES = ['map', 'locations', 'other', 'settings']; // the menu's words, top to bottom (#menu-map, ...)
const POPUP_IDS = { locations: '#locations-popup', other: '#other-locations-popup', settings: '#settings-popup' };

export class Menu {
  /**
   * @param {Framework7} app
   * @param {object} campuses - data/campuses.geojson (for the Other Locations page)
   * @param {CampusMap} campusMap
   * @param {() => object[]} getPlaces - every building and place, when the Locations page is opened
   */
  constructor(app, campuses, campusMap, getPlaces) {
    this.app = app;
    this.campuses = campuses;
    this.campusMap = campusMap;
    this.getPlaces = getPlaces;
    this.pages = {}; // the pages built so far, by name
    this.menu = app.popup.create({ el: '#menu-popup' });
    this.menuElement = document.querySelector('#menu-popup');

    this.underline('map');

    // The menu's words fade in one after another while this class is on (styles/menu.css).
    this.menu.on('open', () => this.menuElement.classList.add('menu-open'));
    this.menu.on('close', () => this.menuElement.classList.remove('menu-open'));
    document.querySelector('#menu-btn').addEventListener('click', () => this.menu.open());

    document.querySelector('#menu-map').addEventListener('click', () => {
      this.underline('map');
      this.menu.close();
    });
    for (const name of ['locations', 'other', 'settings']) {
      document.querySelector('#menu-' + name).addEventListener('click', () => {
        this.underline(name);
        this.menu.close();
        this.openPage(name);
      });
    }

    // "More options" in the Map filters button (js/bottomBar/mapFiltersButton.js).
    document.addEventListener('open-map-filters-settings', () => {
      this.underline('settings');
      this.openPage('settings');
      document.querySelector('#filter-options-title').scrollIntoView({ block: 'start' });
    });
  }

  /**
   * Open a page, building it the first time.
   * @param {string} name - 'locations', 'other' or 'settings'
   */
  openPage(name) {
    if (!this.pages[name]) {
      this.pages[name] = this.app.popup.create({ el: POPUP_IDS[name] });
      this.pages[name].on('closed', () => this.underline('map'));
      if (name === 'locations') {
        new LocationsPage(this.getPlaces(), this.pages[name]);
      } else if (name === 'other') {
        new OtherLocationsPage(this.campuses, this.pages[name], this.campusMap);
      }
    }
    this.pages[name].open();
  }

  /** @param {string} current - underline this page's word: 'map', 'locations', 'other' or 'settings' */
  underline(current) {
    for (const name of PAGE_NAMES) {
      document.querySelector('#menu-' + name).classList.toggle('is-current', name === current);
    }
  }
}
