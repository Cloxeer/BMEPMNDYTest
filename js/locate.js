/**
 * @file js/locate.js
 * @summary Your location on the map (the blue dot) and which way you face.
 *
 * WHAT IT DOES : Owns MapLibre's GeolocateControl: turns your location on and
 *                off, tells listeners when it changes (so the Map settings
 *                toggle is always accurate), and explains when location is
 *                blocked or you're off the campus map. Also sets up the compass
 *                (js/heading.js) for the facing beam and "Turn map with me".
 *                There's no button in here: the Map settings panel
 *                (js/mapSettings.js) and directions (js/directions.js) call it.
 * DEPENDS ON   : maplibre-gl's GeolocateControl (does the GPS work and draws
 *                the dot), ./config.js, ./heading.js.
 *                Browsers only share location on https or localhost.
 * CONTROLS     : the location dot.
 * USED BY      : js/app.js (hands it to js/mapSettings.js and js/directions.js)
 *
 * WHY A HIDDEN CONTROL: MapLibre's GeolocateControl already handles
 * permissions, accuracy and the blue dot. We keep its own button hidden
 * (styles/app.css) and drive it from our Map settings panel instead.
 */

import { CONFIG } from './config.js';
import { initHeading } from './heading.js';

/**
 * Wire location.
 * @param {Framework7} app - for the "location unavailable" message
 * @param {maplibregl.Map} map
 * @returns {object} { isOn, setOn, showMyLocation, onChange, heading }
 */
export function initLocate(app, map) {
  const settings = CONFIG.locate;
  const listeners = [];

  const locator = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true }, // precise GPS, not a rough network guess
    trackUserLocation: true, // keep following while you walk
    fitBoundsOptions: { maxZoom: settings.zoom }, // how close to zoom in on you
  });
  map.addControl(locator);
  const heading = initHeading(map);

  /**
   * Is location on? MapLibre keeps this in _watchState ('OFF' when off; it stays
   * on while you pan away, which MapLibre calls 'BACKGROUND'). It isn't public,
   * but it's the only accurate answer, and our MapLibre version is pinned (4.7.1).
   * @returns {boolean}
   */
  function isOn() {
    return locator._watchState !== undefined && locator._watchState !== 'OFF';
  }

  /** Tell listeners (the Map settings toggle) the current on/off state. */
  function announce() {
    listeners.forEach((fn) => fn(isOn()));
  }

  /** @param {string} text - explain why we can't show the location */
  function explain(text) {
    app.dialog.alert(text, settings.noLocationTitle);
    announce();
  }

  /**
   * Turn location on or off.
   * @param {boolean} on
   */
  function setOn(on) {
    if (on === isOn()) return;
    if (on) heading.start(); // part of the same tap, so iPhone can ask for the compass too
    // trigger() moves MapLibre to its next state; panned-away ('BACKGROUND') needs two presses to reach OFF.
    for (let presses = 0; presses < 2 && isOn() !== on; presses += 1) {
      if (!locator.trigger()) {
        explain(settings.noLocationText); // still starting up, or location isn't supported
        return;
      }
    }
    announce();
  }

  locator.on('geolocate', (position) => heading.fromGps(position.coords));
  ['trackuserlocationstart', 'trackuserlocationend', 'geolocate'].forEach((name) => locator.on(name, announce));
  locator.on('error', () => explain(settings.noLocationText));
  locator.on('outofmaxbounds', () => explain(settings.outsideText));

  return {
    isOn,
    setOn,
    /** Show and follow your location (from "Get directions"); does nothing if it's already on. */
    showMyLocation() {
      setOn(true);
    },
    /** @param {(on: boolean) => void} fn - told whenever location turns on or off */
    onChange(fn) {
      listeners.push(fn);
    },
    heading,
  };
}
