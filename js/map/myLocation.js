/**
 * @file js/map/myLocation.js
 * @summary Your location on the map (the blue dot), and which way you face (./compass.js).
 *
 * WHAT IT DOES : Owns MapLibre's GeolocateControl: turns your location on and off,
 *                tells listeners when that changes (so the Map settings toggle is
 *                always right), and explains when location is blocked or you're
 *                off the campus map.
 *                There's no button in here: Map settings (js/bottomBar/mapSettingsButton.js)
 *                and directions (js/directions/directions.js) use it.
 * DEPENDS ON   : maplibre-gl's GeolocateControl (does the GPS work and draws the dot),
 *                ../core/config.js, ./compass.js.
 *                Browsers only share your location on https or localhost.
 * CONTROLS     : the location dot.
 * USED BY      : js/main.js (hands it to Map settings and directions)
 *
 * WHY A HIDDEN CONTROL: MapLibre's GeolocateControl already handles permissions,
 * accuracy and the blue dot. Its own button is hidden (styles/mapButtons.css)
 * and our Map settings panel drives it instead.
 */

import { CONFIG } from '../core/config.js';
import { Compass } from './compass.js';

export class MyLocation {
  /**
   * @param {Framework7} app - for the "location unavailable" message
   * @param {maplibregl.Map} map
   */
  constructor(app, map) {
    this.app = app;
    this.settings = CONFIG.locate;
    this.listeners = []; // told whenever location turns on or off

    this.locator = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true }, // precise GPS, not a rough network guess
      trackUserLocation: true, // keep following while you walk
      fitBoundsOptions: { maxZoom: this.settings.zoom }, // how close to zoom in on you
    });
    map.addControl(this.locator);
    this.compass = new Compass(map);

    this.locator.on('geolocate', (position) => this.compass.fromGps(position.coords));
    this.locator.on('trackuserlocationstart', () => this.tellListeners());
    this.locator.on('trackuserlocationend', () => this.tellListeners());
    this.locator.on('geolocate', () => this.tellListeners());
    this.locator.on('error', () => this.explain(this.settings.noLocationText));
    this.locator.on('outofmaxbounds', () => this.explain(this.settings.outsideText));
  }

  /**
   * Is location on? MapLibre keeps this in _watchState: 'OFF' when off. (It stays
   * on while you pan away, which MapLibre calls 'BACKGROUND'.) It isn't public,
   * but it's the only accurate answer, and our MapLibre version is pinned (4.7.1).
   * @returns {boolean}
   */
  isOn() {
    return this.locator._watchState !== undefined && this.locator._watchState !== 'OFF';
  }

  /** Tell listeners (the Map settings toggle) whether location is on. */
  tellListeners() {
    for (const listener of this.listeners) {
      listener(this.isOn());
    }
  }

  /** @param {string} text - explain why we can't show your location */
  explain(text) {
    this.app.dialog.alert(text, this.settings.noLocationTitle);
    this.tellListeners();
  }

  /**
   * Turn location on or off.
   * @param {boolean} on
   */
  setOn(on) {
    if (on === this.isOn()) {
      return;
    }
    if (on) {
      this.compass.start(); // part of the same tap, so iPhone can ask for the compass too
    }
    // trigger() moves MapLibre to its next state. Panned away ('BACKGROUND') needs two presses to reach OFF.
    for (let presses = 0; presses < 2 && this.isOn() !== on; presses += 1) {
      const worked = this.locator.trigger();
      if (!worked) {
        this.explain(this.settings.noLocationText); // still starting up, or location isn't supported
        return;
      }
    }
    this.tellListeners();
  }

  /** Show and follow your location (from "Get directions"). Does nothing if it's already on. */
  showMyLocation() {
    this.setOn(true);
  }

  /** @param {(on: boolean) => void} listener - told whenever location turns on or off */
  onChange(listener) {
    this.listeners.push(listener);
  }
}
