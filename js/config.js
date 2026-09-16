/**
 * @file js/config.js
 * @summary One place for every setting you might want to tweak.
 *
 * WHAT IT DOES : Holds the map start position, zoom limits, the campus
 *                boundary points, the basemap style, and the brand color.
 * DEPENDS ON   : nothing.
 * CONTROLS     : how the map in js/map.js looks and where it opens.
 * USED BY      : js/map.js
 */

export const CONFIG = {
  // [longitude, latitude] — Hardman & Jacobs (our first building), from OpenStreetMap.
  center: [-106.7512196, 32.2824753],

  zoom: 16.2,
  minZoom: 13,
  maxZoom: 18,

  // The four corners of NMSU (from OpenStreetMap). The map won't let you drag
  // past these — change the numbers to move the fence. To map the boundary more
  // exactly later, just add more [lng, lat] points to this list.
  campusOutline: [
    [-106.7673, 32.2624], // SW corner
    [-106.7673, 32.2863], // NW corner
    [-106.7315, 32.2863], // NE corner
    [-106.7315, 32.2624], // SE corner
  ],

  // OpenFreeMap "Positron": clean vector basemap. FREE, no API key.
  styleUrl: 'https://tiles.openfreemap.org/styles/positron',

  crimson: '#8C0B42',
};
