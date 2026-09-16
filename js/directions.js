/**
 * @file js/directions.js
 * @summary Walking directions: blue arrows from where you are to the building.
 *
 * WHAT IT DOES : When directions start (the "Get directions" button in the sheet):
 *                (1) follows your GPS position,
 *                (2) finds the shortest walk along campus paths and streets to
 *                    the building's nearest door (or its nearest walkway if no
 *                    door is mapped). geojson-path-finder runs Dijkstra's
 *                    algorithm, the classic shortest-path search map apps are
 *                    built on, so the result is the shortest walk that exists
 *                    in the walkway data. Only mapped walkways are used; the
 *                    two short hops off them (you -> path, path -> door) are
 *                    drawn dotted so they don't look like real paths,
 *                (3) draws it as a see-through blue line with > > > arrows,
 *                    redrawing as you walk, and shows the next turn, time and
 *                    distance on the card at the bottom (js/turns.js, js/routeCard.js),
 *                (4) when you step inside NMSU's outline of the building (or are
 *                    within a few metres of its wall), ends
 *                    directions and opens the building's sheet on the room's floor.
 *                Inside buildings there are no arrows: NMSU publishes no hallway
 *                data, so the highlighted room on the floor plan takes over.
 * DEPENDS ON   : geojson-path-finder (loaded from the CDN the first time it's
 *                needed), maplibre map, ./config.js, ./store.js, ./geo.js, ./turns.js,
 *                data/walkways.geojson (tools/build_walkways.py),
 *                data/building-shapes.geojson (tools/build_buildings.py).
 * CONTROLS     : the 'route' map source and its 'route-line' / 'route-arrows' /
 *                'route-hops' layers.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { metresBetween, pointInShape, metresToEdge } from './geo.js';
import { nextStep } from './turns.js';
import { mapReady } from './map.js';

const PATH_FINDER_URL = 'https://cdn.jsdelivr.net/npm/geojson-path-finder@2.1.0/+esm';

/**
 * Draw one arrow ">" as a picture the map repeats along the route.
 * It points right; the map turns it to follow the line.
 * @param {object} settings - CONFIG.directions
 * @returns {object} {width, height, data} for map.addImage
 */
function drawArrow(settings) {
  const size = settings.arrowSize * CONFIG.badge.pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pen = canvas.getContext('2d');
  pen.strokeStyle = settings.arrowColor;
  pen.lineWidth = size * 0.18;
  pen.lineCap = 'round';
  pen.lineJoin = 'round';
  pen.beginPath();
  pen.moveTo(size * 0.35, size * 0.2);
  pen.lineTo(size * 0.65, size * 0.5);
  pen.lineTo(size * 0.35, size * 0.8);
  pen.stroke();
  return { width: size, height: size, data: pen.getImageData(0, 0, size, size).data };
}

/**
 * Wire directions to the store.
 * @param {Framework7} app - for messages
 * @param {maplibregl.Map} map
 * @param {{ showMyLocation: () => void }} locate - from js/locate.js
 * @param {{ show: (step: object) => void }} card - from js/routeCard.js
 * @param {Object.<string, object>} buildingsById
 */
export function initDirections(app, map, locate, card, buildingsById) {
  const settings = CONFIG.directions;
  let network = null; // { finder, points, ways, shapes } once the walkway data has loaded
  let watchId = null; // the GPS watch while directions are on
  let routedFrom = null; // where the current route starts

  /**
   * Load the path finder and the walkway + outline files (only the first time).
   * @returns {Promise<object>}
   */
  async function loadNetwork() {
    if (network) return network;
    const [library, walkways, shapes] = await Promise.all([
      import(PATH_FINDER_URL),
      fetch('data/walkways.geojson').then((response) => response.json()),
      fetch('data/building-shapes.geojson').then((response) => response.json()),
    ]);
    const PathFinder = library.default;
    network = {
      finder: new PathFinder(walkways),
      // Every point where the route can start or end.
      points: walkways.features.flatMap((feature) => feature.geometry.coordinates),
      ways: waysBySegment(walkways),
      shapes: Object.fromEntries(shapes.features.map((feature) => [feature.properties.id, feature.geometry])),
    };
    return network;
  }

  /**
   * Remember which way (name + kind) every little segment belongs to, for turn names.
   * @param {object} walkways - data/walkways.geojson
   * @returns {Map<string, object>} "lng,lat|lng,lat" (both directions) -> way properties
   */
  function waysBySegment(walkways) {
    const ways = new Map();
    walkways.features.forEach((feature) => {
      const points = feature.geometry.coordinates;
      for (let i = 1; i < points.length; i += 1) {
        ways.set(points[i - 1] + '|' + points[i], feature.properties);
        ways.set(points[i] + '|' + points[i - 1], feature.properties);
      }
    });
    return ways;
  }

  /**
   * The way a route segment is on (unknown segments count as a plain path).
   * @param {number[]} a
   * @param {number[]} b
   * @returns {{ name: string, highway: string }}
   */
  function wayBetween(a, b) {
    return network.ways.get(a + '|' + b) || { name: '', highway: 'path' };
  }

  /**
   * The walkway point closest to a place.
   * @param {number[]} place - [lng, lat]
   * @param {(point: number[]) => number} [distance] - how to measure; default straight line to `place`
   * @returns {{ point: number[], metres: number }}
   */
  function nearestWalkwayPoint(place, distance = (point) => metresBetween(point, place)) {
    let best = { point: null, metres: Infinity };
    network.points.forEach((point) => {
      const metres = distance(point);
      if (metres < best.metres) best = { point, metres };
    });
    return best;
  }

  /**
   * Where the route should end for this building: next to the door closest to
   * you, or (no mapped door) the walkway closest to the building's outline.
   * @param {object} building
   * @param {number[]} from - your position
   * @returns {{ walkway: number[], door: number[]|null }}
   */
  function routeEnd(building, from) {
    if (building.doors.length) {
      const door = building.doors.reduce((a, b) => (metresBetween(a, from) <= metresBetween(b, from) ? a : b));
      return { walkway: nearestWalkwayPoint(door).point, door };
    }
    const outline = network.shapes[building.id];
    // Only look at walkways near the building, so this stays fast.
    const nearby = (point) => (metresBetween(point, building.center) > settings.searchRadius ? Infinity : metresToEdge(point, outline));
    return { walkway: nearestWalkwayPoint(building.center, nearby).point, door: null };
  }

  /** Remove the route from the map. */
  function clearRoute() {
    const source = map.getSource('route');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
    routedFrom = null;
  }

  /**
   * Put the route on the map (adds the layers the first time).
   * @param {number[][]} walk - the route along mapped walkways: solid line with arrows
   * @param {number[][][]} hops - short straight bits off the walkways: dotted
   */
  function drawRoute(walk, hops) {
    const line = (kind, coordinates) => ({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates } });
    const data = { type: 'FeatureCollection', features: [line('walk', walk), ...hops.map((hop) => line('hop', hop))] };
    if (map.getSource('route')) {
      map.getSource('route').setData(data);
      return;
    }
    map.addImage('route-arrow', drawArrow(settings), { pixelRatio: CONFIG.badge.pixelRatio });
    map.addSource('route', { type: 'geojson', data });
    const below = 'building-pins'; // under the badges, so they stay tappable
    map.addLayer({
      id: 'route-hops',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'kind'], 'hop'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': settings.lineColor, 'line-width': settings.hopWidth, 'line-dasharray': [0, 2] },
    }, below);
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'kind'], 'walk'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': settings.lineColor, 'line-opacity': settings.lineOpacity, 'line-width': settings.lineWidth },
    }, below);
    map.addLayer({
      id: 'route-arrows',
      type: 'symbol',
      source: 'route',
      filter: ['==', ['get', 'kind'], 'walk'],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': settings.arrowSpacing,
        'icon-image': 'route-arrow',
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    }, below);
  }

  /**
   * Explain a problem and turn directions off.
   * @param {string} text
   */
  function giveUp(text) {
    store.endDirections();
    app.dialog.alert(text, settings.title);
  }

  /**
   * A new GPS position: arrived? Otherwise re-route if you've moved enough.
   * @param {GeolocationPosition} position
   */
  function onPosition(position) {
    const target = store.get().directionsTo;
    if (!target) return;
    const building = buildingsById[target.buildingId];
    const here = [position.coords.longitude, position.coords.latitude];

    // Arrived: inside NMSU's outline, or right at its wall (GPS is often a few metres off near buildings).
    const outline = network.shapes[building.id];
    if (pointInShape(here, outline) || metresToEdge(here, outline) <= settings.arrivalMetres) {
      store.arrived(building);
      return;
    }
    if (routedFrom && metresBetween(here, routedFrom) < settings.rerouteMetres) return;

    const start = nearestWalkwayPoint(here);
    if (start.metres > settings.maxDistanceToWalkway) {
      giveUp(settings.tooFarText);
      return;
    }
    const end = routeEnd(building, here);
    const found = network.finder.findPath(
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: start.point } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: end.walkway } },
    );
    if (!found) {
      giveUp(settings.noRouteText);
      return;
    }
    routedFrom = here;
    const hops = [[here, start.point]];
    if (end.door) hops.push([end.walkway, end.door]);
    drawRoute(found.path, hops);
    const room = target.room ? ' · ' + CONFIG.search.roomText + ' ' + target.room.number : '';
    card.show(nextStep(start.metres, found.path, wayBetween, building.name + room));
  }

  /** Turn directions on: load data, then follow GPS. */
  async function start() {
    if (!navigator.geolocation) {
      giveUp(settings.noLocationText);
      return;
    }
    locate.showMyLocation(); // the blue dot, following you
    try {
      await Promise.all([loadNetwork(), mapReady]); // walkway data, and a map to draw on
    } catch (error) {
      console.error(error);
      giveUp(settings.loadFailedText);
      return;
    }
    if (!store.get().directionsTo) return; // turned off while loading
    watchId = navigator.geolocation.watchPosition(onPosition, () => giveUp(settings.noLocationText), {
      enableHighAccuracy: true,
    });
  }

  /** Turn directions off. */
  function stop() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    clearRoute();
  }

  let running = false;
  store.subscribe((state) => {
    const wanted = Boolean(state.directionsTo);
    if (wanted === running) return;
    running = wanted;
    if (running) start();
    else stop();
  });
}
