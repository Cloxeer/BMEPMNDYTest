/**
 * @file js/logic/shapes.js
 * @summary Maths on flat shapes (polygons): is a point inside, how big is it, what box fits around it.
 *
 * WHAT IT DOES : Works on lists of [x, y] points. The same maths works for
 *                floor plans (plan units) and for map shapes ([lng, lat]).
 * DEPENDS ON   : nothing.
 * USED BY      : js/logic/geo.js, js/sheet/floorPlan.js, js/map/campusMap.js
 */

/**
 * Is the point (x, y) inside the polygon?
 * Ray casting: imagine a line from the point going right, and count how many
 * edges of the polygon it crosses. An odd number means inside.
 * @param {number[][]} points - the polygon's corners, [[x, y], ...]
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsidePolygon(points, x, y) {
  let inside = false;
  let previous = points.length - 1; // the edge from the last corner back to the first
  for (let current = 0; current < points.length; current += 1) {
    const x1 = points[current][0];
    const y1 = points[current][1];
    const x2 = points[previous][0];
    const y2 = points[previous][1];
    const edgeCrossesLine = (y1 > y) !== (y2 > y);
    if (edgeCrossesLine && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) {
      inside = !inside;
    }
    previous = current;
  }
  return inside;
}

/**
 * The area of a polygon (the "shoelace formula").
 * @param {number[][]} points - the polygon's corners, [[x, y], ...]
 * @returns {number}
 */
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length; // the last corner joins back to the first
    sum = sum + points[i][0] * points[next][1] - points[next][0] * points[i][1];
  }
  return Math.abs(sum);
}

/**
 * Every [lng, lat] point of a map Polygon or MultiPolygon, in one flat list.
 * @param {object} geometry - a GeoJSON geometry
 * @returns {number[][]}
 */
export function allPointsOf(geometry) {
  let polygons = geometry.coordinates; // MultiPolygon: a list of polygons
  if (geometry.type === 'Polygon') {
    polygons = [geometry.coordinates]; // Polygon: just one
  }
  const points = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) {
        points.push(point);
      }
    }
  }
  return points;
}

/**
 * The rectangle around some points, plus a margin on every side.
 * @param {number[][]} points - [[lng, lat], ...]
 * @param {number} padding - added on every side
 * @returns {number[][]} [[west, south], [east, north]]
 */
export function boxAround(points, padding) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point[0]);
    east = Math.max(east, point[0]);
    south = Math.min(south, point[1]);
    north = Math.max(north, point[1]);
  }
  return [
    [west - padding, south - padding],
    [east + padding, north + padding],
  ];
}
