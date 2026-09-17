/**
 * @file js/heading.js
 * @summary Which way you're facing: the beam on your location dot, and turning the map with you.
 *
 * WHAT IT DOES : Reads the phone's compass and
 *                  - points a soft blue beam on the "you are here" dot the way
 *                    the phone is facing (it stays right when the map is rotated),
 *                  - when "Turn map with me" is on, rotates the map so the way
 *                    you're facing is up, like Apple Maps. Rotating the map
 *                    with your fingers turns this off again.
 *                iPhone: the compass needs permission, which the browser only
 *                asks for right after a tap, so start() is called from taps.
 *                Android: works without asking. No compass (e.g. a laptop):
 *                while you walk, the GPS direction of travel is used for the beam;
 *                "Turn map with me" explains it needs a compass.
 * DEPENDS ON   : the browser's DeviceOrientation events, maplibre map, ./config.js,
 *                the dot drawn by MapLibre's GeolocateControl (js/locate.js).
 * CONTROLS     : the .user-heading beam and the map's rotation while following.
 * USED BY      : js/locate.js
 */

import { CONFIG } from './config.js';

/**
 * Wire the heading beam and map following.
 * @param {maplibregl.Map} map
 * @returns {object} { start, fromGps, setFollow, isFollowing, onFollowChange }
 */
export function initHeading(map) {
  const settings = CONFIG.mapSettings;
  let heading = null; // degrees clockwise from north, or null when unknown
  let fromCompass = false; // true once a real compass reading has arrived
  let listening = false;
  let starting = null; // the permission request in progress, so two callers share one
  let following = false; // "Turn map with me" is on
  let lastTurn = 0; // when the map was last rotated to follow (ms)
  const followListeners = [];

  /** Point the beam (the map's own rotation is taken off, since the dot doesn't rotate with it). */
  function draw() {
    const dot = document.querySelector('.maplibregl-user-location-dot');
    if (!dot) return; // no location shown yet
    let beam = dot.querySelector('.user-heading');
    if (!beam) {
      beam = document.createElement('span');
      beam.className = 'user-heading';
      dot.appendChild(beam);
    }
    beam.hidden = heading === null;
    if (heading !== null) beam.style.setProperty('--heading', heading - map.getBearing() + 'deg');
  }

  /** While following, turn the map so the way you face is up (a few times a second, not every reading). */
  function turnMap() {
    if (!following || heading === null) return;
    const now = performance.now();
    if (now - lastTurn < settings.followInterval) return;
    const difference = Math.abs(((heading - map.getBearing() + 540) % 360) - 180);
    if (difference < settings.followMinDegrees) return; // tiny wobbles: leave the map still
    lastTurn = now;
    map.rotateTo(heading, { duration: settings.followInterval, easing: (t) => t });
  }

  /**
   * A compass reading from the phone.
   * @param {DeviceOrientationEvent} event
   */
  function onOrientation(event) {
    let degrees = null;
    if (typeof event.webkitCompassHeading === 'number') {
      degrees = event.webkitCompassHeading; // iPhone: already "clockwise from north"
    } else if (event.absolute && typeof event.alpha === 'number') {
      degrees = 360 - event.alpha; // Android: alpha turns the other way
    }
    if (degrees === null) return;
    const screenTurn = (screen.orientation && screen.orientation.angle) || 0; // phone held sideways
    heading = (degrees + screenTurn + 360) % 360;
    fromCompass = true;
    draw();
    turnMap();
  }

  /**
   * Start listening to the compass (call from a tap).
   * @returns {Promise<boolean>} false if the compass isn't allowed or doesn't exist
   */
  function start() {
    if (listening) return Promise.resolve(true);
    if (typeof DeviceOrientationEvent === 'undefined') return Promise.resolve(false);
    if (!starting) {
      starting = (async () => {
        try {
          // iPhone asks the user; other browsers don't have this step.
          if (typeof DeviceOrientationEvent.requestPermission === 'function' &&
            (await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
        } catch (error) {
          return false; // permission refused or not allowed here
        }
        listening = true;
        // 'deviceorientationabsolute' (Android Chrome) is measured from north; plain 'deviceorientation' may not be.
        const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
        window.addEventListener(eventName, onOrientation);
        return true;
      })();
      starting.then((ok) => {
        if (!ok) starting = null; // refused: a later tap can ask again
      });
    }
    return starting;
  }

  /** @param {boolean} on - tell everyone watching (the map settings toggle) */
  function changeFollow(on) {
    if (on === following) return;
    following = on;
    if (!on) map.easeTo({ bearing: 0, duration: settings.unfollowDuration }); // back to north up, like Apple Maps
    followListeners.forEach((fn) => fn(on));
  }

  // Turning the map with your fingers means you want to control it: stop following.
  map.on('rotatestart', (event) => {
    if (event.originalEvent && following) changeFollow(false);
  });
  map.on('rotate', draw);

  return {
    start,

    /**
     * GPS reports a direction only while you're moving; use it when there's no compass.
     * @param {GeolocationCoordinates} coords
     */
    fromGps(coords) {
      const moving = typeof coords.heading === 'number' && !Number.isNaN(coords.heading) && coords.speed > 0.5;
      if (moving && !fromCompass) heading = coords.heading;
      draw();
    },

    /**
     * Turn "Turn map with me" on or off (call from a tap).
     * @param {boolean} on
     * @returns {Promise<boolean>} false if it couldn't turn on (no compass / not allowed)
     */
    async setFollow(on) {
      if (!on) {
        changeFollow(false);
        return true;
      }
      if (!(await start())) return false;
      // Wait briefly for a first reading: some devices say yes but never send one.
      const waitUntil = performance.now() + settings.compassWaitMs;
      while (!fromCompass && performance.now() < waitUntil) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!fromCompass) return false;
      changeFollow(true);
      lastTurn = 0;
      turnMap();
      return true;
    },

    /** @returns {boolean} is "Turn map with me" on? */
    isFollowing() {
      return following;
    },

    /** @param {(on: boolean) => void} fn - told whenever following turns on or off */
    onFollowChange(fn) {
      followListeners.push(fn);
    },
  };
}
