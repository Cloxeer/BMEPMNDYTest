/**
 * @file js/config.js
 * @summary One place for every setting you might want to tweak.
 *
 * WHAT IT DOES : Holds the map's starting position, zoom limits, the campus
 *                boundary box, and the tile (map image) source URL.
 * DEPENDS ON   : nothing.
 * CONTROLS     : how the map in js/map.js looks and where it opens.
 * USED BY      : js/map.js
 *
 * To move the starting view, just change `center` and `zoom` below.
 */

export const CONFIG = {
  // [longitude, latitude] — the center of NMSU's Las Cruces main campus.
  center: [-106.7495, 32.281],

  // How zoomed in we start, and how far in/out the user may go.
  zoom: 15.4,
  minZoom: 14,
  maxZoom: 19,

  // Fence that keeps dragging on campus. Format: [ [SW lng,lat], [NE lng,lat] ].
  maxBounds: [
    [-106.762, 32.272],
    [-106.74, 32.29],
  ],

  // Free OpenStreetMap image tiles. No API key needed.
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; OpenStreetMap contributors',
};
