/**
 * @file js/pages/menu.js
 * @summary The full-screen menu: Map, Locations, Other Locations, Settings.
 *
 * WHAT IT DOES : The menu button (top left) fades the menu in, one word after
 *                another. The page you're on is underlined. Tapping a page closes
 *                the menu and opens that page; closing a page takes you back to the map.
 *                Each page is built in a quiet moment after start-up (or when first opened,
 *                if that comes sooner), so neither starting the app nor the first tap on a
 *                page has to do it.
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

    // "Swap filters" in the Map filters button (js/bottomBar/mapFiltersButton.js).
    document.addEventListener('open-map-filters-settings', () => {
      this.underline('settings');
      this.openPage('settings');
      document.querySelector('#filter-options-title').scrollIntoView({ block: 'start' });
    });
  }

  /**
   * Open a page (built ahead of time by buildPagesWhenIdle, or now if it hasn't been yet).
   * @param {string} name - 'locations', 'other' or 'settings'
   */
  openPage(name) {
    this.buildPage(name);
    this.pages[name].open();
  }

  /**
   * Make a page once: its Framework7 popup and, for Locations and Other Locations, its lists.
   * @param {string} name - 'locations', 'other' or 'settings'
   */
  buildPage(name) {
    if (this.pages[name]) {
      return; // already made
    }
    this.pages[name] = this.app.popup.create({ el: POPUP_IDS[name] });
    this.pages[name].on('closed', () => this.underline('map'));
    if (name === 'locations') {
      new LocationsPage(this.getPlaces(), this.pages[name]);
    } else if (name === 'other') {
      new OtherLocationsPage(this.campuses, this.pages[name], this.campusMap);
    }
  }

  /**
   * Build every page in quiet moments after start-up (js/main.js calls this once every place has
   * loaded), so the first tap on a page only has to show it. One page per quiet moment; stops
   * by itself when all are built.
   */
  buildPagesWhenIdle() {
    const later = window.requestIdleCallback || ((work) => setTimeout(work, 200));
    const waiting = ['settings', 'locations', 'other'];
    const next = () => {
      const name = waiting.shift();
      if (name) {
        this.buildPage(name);
        later(next);
      }
    };
    later(next);
  }

  /** @param {string} current - underline this page's word: 'map', 'locations', 'other' or 'settings' */
  underline(current) {
    for (const name of PAGE_NAMES) {
      document.querySelector('#menu-' + name).classList.toggle('is-current', name === current);
    }
  }
}
