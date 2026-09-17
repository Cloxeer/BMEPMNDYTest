/**
 * @file js/logic/geo.js
 * @summary Map maths for directions: distances in metres, and "is this point inside a building?".
 *
 * WHAT IT DOES : Works on [lng, lat] points. Distances use a flat-earth
 *                shortcut that is accurate to well under a metre across a
 *                campus, and is much simpler than full globe maths.
 * DEPENDS ON   : ./shapes.js
 * USED BY      : js/directions/directions.js, js/logic/routeMath.js, js/logic/turns.js
 */

import { isInsidePolygon } from './shapes.js';

const METRES_PER_DEGREE = 111320; // north-south length of one degree of latitude

/**
 * Turn a [lng, lat] point into flat [x, y] metres.
 * @param {number[]} point - [lng, lat]
 * @param {number} latitude - the latitude to measure at (east-west degrees get shorter away from the equator)
 * @returns {number[]} [x, y] in metres
 */
function toMetres(point, latitude) {
  const x = point[0] * METRES_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
  const y = point[1] * METRES_PER_DEGREE;
  return [x, y];
}

/**
 * The straight-line distance between two points.
 * @param {number[]} a - [lng, lat]
 * @param {number[]} b - [lng, lat]
 * @returns {number} metres
 */
export function metresBetween(a, b) {
  const aMetres = toMetres(a, a[1]);
  const bMetres = toMetres(b, a[1]);
  return Math.hypot(aMetres[0] - bMetres[0], aMetres[1] - bMetres[1]);
}

/**
 * Every ring (closed outline) of a Polygon or MultiPolygon.
 * A polygon's first ring is its outside edge; any others are holes.
 * @param {object} geometry - a GeoJSON geometry
 * @returns {number[][][]}
 */
function ringsOf(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates;
  }
  const rings = [];
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      rings.push(ring);
    }
  }
  return rings;
}

/**
 * Is the point inside the shape? Holes (like a courtyard) count as outside.
 * @param {number[]} point - [lng, lat]
 * @param {object} geometry - a GeoJSON Polygon or MultiPolygon
 * @returns {boolean}
 */
export function pointInShape(point, geometry) {
  let inside = false;
  for (const ring of ringsOf(geometry)) {
    // Inside an outline flips to true; inside a hole of it flips back to false.
    if (isInsidePolygon(ring, point[0], point[1])) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The shortest distance from a point to the edge of a shape.
 * @param {number[]} point - [lng, lat]
 * @param {object} geometry - a GeoJSON Polygon or MultiPolygon
 * @returns {number} metres
 */
export function metresToEdge(point, geometry) {
  const here = toMetres(point, point[1]);
  let best = Infinity;
  for (const ring of ringsOf(geometry)) {
    for (let i = 1; i < ring.length; i += 1) {
      const start = toMetres(ring[i - 1], point[1]);
      const end = toMetres(ring[i], point[1]);
      best = Math.min(best, distanceToSegment(here, start, end));
    }
  }
  return best;
}

/**
 * The shortest distance from a point to a straight line segment (all in flat metres).
 * @param {number[]} point - [x, y]
 * @param {number[]} start - [x, y] one end of the segment
 * @param {number[]} end - [x, y] the other end
 * @returns {number}
 */
function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy || 1; // || 1: a zero-length segment is just a point
  // How far along the segment the closest point is: 0 = start, 1 = end.
  let along = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  along = Math.max(0, Math.min(1, along));
  const closestX = start[0] + along * dx;
  const closestY = start[1] + along * dy;
  return Math.hypot(point[0] - closestX, point[1] - closestY);
}
