/**
 * @file js/directions.js
 * @summary Walking directions: blue arrows from where you are to the building.
 *
 * WHAT IT DOES : When directions start (the "Get directions" button in the sheet):
 *                (1) follows your GPS position,
 *                (2) finds the shortest walk along campus paths and streets to
 *                    the building's nearest door (or its nearest walkway if no
 *                    door is mapped),
 *                (3) draws it as a see-through blue line with > > > arrows,
 *                    redrawing as you walk,
 *                (4) when you step inside NMSU's outline of the building, ends
 *                    directions and opens the building's sheet on the room's floor.
 *                Inside buildings there are no arrows: NMSU publishes no hallway
 *                data, so the highlighted room on the floor plan takes over.
 * DEPENDS ON   : geojson-path-finder (loaded from the CDN the first time it's
 *                needed), maplibre map, ./config.js, ./store.js, ./geo.js,
 *                data/walkways.geojson (tools/build_walkways.py),
 *                data/building-shapes.geojson (tools/build_buildings.py).
 * CONTROLS     : the 'route' map source and its 'route-line' / 'route-arrows' layers.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { metresBetween, pointInShape, metresToEdge } from './geo.js';

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
 * @param {Object.<string, object>} buildingsById
 */
export function initDirections(app, map, locate, buildingsById) {
  const settings = CONFIG.directions;
  let network = null; // { finder, points, shapes } once the walkway data has loaded
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
      shapes: Object.fromEntries(shapes.features.map((feature) => [feature.properties.id, feature.geometry])),
    };
    return network;
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
   * Put the route line and its arrows on the map (adds the layers the first time).
   * @param {number[][]} coordinates
   */
  function drawRoute(coordinates) {
    const line = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
    if (map.getSource('route')) {
      map.getSource('route').setData(line);
      return;
    }
    map.addImage('route-arrow', drawArrow(settings), { pixelRatio: CONFIG.badge.pixelRatio });
    map.addSource('route', { type: 'geojson', data: line });
    // Both go under the building badges so the badges stay tappable.
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': settings.lineColor, 'line-opacity': settings.lineOpacity, 'line-width': settings.lineWidth },
    }, 'building-pins');
    map.addLayer({
      id: 'route-arrows',
      type: 'symbol',
      source: 'route',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': settings.arrowSpacing,
        'icon-image': 'route-arrow',
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    }, 'building-pins');
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

    if (pointInShape(here, network.shapes[building.id])) {
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
    drawRoute([here, ...found.path, ...(end.door ? [end.door] : [])]);
  }

  /** Turn directions on: load data, then follow GPS. */
  async function start() {
    if (!navigator.geolocation) {
      giveUp(settings.noLocationText);
      return;
    }
    locate.showMyLocation(); // the blue dot, following you
    try {
      await loadNetwork();
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
