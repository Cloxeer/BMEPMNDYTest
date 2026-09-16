/**
 * @file js/map.js
 * @summary Builds the draggable campus map and outlines the buildings on it.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the clean OpenFreeMap basemap,
 *                (2) draws a crimson OUTLINE around each building,
 *                (3) drops a crimson pin on the selected building,
 *                (4) tells the store when the user taps a building or empty map.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js
 * CONTROLS     : the #map element and its building layers/pin.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';

/**
 * Make the crimson map-pin element used for the selected building.
 * @returns {HTMLElement}
 */
function makePinElement() {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.innerHTML =
    '<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 0C6.3 0 0 6.1 0 13.7 0 23.9 14 38 14 38s14-14.1 14-24.3C28 6.1 21.7 0 14 0z" fill="#8C0B42"/>' +
    '<circle cx="14" cy="13.5" r="5" fill="#fff"/></svg>';
  return el;
}

/**
 * Create the map, outline the buildings, and wire up tapping.
 * @param {object} store - the shared state from ./store.js
 * @param {object} geojson - the parsed data/buildings.geojson (for drawing)
 * @param {Object.<string, object>} byId - buildings keyed by id (has .center)
 * @returns {maplibregl.Map} the live map
 */
export function initMap(store, geojson, byId) {
  const map = new maplibregl.Map({
    container: 'map',
    style: CONFIG.styleUrl,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: CONFIG.maxBounds,
    dragRotate: true,
  });

  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  const pin = new maplibregl.Marker({ element: makePinElement(), anchor: 'bottom' });
  let pinOnMap = false;

  /** Select a building by id (opens its sheet on the first floor). */
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

  map.on('load', () => {
    // Draw a soft crimson fill + a bold crimson outline for every building.
    map.addSource('buildings', { type: 'geojson', data: geojson });
    map.addLayer({
      id: 'building-fill',
      type: 'fill',
      source: 'buildings',
      paint: { 'fill-color': CONFIG.crimson, 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: 'building-outline',
      type: 'line',
      source: 'buildings',
      paint: { 'line-color': CONFIG.crimson, 'line-width': 2.5 },
    });

    // Tap a building to select it; tap empty space to clear.
    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['building-fill'] });
      if (hits.length) select(hits[0].properties.id);
      else deselect();
    });

    // Finger cursor over buildings.
    map.on('mouseenter', 'building-fill', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'building-fill', () => (map.getCanvas().style.cursor = ''));
  });

  // Move the pin + fly to the building whenever the selection changes.
  let lastSelected = null;
  store.subscribe((s) => {
    if (s.selectedId === lastSelected) return;
    lastSelected = s.selectedId;

    if (s.selectedId) {
      const b = byId[s.selectedId];
      pin.setLngLat(b.center).addTo(map);
      pinOnMap = true;
      map.flyTo({ center: b.center, zoom: Math.max(map.getZoom(), 17), speed: 0.6, essential: true });
    } else if (pinOnMap) {
      pin.remove();
      pinOnMap = false;
    }
  });

  return map;
}
