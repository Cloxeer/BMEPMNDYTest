/**
 * @file js/map.js
 * @summary Builds the colour campus map, highlights NMSU's class places, and
 *          draws an Apple-style info badge on each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the colour OpenFreeMap basemap,
 *                (2) fades everything that isn't an NMSU class place and outlines
 *                    + names the places that are,
 *                (3) keeps dragging inside the Las Cruces places,
 *                (4) draws a crimson "i" badge on each building; the selected one
 *                    gets a red ring,
 *                (5) tells the store when a building or the map is tapped.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js, and
 *                three files made by tools/build_campuses.py:
 *                data/campuses.geojson, data/campus-labels.geojson,
 *                data/outside-mask.geojson. (All shape math happens in that
 *                script, so this file only draws.)
 * CONTROLS     : the #map element, the campus layers, the building badges.
 * USED BY      : js/app.js, js/locations.js (showProperty)
 *
 * WHY THE BADGE IS A MAP LAYER, NOT AN HTML MARKER: a DOM marker is moved by
 * JavaScript every frame and visibly lags while you drag. A map layer is moved
 * by the GPU together with the map, so it stays welded in place.
 */

import { CONFIG } from './config.js';

/**
 * Every [lng, lat] point in a Polygon or MultiPolygon, as one flat list.
 * @param {object} geometry - GeoJSON geometry
 * @returns {number[][]}
 */
function pointsOf(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flat(2);
}

/**
 * Rectangle around a list of [lng, lat] points, plus a margin.
 * @param {number[][]} points
 * @param {number} pad - degrees added on every side
 * @returns {number[][]} [ [minLng, minLat], [maxLng, maxLat] ]
 */
function boundsOf(points, pad) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

/**
 * Draw the round "i" badge once, as a picture the map can stamp on buildings.
 * Drawn at 2x so it stays sharp on phone screens.
 * @param {boolean} selected - true adds a red ring to show it's the chosen one
 * @returns {object} {width, height, data} image for map.addImage
 */
function drawInfoBadge(selected) {
  const size = selected ? 36 : 28; // the selected badge is bigger to fit the ring
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  const r = size / 2;

  if (selected) {
    // outer red ring
    g.beginPath();
    g.arc(r, r, r - 1, 0, Math.PI * 2);
    g.fillStyle = CONFIG.selectedRing;
    g.fill();
  }

  // white border, then the crimson centre (same on both badges)
  g.beginPath();
  g.arc(r, r, 13, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.beginPath();
  g.arc(r, r, 11, 0, Math.PI * 2);
  g.fillStyle = CONFIG.crimson;
  g.fill();

  g.fillStyle = '#ffffff';
  g.font = 'italic 700 15px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('i', r, r + 1);

  const img = g.getImageData(0, 0, size * scale, size * scale);
  return { width: img.width, height: img.height, data: img.data };
}

/**
 * Move the map to show one NMSU place. Far places lift the drag fence;
 * nearby ones put it back.
 * @param {maplibregl.Map} map
 * @param {object} feature - one feature from data/campuses.geojson
 */
export function showProperty(map, feature) {
  const nearby = feature.properties.km <= CONFIG.nearbyKm;
  map.setMaxBounds(nearby ? map.__fence : null);
  map.fitBounds(boundsOf(pointsOf(feature.geometry), 0), { padding: 48, maxZoom: 17, duration: 900 });
}

/**
 * Create the map, highlight NMSU, and draw a badge on every building.
 * @param {object} store - shared state from ./store.js
 * @param {Object.<string, object>} byId - buildings keyed by id (each has .center)
 * @param {object} campuses - data/campuses.geojson
 * @param {object} labels - data/campus-labels.geojson
 * @param {object} outside - data/outside-mask.geojson
 * @returns {maplibregl.Map} the live map
 */
export function initMap(store, byId, campuses, labels, outside) {
  // Drag fence: the Las Cruces places plus a small margin.
  const nearby = campuses.features.filter((f) => f.properties.km <= CONFIG.nearbyKm);
  const fence = boundsOf(nearby.flatMap((f) => pointsOf(f.geometry)), 0.01);

  const map = new maplibregl.Map({
    container: 'map',
    style: CONFIG.styleUrl,
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    maxBounds: fence,
    dragRotate: true,
    attributionControl: { compact: true },
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

  /**
   * Give the selected building the red-ringed badge; every other one keeps the plain badge.
   * @param {string|null} id - selected building id
   */
  function showSelected(id) {
    if (!map.getLayer('building-pins')) return; // map still loading
    map.setLayoutProperty('building-pins', 'icon-image',
      ['match', ['get', 'id'], id || '', 'info-badge-selected', 'info-badge']);
  }

  map.on('load', () => {
    // Start with the map credits folded into the small (i) button.
    const credits = document.querySelector('.maplibregl-ctrl-attrib');
    if (credits) {
      credits.removeAttribute('open');
      credits.classList.remove('maplibregl-compact-show');
    }

    // Hide the basemap's business/POI labels: third-party and unverified.
    map.getStyle().layers
      .filter((l) => l['source-layer'] === 'poi')
      .forEach((l) => map.setLayoutProperty(l.id, 'visibility', 'none'));

    // --- NMSU places ---
    map.addSource('outside', { type: 'geojson', data: outside });
    map.addSource('campuses', { type: 'geojson', data: campuses });
    map.addSource('campus-labels', { type: 'geojson', data: labels });

    // 1. Fade everything that isn't a class place (the map still shows through).
    map.addLayer({
      id: 'outside-mute', type: 'fill', source: 'outside',
      paint: { 'fill-color': CONFIG.campus.muteColor, 'fill-opacity': CONFIG.campus.muteOpacity },
    });
    // 2. A light crimson tint and a crimson edge on our places.
    map.addLayer({
      id: 'campus-tint', type: 'fill', source: 'campuses',
      paint: { 'fill-color': CONFIG.campus.tintColor, 'fill-opacity': CONFIG.campus.tintOpacity },
    });
    map.addLayer({
      id: 'campus-edge', type: 'line', source: 'campuses',
      paint: { 'line-color': CONFIG.campus.outlineColor, 'line-width': CONFIG.campus.outlineWidth, 'line-opacity': 0.85 },
    });
    // 3. One name per place, shown when zoomed out.
    map.addLayer({
      id: 'campus-name', type: 'symbol', source: 'campus-labels', maxzoom: 15,
      layout: { 'text-field': ['get', 'Name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-max-width': 8 },
      paint: { 'text-color': CONFIG.crimson, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });

    // --- Building badges (one layer; the selected one swaps to the red-ringed picture) ---
    map.addImage('info-badge', drawInfoBadge(false), { pixelRatio: 2 });
    map.addImage('info-badge-selected', drawInfoBadge(true), { pixelRatio: 2 });
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
    showSelected(store.get().selectedId);

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['building-pins'] });
      if (hits.length) select(hits[0].properties.id);
      else deselect();
    });
    map.on('mouseenter', 'building-pins', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'building-pins', () => (map.getCanvas().style.cursor = ''));
  });

  let lastSelected = null;
  store.subscribe((s) => {
    if (s.selectedId === lastSelected) return;
    lastSelected = s.selectedId;
    showSelected(s.selectedId);
    if (s.selectedId) {
      map.setMaxBounds(fence);
      map.flyTo({ center: byId[s.selectedId].center, zoom: Math.max(map.getZoom(), 16.8), speed: 0.6, essential: true });
    }
  });

  return map;
}
