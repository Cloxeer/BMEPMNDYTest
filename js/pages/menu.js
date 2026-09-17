/**
 * @file js/pages/menu.js
 * @summary The full-screen menu: Map, Locations, Settings.
 *
 * WHAT IT DOES : The menu button (top left) fades the menu in, one word after
 *                another. The page you're on is underlined. Tapping Locations or
 *                Settings closes the menu and opens that page; closing a page
 *                takes you back to the map.
 * DEPENDS ON   : Framework7 (popups), ./locations.js, #menu-popup in index.html.
 * CONTROLS     : #menu-popup, and opening the Locations and Settings pages.
 * USED BY      : js/main.js
 */

import { LocationsPage } from './locations.js';

const PAGE_NAMES = ['map', 'locations', 'settings']; // the menu's words, top to bottom

export class Menu {
  /**
   * @param {Framework7} app
   * @param {object} campuses - data/campuses.geojson (for the Locations page)
   * @param {CampusMap} campusMap
   */
  constructor(app, campuses, campusMap) {
    this.menu = app.popup.create({ el: '#menu-popup' });
    this.menuElement = document.querySelector('#menu-popup');
    this.pages = {
      locations: app.popup.create({ el: '#locations-popup' }),
      settings: app.popup.create({ el: '#settings-popup' }),
    };
    new LocationsPage(campuses, this.pages.locations, campusMap);

    this.underline('map');

    // The menu's words fade in one after another while this class is on (styles/menu.css).
    this.menu.on('open', () => this.menuElement.classList.add('menu-open'));
    this.menu.on('close', () => this.menuElement.classList.remove('menu-open'));
    document.querySelector('#menu-btn').addEventListener('click', () => this.menu.open());

    document.querySelector('#menu-map').addEventListener('click', () => {
      this.underline('map');
      this.menu.close();
    });
    for (const name of ['locations', 'settings']) {
      const page = this.pages[name];
      page.on('closed', () => this.underline('map'));
      document.querySelector('#menu-' + name).addEventListener('click', () => {
        this.underline(name);
        this.menu.close();
        page.open();
      });
    }
  }

  /** @param {string} current - underline this page's word: 'map', 'locations' or 'settings' */
  underline(current) {
    for (const name of PAGE_NAMES) {
      document.querySelector('#menu-' + name).classList.toggle('is-current', name === current);
    }
  }
}
