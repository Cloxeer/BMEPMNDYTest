/**
 * @file js/directions/routeData.js
 * @summary Loads what directions need, only once and only when it's first needed.
 *
 * WHAT IT DOES : The first time directions start it loads:
 *                  - geojson-path-finder (the shortest-route library, from the CDN),
 *                  - the outline of every building and park (to tell when you've arrived).
 *                For each travel mode (walk, bike, drive) it loads that mode's
 *                paths from data/routes/ the first time it's used, and keeps it.
 * DEPENDS ON   : geojson-path-finder, ../logic/routeMath.js,
 *                data/routes/{walk,bike,drive}.geojson (tools/build_routes.py),
 *                data/building-shapes.geojson (tools/build_buildings.py),
 *                data/park-shapes.geojson (tools/build_parks.py).
 * USED BY      : js/directions/directions.js
 */

import { segmentCost, waysBySegment, allNetworkPoints } from '../logic/routeMath.js';

const PATH_FINDER_URL = 'https://cdn.jsdelivr.net/npm/geojson-path-finder@2.1.0/+esm';

/**
 * Download a JSON file.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function loadJson(url) {
  const response = await fetch(url);
  return response.json();
}

export class RouteData {
  /** Nothing is loaded until directions are first used. */
  constructor() {
    this.PathFinder = null; // the routing library, once loaded
    this.outlines = null; // every building and park outline by id, once loaded
    this.networks = {}; // 'walk' | 'bike' | 'drive' -> { finder, points, ways }, once loaded
  }

  /**
   * Load everything one travel mode needs (the library and outlines only the first time).
   * @param {'walk'|'bike'|'drive'} mode
   * @returns {Promise<object>} the network: { finder, points, ways }
   */
  async loadNetwork(mode) {
    if (!this.PathFinder) {
      const results = await Promise.all([
        import(PATH_FINDER_URL),
        loadJson('data/building-shapes.geojson'),
        loadJson('data/park-shapes.geojson'),
      ]);
      this.PathFinder = results[0].default;
      this.outlines = {};
      for (const shapes of [results[1], results[2]]) {
        for (const shape of shapes.features) {
          this.outlines[shape.properties.id] = shape.geometry;
        }
      }
    }
    if (!this.networks[mode]) {
      const paths = await loadJson('data/routes/' + mode + '.geojson');
      this.networks[mode] = {
        finder: new this.PathFinder(paths, { weight: segmentCost }),
        points: allNetworkPoints(paths), // where a route can start or end
        ways: waysBySegment(paths), // for naming the streets in the steps
      };
    }
    return this.networks[mode];
  }

  /**
   * A travel mode's network, if it has loaded.
   * @param {'walk'|'bike'|'drive'} mode
   * @returns {object|undefined}
   */
  network(mode) {
    return this.networks[mode];
  }

  /**
   * A building's or park's outline.
   * @param {string} id
   * @returns {object} a GeoJSON geometry
   */
  outline(id) {
    return this.outlines[id];
  }
}
