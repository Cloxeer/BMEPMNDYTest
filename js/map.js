/**
 * @file js/map.js
 * @summary Builds the colour campus map, highlights NMSU, and draws an
 *          Apple-style info button on each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the colour OpenFreeMap basemap,
 *                (2) tints the REAL NMSU boundary and fades everything outside,
 *                (3) fences dragging to the real campus (plus a margin),
 *                (4) draws a crimson "i" badge on each building,
 *                (5) tells the store when a building or the map is tapped.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js,
 *                data/campus.geojson (real OpenStreetMap boundary).
 * CONTROLS     : the #map element, the campus highlight, the building badges.
 * USED BY      : js/app.js
 *
 * WHY THE BADGE IS DRAWN, NOT AN HTML MARKER: an HTML marker is a DOM element
 * that JavaScript has to re-position every frame, so it visibly lags behind the
 * map while you drag. Drawing it as a map layer means the GPU moves it together
 * with the map, so it never slides out of place.
 */

import { CONFIG } from './config.js';

/**
 * Turn the buildings into GeoJSON points the map can draw.
 * @param {Object.<string, object>} byId - buildings keyed by id
 * @returns {object} a GeoJSON FeatureCollection
 */
function buildingsToPoints(byId) {
  return {
    type: 'FeatureCollection',
    features: Object.values(byId).map((b) => ({
      type: 'Feature',
      properties: { id: b.id },
      geometry: { type: 'Point', coordinates: b.center },
    })),
  };
}

/**
 * Draw the crimson "i" badge once, as a picture the map can stamp on each
 * building. Drawn at 2x so it stays sharp on phone screens.
 * @param {number} size - badge width in screen pixels
 * @returns {object} an image MapLibre can use ({width, height, data})
 */
function drawInfoBadge(size) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = size * scale;
  canvas.height = size * scale;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);

  const r = size / 2;
  g.beginPath();
  g.arc(r, r, r - 2, 0, Math.PI * 2);
  g.fillStyle = CONFIG.crimson;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = '#ffffff';
  g.stroke();

  g.fillStyle = '#ffffff';
  g.font = 'italic 700 15px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('i', r, r + 1);

  const img = g.getImageData(0, 0, size * scale, size * scale);
  return { width: img.width, height: img.height, data: img.data };
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
 * Create the map, highlight campus, and draw a badge on every building.
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
    // --- Campus highlight, from the real OpenStreetMap boundary. ---
    map.addSource('campus', { type: 'geojson', data: campus });
    map.addSource('outside', { type: 'geojson', data: makeOutsideMask(ring) });

    map.addLayer({
      id: 'outside-mute',
      type: 'fill',
      source: 'outside',
      paint: { 'fill-color': CONFIG.campus.muteColor, 'fill-opacity': CONFIG.campus.muteOpacity },
    });
    map.addLayer({
      id: 'campus-tint',
      type: 'fill',
      source: 'campus',
      paint: { 'fill-color': CONFIG.campus.tintColor, 'fill-opacity': CONFIG.campus.tintOpacity },
    });
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

    // --- Building badges, drawn by the GPU so they never lag. ---
    map.addImage('info-badge', drawInfoBadge(28), { pixelRatio: 2 });
    map.addSource('buildings', { type: 'geojson', data: buildingsToPoints(byId) });

    map.addLayer({
      id: 'building-pins',
      type: 'symbol',
      source: 'buildings',
      layout: { 'icon-image': 'info-badge', 'icon-allow-overlap': true, 'icon-size': 1 },
    });
    // The selected building gets the same badge, just bigger.
    map.addLayer({
      id: 'building-pin-selected',
      type: 'symbol',
      source: 'buildings',
      filter: ['==', ['get', 'id'], ''],
      layout: { 'icon-image': 'info-badge', 'icon-allow-overlap': true, 'icon-size': 1.3 },
    });

    // Tap a badge to select it; tap empty map to clear.
    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['building-pins'] });
      if (hits.length) select(hits[0].properties.id);
      else deselect();
    });
    map.on('mouseenter', 'building-pins', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'building-pins', () => (map.getCanvas().style.cursor = ''));

    // Show the current selection now that the layers exist.
    applySelection(store.get().selectedId);
  });

  /**
   * Make the selected building's badge the big one.
   * @param {string|null} id - the selected building id
   */
  function applySelection(id) {
    if (!map.getLayer('building-pin-selected')) return;
    map.setFilter('building-pin-selected', ['==', ['get', 'id'], id || '']);
  }

  // Fly to the building whenever the selection changes.
  let lastSelected = null;
  store.subscribe((s) => {
    if (s.selectedId === lastSelected) return;
    lastSelected = s.selectedId;
    applySelection(s.selectedId);

    if (s.selectedId) {
      const b = byId[s.selectedId];
      map.flyTo({ center: b.center, zoom: Math.max(map.getZoom(), 16.8), speed: 0.6, essential: true });
    }
  });

  return map;
}
