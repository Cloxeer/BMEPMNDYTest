/**
 * @file js/map.js
 * @summary The map: NMSU's class places highlighted, a tappable badge on each building.
 *
 * WHAT IT DOES : (1) creates the MapLibre map on the colour OpenFreeMap basemap,
 *                (2) fades everything that isn't an NMSU class place, and tints,
 *                    outlines and names the places that are,
 *                (3) keeps dragging inside the Las Cruces places,
 *                (4) draws a crimson "i" badge on each building (white ring;
 *                    black ring on the selected one), with the building's name
 *                    above it (can be turned off in Settings: setBuildingNames),
 *                (5) tells the store when a badge or empty map is tapped.
 * DEPENDS ON   : maplibre-gl (global `maplibregl`), ./config.js, ./store.js, and
 *                the files made by tools/build_campuses.py (all shape math
 *                happens there; this file only draws).
 * CONTROLS     : the #map element.
 * USED BY      : js/app.js, js/locations.js, js/directions.js (mapReady), js/settings.js,
 *                js/mapSettings.js (showCampus)
 *
 * WHY BADGES ARE A MAP LAYER, NOT HTML MARKERS: an HTML marker is moved by
 * JavaScript every frame and lags while you drag. A map layer is moved by the
 * GPU with the map, so it stays in place.
 */

import { CONFIG } from './config.js';
import { store } from './store.js';

let map = null; // the live MapLibre map
let fence = null; // drag limits around the Las Cruces places
let markReady = null; // called once the map has loaded and drawn its layers
let namesVisible = true; // building names above the badges (Settings can turn them off)

/** Resolves once the map has loaded and the badges are drawn (js/directions.js waits for it). */
export const mapReady = new Promise((resolve) => {
  markReady = resolve;
});

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
 * Rectangle around some [lng, lat] points, plus a margin.
 * @param {number[][]} points
 * @param {number} padding - degrees added on every side
 * @returns {number[][]} [[west, south], [east, north]]
 */
function boundsOf(points, padding) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    [Math.min(...lngs) - padding, Math.min(...lats) - padding],
    [Math.max(...lngs) + padding, Math.max(...lats) + padding],
  ];
}

/**
 * Draw the round "i" badge as a picture the map can place on buildings.
 * Both badges are the same size, so selecting one never makes it jump.
 * @param {boolean} selected - true = black ring, false = white ring
 * @returns {object} {width, height, data} for map.addImage
 */
function drawBadge(selected) {
  const { size, pixelRatio, ringRadius, centerRadius, selectedCenterRadius } = CONFIG.badge;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * pixelRatio;
  const pen = canvas.getContext('2d');
  pen.scale(pixelRatio, pixelRatio);
  const middle = size / 2;

  pen.beginPath();
  pen.arc(middle, middle, ringRadius, 0, Math.PI * 2);
  pen.fillStyle = selected ? CONFIG.badge.selectedRing : CONFIG.badge.ring;
  pen.fill();

  pen.beginPath();
  pen.arc(middle, middle, selected ? selectedCenterRadius : centerRadius, 0, Math.PI * 2);
  pen.fillStyle = CONFIG.theme.crimson;
  pen.fill();

  pen.fillStyle = CONFIG.theme.white;
  pen.font = CONFIG.badge.letterFont;
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillText(CONFIG.badge.letter, middle, middle + CONFIG.badge.letterOffset);

  const image = pen.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

/**
 * MapLibre shows its credits expanded at first; start them folded into the (i).
 * (MapLibre has no setting for this, so we close its <details> element.)
 */
function foldCredits() {
  const credits = document.querySelector('.maplibregl-ctrl-attrib');
  if (!credits) return;
  credits.removeAttribute('open');
  credits.classList.remove('maplibregl-compact-show');
}

/** Hide the basemap's business labels: third-party and not checked by us. */
function hideBasemapBusinesses() {
  map.getStyle().layers
    .filter((layer) => layer['source-layer'] === CONFIG.map.hiddenBasemapLayer)
    .forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));
}

/**
 * Draw NMSU's class places: fade the rest, then tint, outline and name ours.
 * @param {object} campuses - data/campuses.geojson
 * @param {object} labels - data/campus-labels.geojson
 * @param {object} outside - data/outside-mask.geojson
 */
function drawCampuses(campuses, labels, outside) {
  const settings = CONFIG.map;
  map.addSource('outside', { type: 'geojson', data: outside });
  map.addSource('campuses', { type: 'geojson', data: campuses });
  map.addSource('campus-labels', { type: 'geojson', data: labels });

  map.addLayer({
    id: 'outside-mute', type: 'fill', source: 'outside',
    paint: { 'fill-color': settings.outsideColor, 'fill-opacity': settings.outsideOpacity },
  });
  map.addLayer({
    id: 'campus-tint', type: 'fill', source: 'campuses',
    paint: { 'fill-color': CONFIG.theme.crimson, 'fill-opacity': settings.campusTintOpacity },
  });
  map.addLayer({
    id: 'campus-edge', type: 'line', source: 'campuses',
    paint: { 'line-color': CONFIG.theme.crimson, 'line-width': settings.campusEdgeWidth, 'line-opacity': settings.campusEdgeOpacity },
  });
  map.addLayer({
    id: 'campus-name', type: 'symbol', source: 'campus-labels', maxzoom: settings.labelMaxZoom,
    layout: {
      'text-field': ['get', 'Name'],
      'text-font': [settings.labelFont],
      'text-size': settings.labelSize,
      'text-max-width': settings.labelMaxWidth,
    },
    paint: { 'text-color': CONFIG.theme.crimson, 'text-halo-color': CONFIG.theme.white, 'text-halo-width': settings.labelHaloWidth },
  });
}

/**
 * Draw one badge per building (one layer; the selected one swaps pictures).
 * @param {Object.<string, object>} buildingsById
 */
function drawBadges(buildingsById) {
  const imageOptions = { pixelRatio: CONFIG.badge.pixelRatio };
  map.addImage('info-badge', drawBadge(false), imageOptions);
  map.addImage('info-badge-selected', drawBadge(true), imageOptions);
  map.addSource('buildings', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: Object.values(buildingsById).map((building) => ({
        type: 'Feature', properties: { id: building.id, name: building.name }, geometry: { type: 'Point', coordinates: building.center },
      })),
    },
  });
  map.addLayer({
    id: 'building-pins', type: 'symbol', source: 'buildings',
    layout: { 'icon-image': 'info-badge', 'icon-allow-overlap': true },
  });

  // Names sit just above the badges. Drawn by the GPU like the badges, so they
  // move with the map at full frame rate. When a name would overlap another name
  // or a badge, the map hides it and fades it back in when there's room (zooming in).
  const names = CONFIG.map;
  map.addLayer({
    id: 'building-names', type: 'symbol', source: 'buildings',
    minzoom: names.namesMinZoom,
    layout: {
      visibility: namesVisible ? 'visible' : 'none',
      'text-field': ['get', 'name'],
      'text-font': [names.labelFont],
      // Grows a little as you zoom in, so it stays readable without crowding.
      'text-size': ['interpolate', ['linear'], ['zoom'], names.namesMinZoom, names.nameSizeSmall, names.maxZoom, names.nameSizeLarge],
      'text-max-width': names.nameMaxWidth,
      'text-anchor': 'bottom',
      'text-offset': [0, names.nameOffset],
      'text-padding': names.namePadding,
    },
    paint: {
      'text-color': names.nameColor,
      'text-halo-color': names.nameHalo,
      'text-halo-width': names.nameHaloWidth,
    },
  }, 'building-pins'); // listed under the badges, so badges are placed first and names keep clear of them
}

/**
 * Show or hide the building names above the badges (the Settings switch).
 * @param {boolean} visible
 */
export function setBuildingNames(visible) {
  namesVisible = visible;
  if (map && map.getLayer('building-names')) {
    map.setLayoutProperty('building-names', 'visibility', visible ? 'visible' : 'none');
  }
}

/**
 * Give the selected building the black-ringed badge; every other badge keeps the white ring.
 * @param {string|null} buildingId
 */
function markSelected(buildingId) {
  if (!map.getLayer('building-pins')) return; // still loading; the load step calls this again
  map.setLayoutProperty('building-pins', 'icon-image',
    ['match', ['get', 'id'], buildingId || '', 'info-badge-selected', 'info-badge']);
  // The selected building's name turns crimson.
  map.setPaintProperty('building-names', 'text-color',
    ['match', ['get', 'id'], buildingId || '', CONFIG.theme.crimson, CONFIG.map.nameColor]);
}

/**
 * Tapping a badge selects its building; tapping anywhere else clears the selection.
 * @param {Object.<string, object>} buildingsById
 */
function listenForTaps(buildingsById) {
  map.on('click', (event) => {
    const hits = map.queryRenderedFeatures(event.point, { layers: ['building-pins', 'building-names'] });
    if (hits.length) store.selectBuilding(buildingsById[hits[0].properties.id], 'map');
    else store.clearSelection();
  });
  ['building-pins', 'building-names'].forEach((layer) => {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  });
}

/**
 * Fly to a building whenever a different one is selected. When the flight
 * ends, pause a moment (so you see where it is), then let the sheet open.
 * @param {Object.<string, object>} buildingsById
 */
function followSelection(buildingsById) {
  // flyTo passes { flightTo: id } on to its 'moveend' event, so we know which flight ended.
  // A flight cut short by the user dragging has no flightTo, so the sheet waits for the Info pill.
  map.on('moveend', (event) => {
    if (!event.flightTo) return;
    const pause = event.via === 'search' ? CONFIG.map.sheetPauseAfterSearch : CONFIG.map.sheetPauseAfterTap;
    setTimeout(() => store.sheetCanOpen(event.flightTo), pause);
  });

  let lastSelectedId = null;
  store.subscribe((state) => {
    if (state.selectedId === lastSelectedId) return;
    lastSelectedId = state.selectedId;
    markSelected(state.selectedId);
    const building = buildingsById[state.selectedId];
    if (!building) return; // nothing selected
    map.setMaxBounds(fence);
    // A short, fixed-length flight that starts quick and settles softly (ease-out),
    // instead of MapLibre's slower default that eases in and out.
    map.flyTo({
      center: building.center,
      zoom: Math.max(map.getZoom(), CONFIG.map.selectZoom),
      duration: CONFIG.map.flyDuration,
      curve: CONFIG.map.flyCurve,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    }, { flightTo: building.id, via: state.selectedVia });
  });
}

/** Move back to the main campus view, facing north (Map settings "Back to campus"). */
export function showCampus() {
  map.setMaxBounds(fence);
  map.easeTo({
    center: CONFIG.map.center,
    zoom: CONFIG.map.zoom,
    bearing: 0,
    pitch: 0,
    duration: CONFIG.map.flyDuration,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

/**
 * Move the map to one NMSU place. Far places lift the drag fence; nearby ones restore it.
 * @param {object} place - one feature from data/campuses.geojson
 */
export function showPlace(place) {
  map.setMaxBounds(place.properties.km <= CONFIG.map.nearbyKm ? fence : null);
  map.fitBounds(boundsOf(pointsOf(place.geometry), 0), {
    padding: CONFIG.map.fitPadding,
    maxZoom: CONFIG.map.fitMaxZoom,
    duration: CONFIG.map.fitDuration,
  });
}

/**
 * Create the map.
 * @param {Object.<string, object>} buildingsById - buildings keyed by id (each has .center)
 * @param {object} campuses - data/campuses.geojson
 * @param {object} labels - data/campus-labels.geojson
 * @param {object} outside - data/outside-mask.geojson
 * @returns {maplibregl.Map}
 */
export function initMap(buildingsById, campuses, labels, outside) {
  const settings = CONFIG.map;
  const nearbyPlaces = campuses.features.filter((place) => place.properties.km <= settings.nearbyKm);
  fence = boundsOf(nearbyPlaces.flatMap((place) => pointsOf(place.geometry)), settings.fencePadding);

  map = new maplibregl.Map({
    container: 'map',
    style: settings.styleUrl,
    center: settings.center,
    zoom: settings.zoom,
    minZoom: settings.minZoom,
    maxZoom: settings.maxZoom,
    maxBounds: fence,
    // Phones with very sharp screens draw at most 2x: looks the same, and cheaper
    // phones keep a smooth frame rate.
    pixelRatio: Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio),
    dragRotate: true,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.enable();
  map.touchPitch.enable();

  map.on('load', () => {
    foldCredits();
    hideBasemapBusinesses();
    drawCampuses(campuses, labels, outside);
    drawBadges(buildingsById);
    markSelected(store.get().selectedId);
    listenForTaps(buildingsById);
    markReady();
  });
  followSelection(buildingsById);

  return map;
}
