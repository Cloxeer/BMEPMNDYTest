/**
 * @file js/map/northCompass.js
 * @summary The small compass in the top left corner of the map (Map settings > Compass).
 *
 * WHAT IT DOES : Shows MapLibre's own compass button: its needle always points
 *                north while you turn and tilt the map. Tapping it flies home over
 *                main campus, north up and flat (like Map settings > Home).
 *                It's off at first; the choice is remembered on this device.
 * DEPENDS ON   : maplibre-gl's NavigationControl, ../core/config.js, ../core/store.js,
 *                ../core/storage.js, styles/map.css (its round Apple-style look).
 * CONTROLS     : the compass button.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { readSaved, save } from '../core/storage.js';

export class NorthCompass {
  /**
   * @param {CampusMap} campusMap
   * @param {Compass} compass - stops "Turn map with me" when you tap to go home
   */
  constructor(campusMap, compass) {
    this.campusMap = campusMap;
    this.compass = compass;
    this.settings = CONFIG.mapSettings;
    this.control = new maplibregl.NavigationControl({ showZoom: false, showCompass: true, visualizePitch: true });
    this.shown = false; // is the control on the map now?

    // Bring back this device's choice (on at first, until you switch it off).
    store.setShowCompass(readSaved(this.settings.compassStorageKey) !== 'off');
    store.subscribe((state) => this.update(state));
  }

  /**
   * Add or remove the compass to match the setting, and remember it.
   * @param {object} state
   */
  update(state) {
    if (state.showCompass === this.shown) {
      return;
    }
    this.shown = state.showCompass;
    if (this.shown) {
      this.campusMap.map.addControl(this.control, 'top-left');
      this.takeOverTap();
      save(this.settings.compassStorageKey, 'on');
    } else {
      this.campusMap.map.removeControl(this.control);
      save(this.settings.compassStorageKey, 'off');
    }
  }

  /**
   * MapLibre's compass only turns the map back to north. Ours goes home instead,
   * which also turns it north: catch the tap before MapLibre sees it.
   */
  takeOverTap() {
    const button = this.campusMap.map.getContainer().querySelector('.maplibregl-ctrl-compass');
    button.setAttribute('aria-label', this.settings.compassLabel);
    button.title = this.settings.compassLabel;
    if (button.dataset.home) {
      return; // already listening
    }
    button.dataset.home = 'yes';
    button.addEventListener('click', (event) => {
      event.stopImmediatePropagation(); // MapLibre's own "reset north" doesn't run
      this.compass.setFollow(false);
      this.campusMap.goHome();
    }, true);
  }
}
