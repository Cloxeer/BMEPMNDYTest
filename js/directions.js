/**
 * @file js/directions.js
 * @summary Walking directions: blue arrows from where you are to the building.
 *
 * WHAT IT DOES : When directions start (the "Get directions" button in the sheet):
 *                (1) follows your GPS position,
 *                (2) finds the shortest walk along campus paths and streets to
 *                    the building's nearest door (or its nearest walkway if no
 *                    door is mapped), walking, biking or driving (data/routes/,
 *                    made by tools/build_routes.py; one-way streets respected
 *                    for bikes and cars). geojson-path-finder runs Dijkstra's
 *                    algorithm, the classic shortest-path search map apps are
 *                    built on, so the result is the shortest walk that exists
 *                    in the route data. Only mapped paths and roads are used; the
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
 *                data/routes/{walk,bike,drive}.geojson (tools/build_routes.py),
 *                data/building-shapes.geojson (tools/build_buildings.py).
 * CONTROLS     : the 'route' map source and its 'route-line' / 'route-arrows' /
 *                'route-hops' layers.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { metresBetween, pointInShape, metresToEdge } from './geo.js';
import { planTrip } from './turns.js';
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
 * @param {{ show: (trip: object) => void }} card - from js/routeCard.js
 * @param {Object.<string, object>} buildingsById
 */
export function initDirections(app, map, locate, card, buildingsById) {
  const settings = CONFIG.directions;
  let PathFinder = null; // the routing library, once loaded
  let shapes = null; // NMSU building outlines by id, once loaded
  const networks = {}; // 'walk' | 'bike' | 'drive' -> { finder, points, ways }, loaded when first needed
  let watchId = null; // the GPS watch while directions are on
  let lastPosition = null; // the latest GPS reading, so a new destination or mode can re-route at once
  let routedFrom = null; // where the current route starts
  let routedKey = ''; // "building|room|mode" the current route is for

  /**
   * Remember which way (name + kind) every little segment belongs to, for turn names.
   * @param {object} geojson - one network from data/routes/
   * @returns {Map<string, object>} "lng,lat|lng,lat" (both directions) -> way properties
   */
  function waysBySegment(geojson) {
    const ways = new Map();
    geojson.features.forEach((feature) => {
      const points = feature.geometry.coordinates;
      for (let i = 1; i < points.length; i += 1) {
        ways.set(points[i - 1] + '|' + points[i], feature.properties);
        ways.set(points[i] + '|' + points[i - 1], feature.properties);
      }
    });
    return ways;
  }

  /**
   * How costly a segment is to travel: its length. One-way streets (bike and
   * drive networks) can only be travelled in their direction; 0 means "not allowed".
   * @param {number[]} a - segment start, in the order the way was drawn
   * @param {number[]} b - segment end
   * @param {object} properties - the way's properties (oneway: 'yes' | '-1' | 'no')
   * @returns {number|{forward: number, backward: number}}
   */
  function segmentCost(a, b, properties) {
    const metres = metresBetween(a, b);
    if (properties.oneway === 'yes') return { forward: metres, backward: 0 };
    if (properties.oneway === '-1') return { forward: 0, backward: metres };
    return metres;
  }

  /**
   * Load what a travel mode needs (the library and outlines only the first time).
   * @param {'walk'|'bike'|'drive'} mode
   * @returns {Promise<object>} the network
   */
  async function loadNetwork(mode) {
    if (!PathFinder) {
      const [library, outlines] = await Promise.all([
        import(PATH_FINDER_URL),
        fetch('data/building-shapes.geojson').then((response) => response.json()),
      ]);
      PathFinder = library.default;
      shapes = Object.fromEntries(outlines.features.map((feature) => [feature.properties.id, feature.geometry]));
    }
    if (!networks[mode]) {
      const geojson = await fetch('data/routes/' + mode + '.geojson').then((response) => response.json());
      networks[mode] = {
        finder: new PathFinder(geojson, { weight: segmentCost }),
        points: geojson.features.flatMap((feature) => feature.geometry.coordinates), // where a route can start or end
        ways: waysBySegment(geojson),
      };
    }
    return networks[mode];
  }

  /**
   * The network point closest to a place.
   * @param {object} network
   * @param {number[]} place - [lng, lat]
   * @param {(point: number[]) => number} [distance] - how to measure; default straight line to `place`
   * @returns {{ point: number[], metres: number }}
   */
  function nearestPoint(network, place, distance = (point) => metresBetween(point, place)) {
    let best = { point: null, metres: Infinity };
    network.points.forEach((point) => {
      const metres = distance(point);
      if (metres < best.metres) best = { point, metres };
    });
    return best;
  }

  /**
   * The best route from where you are: the nearest path isn't always the best
   * start (it can be a loop, like a running track), so try the few closest
   * starting points and keep the shortest total trip (straight hop + route).
   * @param {object} network
   * @param {number[]} here - your position
   * @param {number[]} endPoint - where the route ends on the network
   * @returns {{ start: {point: number[], metres: number}, found: object }|null}
   */
  function bestRoute(network, here, endPoint) {
    const byDistance = network.points
      .map((point) => ({ point, metres: metresBetween(point, here) }))
      .sort((a, b) => a.metres - b.metres);
    const candidates = [];
    for (const option of byDistance) {
      if (option.metres > byDistance[0].metres + settings.startSearchMetres || candidates.length === settings.startCandidates) break;
      if (candidates.every((c) => metresBetween(c.point, option.point) > settings.startSpacingMetres)) candidates.push(option);
    }
    const asPoint = (coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates } });
    let best = null;
    candidates.forEach((start) => {
      const found = network.finder.findPath(asPoint(start.point), asPoint(endPoint));
      if (found && (!best || start.metres + found.weight < best.start.metres + best.found.weight)) best = { start, found };
    });
    return best;
  }

  /**
   * Where the route should end for this building: next to the door closest to
   * you, or (no mapped door) the network point closest to the building's outline.
   * @param {object} network
   * @param {object} building
   * @param {number[]} from - your position
   * @returns {{ point: number[], door: number[]|null }}
   */
  function routeEnd(network, building, from) {
    if (building.doors.length) {
      const door = building.doors.reduce((a, b) => (metresBetween(a, from) <= metresBetween(b, from) ? a : b));
      return { point: nearestPoint(network, door).point, door };
    }
    const outline = shapes[building.id];
    // Only look near the building, so this stays fast.
    const nearby = (point) => (metresBetween(point, building.center) > settings.searchRadius ? Infinity : metresToEdge(point, outline));
    return { point: nearestPoint(network, building.center, nearby).point, door: null };
  }

  /** Remove the route from the map. */
  function clearRoute() {
    const source = map.getSource('route');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
    routedFrom = null;
    routedKey = '';
  }

  /**
   * Put the route on the map (adds the layers the first time).
   * @param {number[][]} path - the route along the network: solid line with arrows
   * @param {number[][][]} hops - short straight bits off the network: dotted
   */
  function drawRoute(path, hops) {
    const line = (kind, coordinates) => ({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates } });
    const data = { type: 'FeatureCollection', features: [line('walk', path), ...hops.map((hop) => line('hop', hop))] };
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
   * Work out (or keep) the route from a GPS position: arrived? moved enough? new destination or mode?
   * @param {GeolocationPosition} position
   */
  function route(position) {
    const state = store.get();
    const target = state.directionsTo;
    const network = networks[state.travelMode];
    if (!target || !network) return; // off, or the mode's network is still loading
    const building = buildingsById[target.buildingId];
    const here = [position.coords.longitude, position.coords.latitude];

    // Arrived: inside NMSU's outline, or right at its wall (GPS is often a few metres off near buildings).
    const outline = shapes[building.id];
    if (pointInShape(here, outline) || metresToEdge(here, outline) <= settings.arrivalMetres) {
      store.arrived(building);
      return;
    }
    const key = target.buildingId + '|' + (target.room ? target.room.number : '') + '|' + state.travelMode + '|' + state.units;
    if (key === routedKey && metresBetween(here, routedFrom) < settings.rerouteMetres) return;

    if (nearestPoint(network, here).metres > settings.maxDistanceToNetwork) {
      giveUp(settings.tooFarText);
      return;
    }
    const end = routeEnd(network, building, here);
    const best = bestRoute(network, here, end.point);
    if (!best) {
      giveUp(settings.noRouteText);
      return;
    }
    const { start, found } = best;
    routedFrom = here;
    routedKey = key;
    const hops = [[here, start.point]];
    if (end.door) hops.push([end.point, end.door]);
    drawRoute(found.path, hops);
    const wayBetween = (a, b) => network.ways.get(a + '|' + b) || { name: '', highway: 'path' };
    const room = target.room ? ' · ' + CONFIG.search.roomText + ' ' + target.room.number : '';
    card.show(planTrip(start.metres, found.path, wayBetween, building.name + room, state.travelMode));
  }

  /** @param {GeolocationPosition} position - a new GPS reading */
  function onPosition(position) {
    lastPosition = position;
    route(position);
  }

  /** Turn directions on: load data, then follow GPS. */
  async function start() {
    if (!navigator.geolocation) {
      giveUp(settings.noLocationText);
      return;
    }
    locate.showMyLocation(); // the blue dot, following you
    try {
      await Promise.all([loadNetwork(store.get().travelMode), mapReady]); // route data, and a map to draw on
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
    lastPosition = null;
    clearRoute();
  }

  /** A new destination or travel mode while directions are on: re-route from the last position straight away. */
  async function reroute() {
    try {
      await loadNetwork(store.get().travelMode);
    } catch (error) {
      console.error(error);
      giveUp(settings.loadFailedText);
      return;
    }
    if (lastPosition && store.get().directionsTo) route(lastPosition);
  }

  let running = false;
  let trip = ''; // "building|room|mode|units" directions are currently for
  store.subscribe((state) => {
    const wanted = Boolean(state.directionsTo);
    const nextTrip = wanted
      ? state.directionsTo.buildingId + '|' + (state.directionsTo.room ? state.directionsTo.room.number : '') + '|' + state.travelMode + '|' + state.units
      : '';
    if (wanted !== running) {
      running = wanted;
      trip = nextTrip;
      if (running) start();
      else stop();
    } else if (running && nextTrip !== trip) {
      trip = nextTrip;
      reroute();
    }
  });
}
