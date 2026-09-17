/**
 * @file js/directions/directions.js
 * @summary Directions: blue arrows from where you are to the building, redrawn as you move.
 *
 * WHAT IT DOES : When directions start (the Directions button, js/bottomBar/directionsButton.js):
 *                1. follows your GPS position,
 *                2. finds the shortest way along campus paths and streets to the
 *                   building's nearest door (or its nearest walkway if no door is
 *                   mapped), walking, biking or driving. geojson-path-finder runs
 *                   Dijkstra's algorithm, the classic shortest-path search map apps
 *                   are built on. Only mapped paths and roads are used,
 *                3. draws it (./routeDrawing.js) and shows the next turn, time and
 *                   distance on the card at the bottom (js/logic/turns.js, ./routeCard.js),
 *                4. when you step inside NMSU's outline of the building (or are
 *                   within a few metres of its wall), ends directions and opens the
 *                   building's sheet on the room's floor.
 *                Inside buildings there are no arrows: NMSU publishes no hallway
 *                data, so the highlighted room on the floor plan takes over.
 * DEPENDS ON   : ../core/config.js, ../core/store.js, ../logic/geo.js, ../logic/routeMath.js,
 *                ../logic/turns.js, ./routeData.js, ./routeDrawing.js,
 *                and (handed in) the map, your location and the route card.
 * CONTROLS     : when directions run, and the route on the map.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { metresBetween, pointInShape, metresToEdge } from '../logic/geo.js';
import { nearestPoint, routeEnd, bestRoute } from '../logic/routeMath.js';
import { planTrip } from '../logic/turns.js';
import { RouteData } from './routeData.js';
import { drawRoute, clearRoute } from './routeDrawing.js';

/**
 * A short text naming a trip, so we can tell when it changes: "323|228|walk|imperial".
 * @param {object} state
 * @returns {string} '' when directions are off
 */
function tripKey(state) {
  const trip = state.directionsTo;
  if (!trip) {
    return '';
  }
  let roomNumber = '';
  if (trip.room) {
    roomNumber = trip.room.number;
  }
  return trip.buildingId + '|' + roomNumber + '|' + state.travelMode + '|' + state.units;
}

export class Directions {
  /**
   * @param {Framework7} app - for messages
   * @param {CampusMap} campusMap
   * @param {MyLocation} myLocation - shows the blue dot
   * @param {RouteCard} card - the turn-by-turn card
   * @param {Object.<string, object>} buildingsById
   */
  constructor(app, campusMap, myLocation, card, buildingsById) {
    this.app = app;
    this.campusMap = campusMap;
    this.map = campusMap.map;
    this.myLocation = myLocation;
    this.card = card;
    this.buildingsById = buildingsById;
    this.settings = CONFIG.directions;
    this.data = new RouteData();

    this.watchId = null; // the GPS watch while directions are on
    this.lastPosition = null; // the latest GPS reading, so a new destination or mode can re-route at once
    this.routedFrom = null; // where the route on the map starts
    this.routedKey = ''; // the trip the route on the map is for
    this.running = false; // are directions on?
    this.currentTrip = ''; // the trip directions are on for now

    store.subscribe((state) => this.update(state));
  }

  /**
   * Turn directions on or off, or re-route, when the state changes.
   * @param {object} state
   */
  update(state) {
    const wanted = Boolean(state.directionsTo);
    const nextTrip = tripKey(state);
    if (wanted !== this.running) {
      this.running = wanted;
      this.currentTrip = nextTrip;
      if (this.running) {
        this.start();
      } else {
        this.stop();
      }
    } else if (this.running && nextTrip !== this.currentTrip) {
      this.currentTrip = nextTrip;
      this.reroute(); // a new destination, travel mode or units
    }
  }

  /** Turn directions on: load the route data, then follow your GPS position. */
  async start() {
    if (!navigator.geolocation) {
      this.giveUp(this.settings.noLocationText);
      return;
    }
    this.myLocation.showMyLocation(); // the blue dot, following you
    try {
      // The route data, and a map to draw on.
      await Promise.all([this.data.loadNetwork(store.get().travelMode), this.campusMap.ready]);
    } catch (error) {
      console.error(error);
      this.giveUp(this.settings.loadFailedText);
      return;
    }
    if (!store.get().directionsTo) {
      return; // turned off while loading
    }
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onPosition(position),
      () => this.giveUp(this.settings.noLocationText),
      { enableHighAccuracy: true },
    );
  }

  /** Turn directions off. */
  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.lastPosition = null;
    clearRoute(this.map);
    this.routedFrom = null;
    this.routedKey = '';
  }

  /** A new destination or travel mode while directions are on: re-route from the last position straight away. */
  async reroute() {
    try {
      await this.data.loadNetwork(store.get().travelMode);
    } catch (error) {
      console.error(error);
      this.giveUp(this.settings.loadFailedText);
      return;
    }
    if (this.lastPosition && store.get().directionsTo) {
      this.route(this.lastPosition);
    }
  }

  /** @param {GeolocationPosition} position - a new GPS reading */
  onPosition(position) {
    this.lastPosition = position;
    this.route(position);
  }

  /**
   * Explain a problem and turn directions off.
   * @param {string} text
   */
  giveUp(text) {
    store.endDirections();
    this.app.dialog.alert(text, this.settings.title);
  }

  /**
   * Work out the route from a GPS position (or keep the one on the map).
   * @param {GeolocationPosition} position
   */
  route(position) {
    const state = store.get();
    const target = state.directionsTo;
    const network = this.data.network(state.travelMode);
    if (!target || !network) {
      return; // directions are off, or this mode's paths are still loading
    }
    const building = this.buildingsById[target.buildingId];
    const here = [position.coords.longitude, position.coords.latitude];

    // Arrived? Inside NMSU's outline, or right at its wall (GPS is often a few metres off next to buildings).
    const outline = this.data.outline(building.id);
    if (pointInShape(here, outline) || metresToEdge(here, outline) <= this.settings.arrivalMetres) {
      store.arrived(building);
      return;
    }

    // The same trip, and you haven't moved much: keep the route that's on the map.
    const key = tripKey(state);
    if (key === this.routedKey && metresBetween(here, this.routedFrom) < this.settings.rerouteMetres) {
      return;
    }

    if (nearestPoint(network.points, here).metres > this.settings.maxDistanceToNetwork) {
      this.giveUp(this.settings.tooFarText);
      return;
    }
    const end = routeEnd(network.points, building, outline, here, this.settings);
    const best = bestRoute(network, here, end.point, this.settings);
    if (!best) {
      this.giveUp(this.settings.noRouteText);
      return;
    }

    this.routedFrom = here;
    this.routedKey = key;
    const hops = [[here, best.start.point]]; // you -> the start of the route
    if (end.door) {
      hops.push([end.point, end.door]); // the end of the route -> the door
    }
    drawRoute(this.map, best.found.path, hops);

    let destination = building.name;
    if (target.room) {
      destination = building.name + ' · ' + CONFIG.search.roomText + ' ' + target.room.number;
    }
    const wayBetween = (a, b) => network.ways.get(a + '|' + b) || { name: '', highway: 'path' };
    this.card.show(planTrip(best.start.metres, best.found.path, wayBetween, destination, state.travelMode, state.units));
  }
}
