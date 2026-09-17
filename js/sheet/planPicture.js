/**
 * @file js/sheet/planPicture.js
 * @summary Draws the chosen room, the walk to it, and the entrances on top of one of our floor plans.
 *
 * WHAT IT DOES : Loads a floor plan (an SVG file) as text and adds on top of it:
 *                  - a round marker on every outside door (tap it for its photo),
 *                  - the chosen room, filled light blue,
 *                  - the indoor route to it (from data/rooms.json, worked out by
 *                    tools/indoor_routes.py): a see-through blue line with > arrows,
 *                  - a dot where you come in (an outside door or the stairs).
 *                It returns a picture address an <img> can show.
 *                The extra shapes are plain SVG, so they line up exactly with the plan.
 * DEPENDS ON   : ../core/config.js
 * USED BY      : js/sheet/floorPlan.js
 */

import { CONFIG } from '../core/config.js';

let lastPictureUrl = null; // the picture made last time, freed when the next one is made

/**
 * SVG points text: [[1, 2], [3, 4]] -> "1,2 3,4".
 * @param {number[][]} points
 * @returns {string}
 */
function pointsText(points) {
  const parts = [];
  for (const point of points) {
    parts.push(point.join(','));
  }
  return parts.join(' ');
}

/**
 * SVG for the > arrows along a route, one every `indoorArrowSpacing` plan units.
 * @param {number[][]} route - [[x, y], ...] in floor-plan units
 * @param {object} style - CONFIG.directions
 * @returns {string}
 */
function arrowsAlong(route, style) {
  const size = style.indoorArrowSize;
  const arrowShape = 'M' + -size / 2 + ',' + -size / 2 + ' L' + size / 3 + ',0 L' + -size / 2 + ',' + size / 2;
  let svg = '';
  let untilNext = style.indoorArrowSpacing / 2; // the first arrow is half a gap in
  for (let i = 1; i < route.length; i += 1) {
    const ax = route[i - 1][0];
    const ay = route[i - 1][1];
    const bx = route[i][0];
    const by = route[i][1];
    const length = Math.hypot(bx - ax, by - ay);
    const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    let along = untilNext;
    while (along <= length) {
      const x = ax + ((bx - ax) * along) / length;
      const y = ay + ((by - ay) * along) / length;
      svg += '<path d="' + arrowShape + '" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) +
        ') rotate(' + angle.toFixed(1) + ')"/>';
      along += style.indoorArrowSpacing;
    }
    untilNext = along - length; // carry the gap over to the next piece
  }
  return svg;
}

/**
 * SVG for one tappable entrance marker: a white circle with a crimson ring and dot.
 * @param {object} entrance - a record from data/entrances.json
 * @returns {string}
 */
function entranceMarker(entrance) {
  const look = CONFIG.sheet;
  const crimson = CONFIG.theme.crimson;
  const x = entrance.point[0];
  const y = entrance.point[1];
  return '<circle cx="' + x + '" cy="' + y + '" r="' + look.entranceRadius + '" fill="#ffffff" stroke="' +
    crimson + '" stroke-width="' + look.entranceRing + '"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + look.entranceDot + '" fill="' + crimson + '"/>';
}

/**
 * SVG for the chosen room: filled light blue.
 * @param {object} room
 * @param {object} style - CONFIG.directions
 * @returns {string}
 */
function roomShape(room, style) {
  return '<polygon points="' + pointsText(room.points) + '" fill="' + style.roomColor +
    '" stroke="' + style.roomEdge + '" stroke-width="' + style.roomEdgeWidth + '"/>';
}

/**
 * SVG for the walk to the room: the line, its arrows, and a dot where you come in.
 * @param {number[][]} route - the room's indoorRoute
 * @param {object} style - CONFIG.directions
 * @returns {string}
 */
function indoorRoute(route, style) {
  const startX = route[0][0];
  const startY = route[0][1];
  const line = '<polyline points="' + pointsText(route) + '" fill="none" stroke="' + style.lineColor +
    '" stroke-opacity="' + style.lineOpacity + '" stroke-width="' + style.indoorLineWidth +
    '" stroke-linecap="round" stroke-linejoin="round"/>';
  const arrows = '<g fill="none" stroke="' + style.arrowColor + '" stroke-width="' + style.indoorArrowSize / 4 +
    '" stroke-linecap="round" stroke-linejoin="round">' + arrowsAlong(route, style) + '</g>';
  const startDot = '<circle cx="' + startX + '" cy="' + startY + '" r="' + style.indoorStartRadius + '" fill="' + style.lineColor +
    '" stroke="#ffffff" stroke-width="' + style.indoorStartRadius / 3 + '"/>';
  return line + arrows + startDot;
}

/**
 * A floor plan with its entrances marked and, if a room is chosen, the room and the walk to it.
 * @param {string} planFile - e.g. "data/floors/hjlc-1.svg"
 * @param {object|null} room - a record from data/rooms.json on this plan, or null
 * @param {object[]} entrances - records from data/entrances.json on this plan
 * @returns {Promise<string>} a picture address for an <img>
 */
export async function makePlanPicture(planFile, room, entrances) {
  const response = await fetch(planFile);
  if (!response.ok) {
    throw new Error('Could not load ' + planFile);
  }
  const plan = await response.text();
  const style = CONFIG.directions;

  let extra = '';
  if (room) {
    extra += roomShape(room, style);
  }
  if (room && room.indoorRoute) {
    extra += indoorRoute(room.indoorRoute, style);
  }
  for (const entrance of entrances) {
    extra += entranceMarker(entrance);
  }

  // Added last, so it's drawn on top; see-through, so room numbers still show.
  const picture = plan.replace('</svg>', extra + '</svg>');
  if (lastPictureUrl) {
    URL.revokeObjectURL(lastPictureUrl);
  }
  lastPictureUrl = URL.createObjectURL(new Blob([picture], { type: 'image/svg+xml' }));
  return lastPictureUrl;
}
