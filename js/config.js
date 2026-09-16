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
 * NOTE: property shapes are NOT in this file. They live in
 * data/nmsu-campuses.geojson, downloaded from NMSU's own Office of Space
 * Planning (Campus Boundaries layer), so nothing here is guessed.
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

  // Official NMSU properties we deliberately do NOT show, and why. Each one was
  // checked against what is actually on the ground.
  excludedProperties: {
    'North Campus':
      'NMSU-owned land leased to a Speedway, a FlixBus stop, and the Campus Suites / ' +
      'Aggie Oasis apartments. Not a student campus. (Checked against OpenStreetMap, Sept 2026.)',
  },

  // Business / point-of-interest labels from the basemap are third-party and
  // unverified (e.g. a "Campus Bookstore" pin in the University Ave shops), so
  // we hide them and only show labels we have checked.
  hideBasemapPOIs: true,

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
