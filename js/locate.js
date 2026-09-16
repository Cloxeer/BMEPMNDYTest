/**
 * @file js/locate.js
 * @summary The round location button to the left of the pill.
 *
 * WHAT IT DOES : Tap it: the map asks for your precise (GPS) location, shows
 *                you as a blue dot and follows you. Tap again to stop.
 *                If location is blocked, or you're off the campus map, it says so.
 *                It only shows while you're looking at the map (hidden while a sheet is open).
 *                A beam on the dot shows which way you're facing (js/heading.js).
 * DEPENDS ON   : ./store.js (is a sheet open?), maplibre-gl's GeolocateControl (does the GPS work and draws
 *                the dot), ./config.js, #locate-btn in index.html.
 *                Browsers only share location on https or localhost.
 * CONTROLS     : #locate-btn.
 * USED BY      : js/app.js (which hands showMyLocation to js/directions.js)
 *
 * WHY A HIDDEN CONTROL: MapLibre's GeolocateControl already handles
 * permissions, accuracy and the blue dot. We keep its own button hidden
 * (styles/app.css) and press it from our pill-style button instead.
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { initHeading } from './heading.js';

/**
 * Wire the location button.
 * @param {Framework7} app - for the "location unavailable" message
 * @param {maplibregl.Map} map
 * @returns {{ showMyLocation: () => void }} for js/directions.js
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
  const heading = initHeading(map); // the beam showing which way you face

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
    heading.start(); // needs this tap on iPhone
    // trigger() returns false while the control is still starting up or location isn't supported.
    if (!locator.trigger()) explain(settings.noLocationText);
  });
  locator.on('geolocate', (position) => heading.fromGps(position.coords));

  locator.on('trackuserlocationstart', () => setActive(true));
  locator.on('trackuserlocationend', () => setActive(false));
  locator.on('error', () => explain(settings.noLocationText));
  locator.on('outofmaxbounds', () => explain(settings.outsideText));

  // Only on the map: fade out while the building sheet covers it.
  store.subscribe((state) => {
    button.classList.toggle('is-hidden', state.sheetOpen);
    button.inert = state.sheetOpen; // can't be tapped or tabbed to while hidden
  });

  return {
    /** Show and follow your location, unless it's already on (pressing again would turn it off). */
    showMyLocation() {
      heading.start(); // called from the "Get directions" tap, so iPhone can ask for the compass
      if (!button.classList.contains('is-active')) locator.trigger();
    },
  };
}
