/**
 * @file js/map.js
 * @summary Builds the colour campus map, highlights every NMSU property, and
 *          draws an Apple-style info badge on each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the colour OpenFreeMap basemap,
 *                (2) tints + outlines the official NMSU properties (minus the
 *                    ones excluded in config.js) and fades
 *                    everything that isn't NMSU,
 *                (3) keeps dragging inside the Las Cruces properties,
 *                (4) draws a crimson "i" badge on each building,
 *                (5) tells the store when a building or the map is tapped.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js,
 *                official NMSU property + leased-parcel data, golf course outline.
 * CONTROLS     : the #map element, property highlight + labels, building badges.
 * USED BY      : js/app.js, js/locations.js (showProperty)
 *
 * WHY THE BADGE IS A MAP LAYER, NOT AN HTML MARKER: a DOM marker is moved by
 * JavaScript every frame and visibly lags while you drag. A map layer is moved
 * by the GPU together with the map, so it stays welded in place.
 */

import { CONFIG } from './config.js';

/** Every outer/inner ring of a Polygon or MultiPolygon, as one flat list. */
function ringsOf(geometry) {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

/**
 * Rectangle around a list of [lng, lat] points, plus a margin.
 * @param {number[][]} points
 * @param {number} pad - degrees added on every side
 * @returns {number[][]} [ [minLng, minLat], [maxLng, maxLat] ]
 */
function boundsOf(points, pad) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  return [[minLng - pad, minLat - pad], [maxLng + pad, maxLat + pad]];
}

/**
 * A large box with every NMSU property punched out of it. Filled with
 * translucent white, it fades everything that isn't NMSU.
 * (A world-sized box won't cut holes correctly in MapLibre, so it is ~1°.)
 * @param {object} campuses - the official property FeatureCollection
 * @returns {object} GeoJSON polygon feature
 */
function makeOutsideMask(campuses) {
  const [lng, lat] = CONFIG.center;
  const [[w, s], [e, n]] = [[lng - 1, lat - 1], [lng + 1, lat + 1]];
  const holes = [];
  campuses.features.forEach((f) => {
    ringsOf(f.geometry).forEach((ring) => {
      const inside = ring.every(([x, y]) => x > w && x < e && y > s && y < n);
      if (inside) holes.push([...ring].reverse()); // holes wind the other way
    });
  });
  const outer = [[w, s], [e, s], [e, n], [w, n], [w, s]];
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, ...holes] } };
}

/** The drag fence: every property within CONFIG.nearbyKm of main campus. */
function nearbyFence(campuses) {
  const points = campuses.features
    .filter((f) => f.properties.km <= CONFIG.nearbyKm)
    .flatMap((f) => ringsOf(f.geometry).flat());
  return boundsOf(points, 0.01);
}

/**
 * Draw the crimson "i" badge once (at 2x for sharp phone screens).
 * @param {number} size - badge width in screen pixels
 * @returns {object} {width, height, data} image for map.addImage
 */
function drawInfoBadge(size) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
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
 * Move the map to show one NMSU property. Far properties lift the drag fence;
 * nearby ones put it back.
 * @param {maplibregl.Map} map
 * @param {object} feature - one feature from nmsu-campuses.geojson
 */
export function showProperty(map, feature) {
  const nearby = feature.properties.km <= CONFIG.nearbyKm;
  map.setMaxBounds(nearby ? map.__fence : null);
  map.fitBounds(boundsOf(ringsOf(feature.geometry).flat(), 0), { padding: 48, maxZoom: 17, duration: 900 });
}

/**
 * Create the map, highlight NMSU, and draw a badge on every building.
 * @param {object} store - shared state from ./store.js
 * @param {Object.<string, object>} byId - buildings keyed by id (each has .center)
 * @param {object} campuses - NMSU properties to highlight
 * @param {object} leased - NMSU parcels leased out (faded, not highlighted)
 * @returns {maplibregl.Map} the live map
 */
export function initMap(store, byId, campuses, leased) {
  const fence = nearbyFence(campuses);

  const map = new maplibregl.Map({
    container: 'map',
    style: CONFIG.styleUrl,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: fence,
    dragRotate: true,
  });
  map.__fence = fence; // remembered so showProperty() can restore it
  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  /** Select a building (opens its sheet on its first floor). */
  function select(id) {
    const b = byId[id];
    store.set({ selectedId: id, sheetOpen: true, mode: 'solving', activeFloor: (b.floors && b.floors[0]) || null });
  }

  /** Clear the selection (tapped empty map). */
  function deselect() {
    store.set({ selectedId: null, sheetOpen: false, mode: 'idle', activeFloor: null });
  }

  map.on('load', () => {
    // --- Hide unverified third-party business/POI labels from the basemap. ---
    if (CONFIG.hideBasemapPOIs) {
      map.getStyle().layers
        .filter((l) => l['source-layer'] === 'poi')
        .forEach((l) => map.setLayoutProperty(l.id, 'visibility', 'none'));
    }

    // --- NMSU properties: fade the rest, tint + outline + name ours. ---
    map.addSource('campuses', { type: 'geojson', data: campuses });
    map.addSource('outside', { type: 'geojson', data: makeOutsideMask(campuses) });

    map.addLayer({
      id: 'outside-mute', type: 'fill', source: 'outside',
      paint: { 'fill-color': CONFIG.campus.muteColor, 'fill-opacity': CONFIG.campus.muteOpacity },
    });
    map.addLayer({
      id: 'campus-tint', type: 'fill', source: 'campuses',
      paint: { 'fill-color': CONFIG.campus.tintColor, 'fill-opacity': CONFIG.campus.tintOpacity },
    });
    map.addLayer({
      id: 'campus-edge', type: 'line', source: 'campuses',
      paint: { 'line-color': CONFIG.campus.outlineColor, 'line-width': CONFIG.campus.outlineWidth, 'line-opacity': 0.85 },
    });
    // Land NMSU leases out (charter high schools, office centre...) is faded
    // like everything else that isn't a school place.
    map.addSource('leased', { type: 'geojson', data: leased });
    map.addLayer({
      id: 'leased-mute', type: 'fill', source: 'leased',
      paint: { 'fill-color': CONFIG.campus.muteColor, 'fill-opacity': CONFIG.campus.muteOpacity + 0.2 },
    });
    // Property names ("East Campus", "Horse Farm"...) when zoomed out.
    map.addLayer({
      id: 'campus-name', type: 'symbol', source: 'campuses', maxzoom: 15,
      layout: {
        'symbol-placement': 'point',
        'text-field': ['get', 'Name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
        'text-max-width': 8,
      },
      paint: { 'text-color': CONFIG.crimson, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });

    // --- Building badges (GPU-drawn, never lag). ---
    map.addImage('info-badge', drawInfoBadge(28), { pixelRatio: 2 });
    map.addSource('buildings', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: Object.values(byId).map((b) => ({
          type: 'Feature', properties: { id: b.id }, geometry: { type: 'Point', coordinates: b.center },
        })),
      },
    });
    map.addLayer({
      id: 'building-pins', type: 'symbol', source: 'buildings',
      layout: { 'icon-image': 'info-badge', 'icon-allow-overlap': true },
    });
    map.addLayer({
      id: 'building-pin-selected', type: 'symbol', source: 'buildings',
      filter: ['==', ['get', 'id'], ''],
      layout: { 'icon-image': 'info-badge', 'icon-allow-overlap': true, 'icon-size': 1.3 },
    });

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['building-pins'] });
      if (hits.length) select(hits[0].properties.id);
      else deselect();
    });
    map.on('mouseenter', 'building-pins', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'building-pins', () => (map.getCanvas().style.cursor = ''));

    applySelection(store.get().selectedId);
  });

  /** Make the selected building's badge the big one. */
  function applySelection(id) {
    if (map.getLayer('building-pin-selected')) {
      map.setFilter('building-pin-selected', ['==', ['get', 'id'], id || '']);
    }
  }

  let lastSelected = null;
  store.subscribe((s) => {
    if (s.selectedId === lastSelected) return;
    lastSelected = s.selectedId;
    applySelection(s.selectedId);
    if (s.selectedId) {
      map.setMaxBounds(fence);
      map.flyTo({ center: byId[s.selectedId].center, zoom: Math.max(map.getZoom(), 16.8), speed: 0.6, essential: true });
    }
  });

  return map;
}
