/**
 * @file js/planArt.js
 * @summary Draws the chosen room and the walk to it on top of one of our floor plans.
 *
 * WHAT IT DOES : Loads a floor plan SVG as text, adds on top of it:
 *                  - the chosen room, filled light blue,
 *                  - the indoor route to it (from data/rooms.json, worked out by
 *                    tools/indoor_routes.py): a see-through blue line with > arrows,
 *                  - a dot where you come in (outside door or stairs),
 *                and returns it as a picture URL an <img> can show.
 *                Shapes are added as plain SVG, so they line up exactly with the plan.
 * DEPENDS ON   : ./config.js
 * USED BY      : js/buildingSheet.js
 */

import { CONFIG } from './config.js';

let lastUrl = null; // the picture made last, freed when the next one is made

/**
 * SVG for the > arrows along a route, one every `spacing` units.
 * @param {number[][]} route - [[x, y], ...] in floor-plan units
 * @param {object} style - CONFIG.directions
 * @returns {string}
 */
function arrowsAlong(route, style) {
  const size = style.indoorArrowSize;
  const chevron = 'M' + -size / 2 + ',' + -size / 2 + ' L' + size / 3 + ',0 L' + -size / 2 + ',' + size / 2;
  let svg = '';
  let untilNext = style.indoorArrowSpacing / 2; // first arrow half a gap in
  for (let i = 1; i < route.length; i += 1) {
    const [ax, ay] = route[i - 1];
    const [bx, by] = route[i];
    const length = Math.hypot(bx - ax, by - ay);
    const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    let along = untilNext;
    while (along <= length) {
      const x = ax + ((bx - ax) * along) / length;
      const y = ay + ((by - ay) * along) / length;
      svg += '<path d="' + chevron + '" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) +
        ') rotate(' + angle.toFixed(1) + ')"/>';
      along += style.indoorArrowSpacing;
    }
    untilNext = along - length;
  }
  return svg;
}

/**
 * A floor plan with the room highlighted and the indoor route drawn.
 * @param {string} planFile - e.g. "data/floors/hjlc-1.svg"
 * @param {object} room - a record from data/rooms.json on this plan
 * @returns {Promise<string>} picture URL
 */
export async function planWithRoom(planFile, room) {
  const response = await fetch(planFile);
  if (!response.ok) throw new Error('Could not load ' + planFile);
  const plan = await response.text();
  const style = CONFIG.directions;
  const points = (list) => list.map((point) => point.join(',')).join(' ');

  let extra = '<polygon points="' + points(room.points) + '" fill="' + style.roomColor +
    '" stroke="' + style.roomEdge + '" stroke-width="' + style.roomEdgeWidth + '"/>';

  if (room.indoorRoute) {
    const [startX, startY] = room.indoorRoute[0];
    extra +=
      '<polyline points="' + points(room.indoorRoute) + '" fill="none" stroke="' + style.lineColor +
        '" stroke-opacity="' + style.lineOpacity + '" stroke-width="' + style.indoorLineWidth +
        '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g fill="none" stroke="' + style.arrowColor + '" stroke-width="' + style.indoorArrowSize / 4 +
        '" stroke-linecap="round" stroke-linejoin="round">' + arrowsAlong(room.indoorRoute, style) + '</g>' +
      '<circle cx="' + startX + '" cy="' + startY + '" r="' + style.indoorStartRadius + '" fill="' + style.lineColor +
        '" stroke="#ffffff" stroke-width="' + style.indoorStartRadius / 3 + '"/>';
  }

  // Added last, so it's drawn on top; see-through, so room numbers still show.
  const picture = plan.replace('</svg>', extra + '</svg>');
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(new Blob([picture], { type: 'image/svg+xml' }));
  return lastUrl;
}
