/**
 * @file js/map.js
 * @summary Builds the draggable campus map with an Apple-style info button on
 *          each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the clean OpenFreeMap basemap,
 *                (2) fences the map to the NMSU campus corners,
 *                (3) puts a crimson "i" info button ON each building,
 *                (4) tells the store when a building is tapped or the map is
 *                    tapped (which clears the selection).
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js
 * CONTROLS     : the #map element and the building info buttons.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';

/**
 * Build one Apple-style info button (a crimson circle with a white "i").
 * @returns {HTMLElement}
 */
function makeInfoButton() {
  const el = document.createElement('button');
  el.className = 'poi';
  el.type = 'button';
  el.setAttribute('aria-label', 'Building info');
  el.innerHTML = '<span class="poi-i">i</span>';
  return el;
}

/**
 * Work out a rectangle that contains all the given points (plus a little pad).
 * @param {number[][]} points - array of [lng, lat]
 * @param {number} pad - degrees of padding to add on every side
 * @returns {number[][]} [ [minLng, minLat], [maxLng, maxLat] ]
 */
function boundsFromPoints(points, pad) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  return [
    [minLng - pad, minLat - pad],
    [maxLng + pad, maxLat + pad],
  ];
}

/**
 * Create the map and drop an info button on every building.
 * @param {object} store - the shared state from ./store.js
 * @param {Object.<string, object>} byId - buildings keyed by id (each has .center)
 * @returns {maplibregl.Map} the live map
 */
export function initMap(store, byId) {
  const map = new maplibregl.Map({
    container: 'map',
    style: CONFIG.styleUrl,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: boundsFromPoints(CONFIG.campusOutline, 0.003),
    dragRotate: true,
  });

  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  /** Select a building (opens its sheet on the first floor). */
  function select(id) {
    const b = byId[id];
    store.set({
      selectedId: id,
      sheetOpen: true,
      mode: 'solving',
      activeFloor: (b.floors && b.floors[0]) || null,
    });
  }

  /** Clear the selection (tapped empty map). */
  function deselect() {
    store.set({ selectedId: null, sheetOpen: false, mode: 'idle', activeFloor: null });
  }

  // Place one info button per building, exactly on the building's location.
  const buttons = {};
  Object.values(byId).forEach((b) => {
    const el = makeInfoButton();
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      select(b.id);
    });
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(b.center).addTo(map);
    buttons[b.id] = el;
  });

  // Tapping the map (not a button) clears the selection.
  map.on('click', () => deselect());

  // When the selection changes: highlight the right button + fly to it.
  let lastSelected = null;
  store.subscribe((s) => {
    if (s.selectedId === lastSelected) return;
    lastSelected = s.selectedId;

    Object.keys(buttons).forEach((id) => buttons[id].classList.toggle('is-selected', id === s.selectedId));

    if (s.selectedId) {
      const b = byId[s.selectedId];
      map.flyTo({ center: b.center, zoom: Math.max(map.getZoom(), 16.8), speed: 0.6, essential: true });
    }
  });

  return map;
}
