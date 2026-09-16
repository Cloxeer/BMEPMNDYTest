/**
 * @file js/turns.js
 * @summary Turns a walking route into spoken-style steps: "Turn left onto Williams Avenue".
 *
 * WHAT IT DOES : Takes the route's points (from js/directions.js) and:
 *                (1) groups them into legs: a new leg starts where the way's
 *                    name changes or the route bends sharply,
 *                (2) names each turn by its angle (slight / full, left / right),
 *                (3) formats distances (ft/mi or m/km) and the walking time.
 *                All words come from config.yml (directions section).
 * DEPENDS ON   : ./config.js, ./geo.js
 * USED BY      : js/directions.js
 */

import { CONFIG } from './config.js';
import { metresBetween } from './geo.js';

const MIN_LEG_METRES = 10; // bends on legs shorter than this are too small to announce

/**
 * Direction of travel from a to b, in degrees clockwise from north.
 * @param {number[]} a - [lng, lat]
 * @param {number[]} b - [lng, lat]
 * @returns {number} 0..360
 */
function bearing(a, b) {
  const east = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const north = b[1] - a[1];
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/**
 * How much you turn going from one bearing to another: + right, - left.
 * @param {number} from
 * @param {number} to
 * @returns {number} -180..180
 */
function turnAngle(from, to) {
  return ((to - from + 540) % 360) - 180;
}

/**
 * What to call a way: its name, or e.g. "the path" if it has none.
 * @param {{ name: string, highway: string }} way
 * @returns {string}
 */
function wayLabel(way) {
  const unnamed = CONFIG.directions.unnamedWays;
  return way.name || unnamed[way.highway] || unnamed.default;
}

/**
 * Split the route into legs (stretches on one way without a sharp bend).
 * @param {number[][]} path - route points on the walkways
 * @param {(a: number[], b: number[]) => object} wayBetween - the way a segment is on
 * @returns {object[]} [{ label, endBearing, turn, metres }]
 */
function legsOf(path, wayBetween) {
  const legs = [];
  for (let i = 1; i < path.length; i += 1) {
    const label = wayLabel(wayBetween(path[i - 1], path[i]));
    const heading = bearing(path[i - 1], path[i]);
    const metres = metresBetween(path[i - 1], path[i]);
    const leg = legs[legs.length - 1];
    const turn = leg ? turnAngle(leg.endBearing, heading) : 0;

    const sameLeg = leg && leg.label === label && Math.abs(turn) < CONFIG.directions.slightTurnDegrees;
    if (sameLeg || (leg && metres < 1)) {
      leg.metres += metres;
      leg.endBearing = heading;
    } else {
      legs.push({ label, endBearing: heading, turn, metres });
    }
  }
  // Fold tiny legs into the one before, so a wiggle in a path isn't a "turn".
  return legs.reduce((kept, leg) => {
    const previous = kept[kept.length - 1];
    if (previous && leg.metres < MIN_LEG_METRES && leg.label === previous.label) {
      previous.metres += leg.metres;
      previous.endBearing = leg.endBearing;
    } else {
      kept.push(leg);
    }
    return kept;
  }, []);
}

/**
 * The words and icon for turning onto a leg ("Turn left onto Williams Avenue").
 * @param {object} leg - its .turn is the angle from the leg before
 * @returns {{ text: string, icon: string }}
 */
function describe(leg) {
  const words = CONFIG.directions;
  const size = Math.abs(leg.turn);
  const right = leg.turn > 0;
  let text = words.continueText;
  let icon = 'arrow_up';
  if (size >= words.turnDegrees) {
    text = right ? words.turnRightText : words.turnLeftText;
    icon = right ? 'arrow_turn_up_right' : 'arrow_turn_up_left';
  } else if (size >= words.slightTurnDegrees) {
    text = right ? words.slightRightText : words.slightLeftText;
    icon = right ? 'arrow_up_right' : 'arrow_up_left';
  }
  return { text: text + ' ' + words.ontoText + ' ' + leg.label, icon };
}

/**
 * Format a distance the way map apps do: "350 ft", "0.3 mi", "120 m", "1.2 km".
 * @param {number} metres
 * @returns {string}
 */
export function formatDistance(metres) {
  if (CONFIG.directions.units === 'metric') {
    return metres < 1000 ? Math.round(metres / 10) * 10 + ' m' : (metres / 1000).toFixed(1) + ' km';
  }
  const feet = metres * 3.28084;
  return feet < 1000 ? Math.max(10, Math.round(feet / 10) * 10) + ' ft' : (feet / 5280).toFixed(1) + ' mi';
}

/**
 * The card's contents for a route from where you are now.
 * @param {number} connectorMetres - straight walk from you to the first walkway point
 * @param {number[][]} path - route points on the walkways
 * @param {(a: number[], b: number[]) => object} wayBetween
 * @param {string} destination - e.g. "Hardman and Jacobs Undergraduate Learning Center"
 * @returns {{ instruction: string, icon: string, summary: string }}
 */
export function nextStep(connectorMetres, path, wayBetween, destination) {
  const words = CONFIG.directions;
  const legs = legsOf(path, wayBetween);
  const totalMetres = connectorMetres + legs.reduce((sum, leg) => sum + leg.metres, 0);
  const minutes = Math.max(1, Math.round(totalMetres / words.walkingSpeed / 60));
  const arrival = new Date(Date.now() + minutes * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const summary = minutes + ' ' + words.minText + ' · ' + formatDistance(totalMetres) + ' · ' + words.arrivalTimeText + ' ' + arrival;

  // No turns left: say where you'll arrive.
  if (legs.length === 0) {
    return { instruction: words.arriveText + ' ' + destination, icon: 'flag_fill', summary };
  }
  const untilTurn = connectorMetres + legs[0].metres;
  if (legs.length === 1) {
    return { instruction: formatDistance(untilTurn) + ' · ' + words.arriveText + ' ' + destination, icon: 'flag_fill', summary };
  }
  const turn = describe(legs[1]);
  return { instruction: formatDistance(untilTurn) + ' · ' + turn.text, icon: turn.icon, summary };
}
