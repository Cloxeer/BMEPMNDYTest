/**
 * @file js/map.js
 * @summary Builds the draggable NMSU campus map with MapLibre GL.
 *
 * WHAT IT DOES : Creates the WebGL map, applies the campus camera + boundary,
 *                and turns on smooth touch drag / pinch-zoom / tilt.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`, loaded in index.html)
 *                and ./config.js
 * CONTROLS     : the #map element (the whole map surface).
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';

/**
 * Create the map and mount it inside the #map element.
 * @returns {maplibregl.Map} the live, draggable map instance
 */
export function initMap() {
  const map = new maplibregl.Map({
    container: 'map',

    // The simplest possible style: one layer of OpenStreetMap image tiles.
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [CONFIG.tileUrl],
          tileSize: 256,
          attribution: CONFIG.tileAttribution,
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },

    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: CONFIG.maxBounds,
    attributionControl: { compact: true },
    dragRotate: true, // two-finger rotate, for the native-map feel
  });

  // Turn on the "effortless touch & grab" gestures: pinch-zoom, rotate, tilt.
  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  return map;
}
