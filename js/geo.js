/**
 * @file js/geo.js
 * @summary Small map maths for directions: distances and "is this point inside?".
 *
 * WHAT IT DOES : Works on [lng, lat] points. Distances are in metres, using a
 *                flat-earth approximation that is accurate to well under a metre
 *                across a campus (and much simpler than full globe maths).
 * DEPENDS ON   : nothing.
 * USED BY      : js/directions.js
 */

const METRES_PER_DEGREE = 111320; // north-south length of one degree of latitude

/**
 * Turn [lng, lat] into flat x/y metres around a reference latitude.
 * @param {number[]} point - [lng, lat]
 * @param {number} latitude - reference latitude (longitude degrees shrink away from the equator)
 * @returns {number[]} [x, y] in metres
 */
function toMetres(point, latitude) {
  return [point[0] * METRES_PER_DEGREE * Math.cos((latitude * Math.PI) / 180), point[1] * METRES_PER_DEGREE];
}

/**
 * Straight-line distance between two points.
 * @param {number[]} a - [lng, lat]
 * @param {number[]} b - [lng, lat]
 * @returns {number} metres
 */
export function metresBetween(a, b) {
  const [ax, ay] = toMetres(a, a[1]);
  const [bx, by] = toMetres(b, a[1]);
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Every ring (closed line) of a Polygon or MultiPolygon.
 * @param {object} geometry - GeoJSON geometry
 * @returns {number[][][]}
 */
function ringsOf(geometry) {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

/**
 * Is the point inside the shape? (Ray casting: count how many edges a line to the
 * right crosses; odd = inside. Holes work automatically.)
 * @param {number[]} point - [lng, lat]
 * @param {object} geometry - GeoJSON Polygon or MultiPolygon
 * @returns {boolean}
 */
export function pointInShape(point, geometry) {
  const [x, y] = point;
  let inside = false;
  ringsOf(geometry).forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
    }
  });
  return inside;
}

/**
 * Shortest distance from a point to the edge of a shape.
 * @param {number[]} point - [lng, lat]
 * @param {object} geometry - GeoJSON Polygon or MultiPolygon
 * @returns {number} metres
 */
export function metresToEdge(point, geometry) {
  const [px, py] = toMetres(point, point[1]);
  let best = Infinity;
  ringsOf(geometry).forEach((ring) => {
    for (let i = 1; i < ring.length; i += 1) {
      const [ax, ay] = toMetres(ring[i - 1], point[1]);
      const [bx, by] = toMetres(ring[i], point[1]);
      const dx = bx - ax;
      const dy = by - ay;
      // How far along the edge the closest point is (0 = start, 1 = end).
      const along = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(px - (ax + along * dx), py - (ay + along * dy)));
    }
  });
  return best;
}
