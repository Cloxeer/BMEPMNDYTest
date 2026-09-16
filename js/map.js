/**
 * @file js/map.js
 * @summary Builds the colour campus map, highlights NMSU, and puts an
 *          Apple-style info button on each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the colour OpenFreeMap basemap,
 *                (2) tints the REAL NMSU boundary and fades everything outside,
 *                (3) fences dragging to the real campus (plus a margin),
 *                (4) puts a crimson "i" button on each building,
 *                (5) tells the store when a building or the map is tapped.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js,
 *                data/campus.geojson (real OpenStreetMap boundary).
 * CONTROLS     : the #map element, the campus highlight layers, the info buttons.
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
 * Work out a rectangle that contains all the given points (plus a margin).
 * @param {number[][]} ring - array of [lng, lat]
 * @param {number} pad - degrees of margin on every side
 * @returns {number[][]} [ [minLng, minLat], [maxLng, maxLat] ]
 */
function boundsFromRing(ring, pad) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  ring.forEach(([lng, lat]) => {
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
 * Build a big rectangle with the campus cut out of the middle of it.
 * Filling it with translucent white fades everything that is not campus.
 *
 * The rectangle is only ~1 degree bigger than campus, NOT the whole world:
 * a world-sized polygon fails to cut its hole correctly in MapLibre, and the
 * map is fenced to campus anyway so the user can never reach the edge.
 *
 * @param {number[][]} ring - the campus boundary ring
 * @returns {object} a GeoJSON Feature (polygon with a hole)
 */
function makeOutsideMask(ring) {
  const [[minLng, minLat], [maxLng, maxLat]] = boundsFromRing(ring, 1);
  const outer = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
  const hole = [...ring].reverse(); // a hole winds the opposite way
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, hole] } };
}

/**
 * Create the map, highlight campus, and drop an info button on every building.
 * @param {object} store - the shared state from ./store.js
 * @param {Object.<string, object>} byId - buildings keyed by id (each has .center)
 * @param {object} campus - parsed data/campus.geojson (real OSM boundary)
 * @returns {maplibregl.Map} the live map
 */
export function initMap(store, byId, campus) {
  const ring = campus.features[0].geometry.coordinates[0];

  const map = new maplibregl.Map({
    container: 'map',
    style: CONFIG.styleUrl,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: boundsFromRing(ring, 0.004),
    dragRotate: true,
  });

  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  /** Select a building (opens its sheet on its first floor). */
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
    // --- Campus highlight, drawn from the real OpenStreetMap boundary. ---
    map.addSource('campus', { type: 'geojson', data: campus });
    map.addSource('outside', { type: 'geojson', data: makeOutsideMask(ring) });

    // 1. Fade everything that is NOT campus.
    map.addLayer({
      id: 'outside-mute',
      type: 'fill',
      source: 'outside',
      paint: { 'fill-color': CONFIG.campus.muteColor, 'fill-opacity': CONFIG.campus.muteOpacity },
    });
    // 2. A light tint over campus so it reads as "ours".
    map.addLayer({
      id: 'campus-tint',
      type: 'fill',
      source: 'campus',
      paint: { 'fill-color': CONFIG.campus.tintColor, 'fill-opacity': CONFIG.campus.tintOpacity },
    });
    // 3. A crisp crimson edge on the real boundary.
    map.addLayer({
      id: 'campus-edge',
      type: 'line',
      source: 'campus',
      paint: {
        'line-color': CONFIG.campus.outlineColor,
        'line-width': CONFIG.campus.outlineWidth,
        'line-opacity': 0.85,
      },
    });
  });

  // Place one info button per building, on the building's real location.
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
