/**
 * @file js/config.js
 * @summary One place for every setting you might want to tweak.
 *
 * WHAT IT DOES : Holds the map's start position, zoom limits, the drag fence,
 *                the basemap style, and the brand color.
 * DEPENDS ON   : nothing.
 * CONTROLS     : how the map in js/map.js looks and where it opens.
 * USED BY      : js/map.js
 */

export const CONFIG = {
  // [longitude, latitude] — centered on Hardman & Jacobs (our first building).
  center: [-106.7484, 32.2802],

  zoom: 15.8,
  minZoom: 14,
  maxZoom: 18,

  // Fence that keeps dragging near campus. [ [SW lng,lat], [NE lng,lat] ].
  maxBounds: [
    [-106.762, 32.272],
    [-106.74, 32.29],
  ],

  // OpenFreeMap "Positron": a clean vector basemap. FREE, no API key, crisp at
  // every zoom. (https://openfreemap.org)
  styleUrl: 'https://tiles.openfreemap.org/styles/positron',

  // NMSU crimson, reused by the building outline + pin.
  crimson: '#8C0B42',
};
