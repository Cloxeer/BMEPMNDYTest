/**
 * @file js/map/campusLayers.js
 * @summary Draws NMSU's class places on the map: everything else faded, ours tinted, outlined and named.
 *
 * WHAT IT DOES : Adds the map layers for the campus shapes. The shapes are made
 *                ahead of time by tools/build_campuses.py, so this file only draws.
 *                Also hides the basemap's business labels (not checked by us).
 * DEPENDS ON   : a MapLibre map, ../core/config.js, and the files from tools/build_campuses.py.
 * CONTROLS     : the 'outside', 'campuses' and 'campus-labels' map sources and their layers.
 * USED BY      : js/map/campusMap.js
 */

import { CONFIG } from '../core/config.js';

/**
 * Hide the basemap's business labels: they come from a third party and we haven't checked them.
 * @param {maplibregl.Map} map
 */
export function hideBasemapBusinesses(map) {
  for (const layer of map.getStyle().layers) {
    if (layer['source-layer'] === CONFIG.map.hiddenBasemapLayer) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

/**
 * Draw NMSU's class places: fade the rest, then tint, outline and name ours.
 * @param {maplibregl.Map} map
 * @param {object} campuses - data/campuses.geojson
 * @param {object} labels - data/campus-labels.geojson
 * @param {object} outside - data/outside-mask.geojson
 */
export function addCampusLayers(map, campuses, labels, outside) {
  const settings = CONFIG.map;
  const crimson = CONFIG.theme.crimson;

  map.addSource('outside', { type: 'geojson', data: outside });
  map.addSource('campuses', { type: 'geojson', data: campuses });
  map.addSource('campus-labels', { type: 'geojson', data: labels });

  // 1. Everything that isn't a class place: faded.
  map.addLayer({
    id: 'outside-mute',
    type: 'fill',
    source: 'outside',
    paint: { 'fill-color': settings.outsideColor, 'fill-opacity': settings.outsideOpacity },
  });

  // 2. Our places: a light crimson tint...
  map.addLayer({
    id: 'campus-tint',
    type: 'fill',
    source: 'campuses',
    paint: { 'fill-color': crimson, 'fill-opacity': settings.campusTintOpacity },
  });

  // 3. ...a crimson outline...
  map.addLayer({
    id: 'campus-edge',
    type: 'line',
    source: 'campuses',
    paint: { 'line-color': crimson, 'line-width': settings.campusEdgeWidth, 'line-opacity': settings.campusEdgeOpacity },
  });

  // 4. ...and a name, shown until you zoom in close.
  map.addLayer({
    id: 'campus-name',
    type: 'symbol',
    source: 'campus-labels',
    maxzoom: settings.labelMaxZoom,
    layout: {
      'text-field': ['get', 'Name'],
      'text-font': [settings.labelFont],
      'text-size': settings.labelSize,
      'text-max-width': settings.labelMaxWidth,
    },
    paint: { 'text-color': crimson, 'text-halo-color': CONFIG.theme.white, 'text-halo-width': settings.labelHaloWidth },
  });
}
