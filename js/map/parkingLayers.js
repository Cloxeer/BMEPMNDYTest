/**
 * @file js/map/parkingLayers.js
 * @summary Draws NMSU's parking lots: a see-through shape in the lot's permit color, with its name on it.
 *
 * WHAT IT DOES : The lot outlines (data/parking-lots.geojson) are a big file, so they're
 *                only downloaded the first time the Parking filter is switched on (it's
 *                off at first). Then they're drawn as a fill, an edge and a name label,
 *                under the badges, and shown or hidden with the filter.
 * DEPENDS ON   : a MapLibre map, ../core/config.js, data/parking-lots.geojson (tools/build_places.py)
 * CONTROLS     : the 'parking-lots' map source and its 'parking-fill', 'parking-edge' and 'parking-name' layers.
 * USED BY      : js/map/campusMap.js
 */

import { CONFIG } from '../core/config.js';

const LAYERS = ['parking-fill', 'parking-edge', 'parking-name'];
let loading = null; // the download in progress (or done), so it only happens once

/**
 * A map rule that picks each lot's color from its permit color, e.g. "Orange" -> "#ff9500".
 * Reads like: match the lot's permitColor; "Orange" gives this, "Purple" gives that, ...; anything else gives gray.
 * @param {object} settings - CONFIG.parking
 * @returns {Array} a MapLibre expression
 */
function permitColorRule(settings) {
  const rule = ['match', ['coalesce', ['get', 'permitColor'], '']];
  for (const name of Object.keys(settings.permitColors)) {
    rule.push(name, settings.permitColors[name]);
  }
  rule.push(settings.otherColor);
  return rule;
}

/**
 * Download the lots and add their layers, under the names and badges.
 * @param {maplibregl.Map} map
 */
async function addParkingLots(map) {
  const response = await fetch('data/parking-lots.geojson');
  const lots = await response.json();
  const settings = CONFIG.parking;
  const color = permitColorRule(settings);
  const below = 'building-names'; // under the names and badges, so they stay readable and tappable

  map.addSource('parking-lots', { type: 'geojson', data: lots });
  map.addLayer({
    id: 'parking-fill',
    type: 'fill',
    source: 'parking-lots',
    paint: { 'fill-color': color, 'fill-opacity': settings.fillOpacity },
  }, below);
  map.addLayer({
    id: 'parking-edge',
    type: 'line',
    source: 'parking-lots',
    paint: { 'line-color': color, 'line-width': settings.edgeWidth },
  }, below);
  map.addLayer({
    id: 'parking-name',
    type: 'symbol',
    source: 'parking-lots',
    minzoom: settings.nameMinZoom,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': [CONFIG.map.labelFont],
      'text-size': settings.nameSize,
      'text-max-width': CONFIG.map.nameMaxWidth,
    },
    paint: { 'text-color': settings.nameColor, 'text-halo-color': CONFIG.theme.white, 'text-halo-width': CONFIG.map.nameHaloWidth },
  }, below);
}

/**
 * Show or hide the parking lots (the Parking filter). The first time they're shown, they're downloaded.
 * @param {maplibregl.Map} map - with its badges already drawn
 * @param {boolean} visible
 */
export async function setParkingLotsVisible(map, visible) {
  if (visible && !loading) {
    loading = addParkingLots(map);
  }
  if (!loading) {
    return; // hidden, and never downloaded
  }
  await loading;
  let visibility = 'none';
  if (visible) {
    visibility = 'visible';
  }
  for (const layer of LAYERS) {
    map.setLayoutProperty(layer, 'visibility', visibility);
  }
}
