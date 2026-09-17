/**
 * @file js/map/badges.js
 * @summary The round "i" badge on every place, and the place names above them.
 *
 * WHAT IT DOES : 1. Draws the badge pictures: one per category colour (crimson
 *                   study, orange living, green parks), each with a white ring,
 *                   plus a blue-ringed one for the chosen place.
 *                2. Adds one map layer for the badges and one for the names.
 *                3. Builds the map "expressions" (small rules MapLibre runs on
 *                   every place) that pick each badge's picture and name colour.
 * DEPENDS ON   : a MapLibre map, ../core/config.js
 * CONTROLS     : the 'buildings' map source and its 'building-pins' / 'building-names' layers.
 * USED BY      : js/map/campusMap.js
 *
 * WHY BADGES ARE A MAP LAYER, NOT HTML: an HTML marker is moved by JavaScript
 * every frame and lags while you drag. A map layer is drawn by the graphics
 * chip together with the map, so it stays exactly in place.
 *
 * READING MAPLIBRE EXPRESSIONS: they are lists where the first item is the rule.
 *   ['get', 'category']                     -> this place's category, e.g. "study"
 *   ['concat', 'badge-', X]                 -> joins text: "badge-study"
 *   ['==', A, B]                            -> true when A equals B
 *   ['case', test, ifTrue, ifFalse]         -> like if / else
 *   ['in', X, ['literal', list]]            -> true when X is in the list
 */

import { CONFIG } from '../core/config.js';

/**
 * Draw one round "i" badge as a picture the map can place on buildings.
 * Every badge is the same size, so choosing one never makes it jump.
 * @param {string} color - the category's colour (config.yml categories)
 * @param {boolean} selected - true = blue ring, false = white ring
 * @returns {object} { width, height, data } for map.addImage
 */
function drawBadgePicture(color, selected) {
  const look = CONFIG.badge;
  const canvas = document.createElement('canvas');
  canvas.width = look.size * look.pixelRatio;
  canvas.height = look.size * look.pixelRatio;
  const pen = canvas.getContext('2d');
  pen.scale(look.pixelRatio, look.pixelRatio);
  const middle = look.size / 2;

  // The ring: a full circle, covered in the middle by the coloured circle.
  pen.beginPath();
  pen.arc(middle, middle, look.ringRadius, 0, Math.PI * 2);
  if (selected) {
    pen.fillStyle = look.selectedRing;
  } else {
    pen.fillStyle = look.ring;
  }
  pen.fill();

  // The coloured middle (a little smaller when chosen, so the blue ring is thicker).
  pen.beginPath();
  if (selected) {
    pen.arc(middle, middle, look.selectedCenterRadius, 0, Math.PI * 2);
  } else {
    pen.arc(middle, middle, look.centerRadius, 0, Math.PI * 2);
  }
  pen.fillStyle = color;
  pen.fill();

  // The letter.
  pen.fillStyle = CONFIG.theme.white;
  pen.font = look.letterFont;
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillText(look.letter, middle, middle + look.letterOffset);

  const image = pen.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

/**
 * A map rule that only shows places whose category is switched on.
 * @param {string[]} shownCategories - e.g. ['study', 'park']
 * @returns {Array} a MapLibre filter expression
 */
export function categoryFilter(shownCategories) {
  return ['in', ['get', 'category'], ['literal', shownCategories]];
}

/**
 * A map rule that picks each badge's picture: the blue-ringed one for the chosen place.
 * @param {string|null} selectedId - the chosen place's id
 * @returns {Array} a MapLibre expression
 */
export function badgePictureRule(selectedId) {
  const isSelected = ['==', ['get', 'id'], selectedId || ''];
  const selectedPicture = ['concat', 'badge-', ['get', 'category'], '-selected']; // e.g. "badge-study-selected"
  const normalPicture = ['concat', 'badge-', ['get', 'category']]; // e.g. "badge-study"
  return ['case', isSelected, selectedPicture, normalPicture];
}

/**
 * A map rule that colours the chosen place's name the same blue as its ring.
 * @param {string|null} selectedId
 * @returns {Array} a MapLibre expression
 */
export function nameColorRule(selectedId) {
  const isSelected = ['==', ['get', 'id'], selectedId || ''];
  return ['case', isSelected, CONFIG.badge.selectedRing, CONFIG.map.nameColor];
}

/**
 * Add the badge pictures, the places, and the badge and name layers to the map.
 * @param {maplibregl.Map} map
 * @param {Object.<string, object>} buildingsById - every building and park, by id
 * @param {string[]} shownCategories - categories switched on in Map filters
 * @param {boolean} namesVisible - the Building names setting
 */
export function addBadges(map, buildingsById, shownCategories, namesVisible) {
  // Two pictures per category colour: "badge-study", "badge-study-selected", "badge-living", ...
  const imageOptions = { pixelRatio: CONFIG.badge.pixelRatio };
  for (const category of Object.keys(CONFIG.categories)) {
    const color = CONFIG.categories[category].color;
    map.addImage('badge-' + category, drawBadgePicture(color, false), imageOptions);
    map.addImage('badge-' + category + '-selected', drawBadgePicture(color, true), imageOptions);
  }

  // One map point per place.
  const features = [];
  for (const place of Object.values(buildingsById)) {
    features.push({
      type: 'Feature',
      properties: { id: place.id, name: place.name, category: place.category },
      geometry: { type: 'Point', coordinates: place.center },
    });
  }
  map.addSource('buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });

  map.addLayer({
    id: 'building-pins',
    type: 'symbol',
    source: 'buildings',
    layout: { 'icon-image': ['concat', 'badge-', ['get', 'category']], 'icon-allow-overlap': true },
    filter: categoryFilter(shownCategories),
  });

  // Names sit just above the badges and move with the map at full speed, like the badges.
  // When a name would cover another name or a badge, the map hides it until there's room (zoom in).
  const settings = CONFIG.map;
  let visibility = 'none';
  if (namesVisible) {
    visibility = 'visible';
  }
  map.addLayer({
    id: 'building-names',
    type: 'symbol',
    source: 'buildings',
    minzoom: settings.namesMinZoom,
    filter: categoryFilter(shownCategories),
    layout: {
      visibility: visibility,
      'text-field': ['get', 'name'],
      'text-font': [settings.labelFont],
      // A little bigger as you zoom in, so it stays readable without crowding.
      'text-size': ['interpolate', ['linear'], ['zoom'], settings.namesMinZoom, settings.nameSizeSmall, settings.maxZoom, settings.nameSizeLarge],
      'text-max-width': settings.nameMaxWidth,
      'text-anchor': 'bottom',
      'text-offset': [0, settings.nameOffset],
      'text-padding': settings.namePadding,
    },
    paint: {
      'text-color': settings.nameColor,
      'text-halo-color': settings.nameHalo,
      'text-halo-width': settings.nameHaloWidth,
    },
  }, 'building-pins'); // listed under the badges, so badges are placed first and names keep clear of them
}
