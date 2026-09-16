/**
 * @file js/config.js
 * @summary One place for every setting you might want to tweak.
 *
 * WHAT IT DOES : Holds the map start position, zoom limits, the basemap style,
 *                and how the campus is highlighted.
 * DEPENDS ON   : nothing.
 * CONTROLS     : how the map in js/map.js looks and where it opens.
 * USED BY      : js/map.js
 *
 * NOTE: campus shapes are NOT in this file. tools/build_campuses.py makes them
 * from NMSU Office of Space Planning data, so nothing here is guessed.
 */

export const CONFIG = {
  // [longitude, latitude] — Hardman & Jacobs, from OpenStreetMap.
  center: [-106.7512196, 32.2824753],

  zoom: 16.2,
  minZoom: 11,
  maxZoom: 18,

  // OpenFreeMap "Liberty": a full-COLOR vector basemap. Free, no API key.
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',

  crimson: '#8C0B42',

  // Properties this close to main campus are highlighted on the map and fence
  // the drag area. Farther ones are listed on the Locations page instead.
  nearbyKm: 10,

  // Which NMSU places are shown (only places where classes can happen) is
  // decided in tools/build_campuses.py, which writes data/campuses.geojson.

  // Ring colour on the selected building's badge.
  selectedRing: '#E0241B',

  // How we make campus stand out: a light crimson tint inside the real
  // boundary, a crimson outline on it, and a white wash over everything
  // outside so the surroundings fade back.
  campus: {
    tintColor: '#8C0B42',
    tintOpacity: 0.07,
    outlineColor: '#8C0B42',
    outlineWidth: 2.5,
    muteColor: '#ffffff',
    muteOpacity: 0.6,
  },
};
