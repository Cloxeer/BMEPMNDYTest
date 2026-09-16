/**
 * @file js/locate.js
 * @summary The round location button to the left of the pill.
 *
 * WHAT IT DOES : Tap it: the map asks for your precise (GPS) location, shows
 *                you as a blue dot and follows you. Tap again to stop.
 *                If location is blocked, or you're off the campus map, it says so.
 * DEPENDS ON   : maplibre-gl's GeolocateControl (does the GPS work and draws
 *                the dot), ./config.js, #locate-btn in index.html.
 *                Browsers only share location on https or localhost.
 * CONTROLS     : #locate-btn.
 * USED BY      : js/app.js
 *
 * WHY A HIDDEN CONTROL: MapLibre's GeolocateControl already handles
 * permissions, accuracy and the blue dot. We keep its own button hidden
 * (styles/app.css) and press it from our pill-style button instead.
 */

import { CONFIG } from './config.js';

/**
 * Wire the location button.
 * @param {Framework7} app - for the "location unavailable" message
 * @param {maplibregl.Map} map
 */
export function initLocate(app, map) {
  const button = document.querySelector('#locate-btn');
  const icon = button.querySelector('i');
  const settings = CONFIG.locate;

  const locator = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true }, // precise GPS, not a rough network guess
    trackUserLocation: true, // keep following while you walk
    fitBoundsOptions: { maxZoom: settings.zoom }, // how close to zoom in on you
  });
  map.addControl(locator);

  /** @param {boolean} on - is your location being shown? */
  function setActive(on) {
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', String(on));
    icon.textContent = on ? 'location_fill' : 'location';
  }

  /** @param {string} text - explain why we can't show the location */
  function explain(text) {
    setActive(false);
    app.dialog.alert(text, settings.noLocationTitle);
  }

  button.addEventListener('click', () => {
    // trigger() returns false while the control is still starting up or location isn't supported.
    if (!locator.trigger()) explain(settings.noLocationText);
  });

  locator.on('trackuserlocationstart', () => setActive(true));
  locator.on('trackuserlocationend', () => setActive(false));
  locator.on('error', () => explain(settings.noLocationText));
  locator.on('outofmaxbounds', () => explain(settings.outsideText));
}
