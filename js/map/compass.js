/**
 * @file js/map/compass.js
 * @summary Which way you're facing: the beam on your location dot, and "Turn map with me".
 *
 * WHAT IT DOES : Reads the phone's compass and
 *                  - points a soft blue beam from the "you are here" dot the way
 *                    the phone is facing (it stays right when the map is rotated),
 *                  - when "Turn map with me" is on, rotates the map so the way
 *                    you face is up, like Apple Maps. Rotating the map with your
 *                    fingers turns this off again.
 *                iPhone: the compass needs permission, and the browser only asks
 *                right after a tap, so start() is called from taps.
 *                Android: works without asking.
 *                No compass (e.g. a laptop): while you walk, the GPS direction of
 *                travel is used for the beam, and "Turn map with me" explains it needs a compass.
 * DEPENDS ON   : the browser's DeviceOrientation events, a MapLibre map, ../core/config.js,
 *                and the location dot drawn by MapLibre (js/map/myLocation.js).
 * CONTROLS     : the .user-heading beam, and the map's rotation while following.
 * USED BY      : js/map/myLocation.js (as myLocation.compass)
 */

import { CONFIG } from '../core/config.js';

/**
 * Wait a moment.
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Moves at the same speed from start to end (no easing), used while turning the map with you.
 * @param {number} progress - 0 to 1
 * @returns {number}
 */
function linear(progress) {
  return progress;
}

export class Compass {
  /**
   * @param {maplibregl.Map} map
   */
  constructor(map) {
    this.map = map;
    this.settings = CONFIG.mapSettings;
    this.heading = null; // degrees clockwise from north, or null when unknown
    this.hasCompassReading = false; // true once a real compass reading has arrived
    this.listening = false; // listening to the compass?
    this.asking = null; // the permission question in progress, so two taps share one question
    this.following = false; // is "Turn map with me" on?
    this.lastTurn = 0; // when the map was last turned to follow you (ms)
    this.followListeners = []; // told when "Turn map with me" turns on or off

    // Turning the map with your fingers means you want to control it: stop following.
    this.map.on('rotatestart', (event) => {
      if (event.originalEvent && this.following) {
        this.changeFollow(false);
      }
    });
    this.map.on('rotate', () => this.drawBeam());
  }

  /** Point the beam. The map's own rotation is taken off, because the dot doesn't turn with the map. */
  drawBeam() {
    const dot = document.querySelector('.maplibregl-user-location-dot');
    if (!dot) {
      return; // your location isn't showing yet
    }
    let beam = dot.querySelector('.user-heading');
    if (!beam) {
      beam = document.createElement('span');
      beam.className = 'user-heading';
      dot.appendChild(beam);
    }
    beam.hidden = this.heading === null;
    if (this.heading !== null) {
      beam.style.setProperty('--heading', this.heading - this.map.getBearing() + 'deg');
    }
  }

  /** While following, turn the map so the way you face is up (a few times a second, not on every reading). */
  turnMap() {
    if (!this.following || this.heading === null) {
      return;
    }
    const now = performance.now();
    if (now - this.lastTurn < this.settings.followInterval) {
      return;
    }
    const difference = Math.abs(((this.heading - this.map.getBearing() + 540) % 360) - 180);
    if (difference < this.settings.followMinDegrees) {
      return; // tiny wobbles: keep the map still
    }
    this.lastTurn = now;
    this.map.rotateTo(this.heading, { duration: this.settings.followInterval, easing: linear });
  }

  /**
   * A compass reading arrived from the phone.
   * @param {DeviceOrientationEvent} event
   */
  onCompassReading(event) {
    let degrees = null;
    if (typeof event.webkitCompassHeading === 'number') {
      degrees = event.webkitCompassHeading; // iPhone: already "clockwise from north"
    } else if (event.absolute && typeof event.alpha === 'number') {
      degrees = 360 - event.alpha; // Android: alpha turns the other way
    }
    if (degrees === null) {
      return;
    }
    let screenTurn = 0; // the phone held sideways turns the screen
    if (screen.orientation && screen.orientation.angle) {
      screenTurn = screen.orientation.angle;
    }
    this.heading = (degrees + screenTurn + 360) % 360;
    this.hasCompassReading = true;
    this.drawBeam();
    this.turnMap();
  }

  /**
   * Start listening to the compass. Call this from a tap.
   * @returns {Promise<boolean>} false if the compass isn't allowed or doesn't exist
   */
  start() {
    if (this.listening) {
      return Promise.resolve(true);
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      return Promise.resolve(false);
    }
    if (!this.asking) {
      this.asking = this.askAndListen();
      this.asking.then((allowed) => {
        if (!allowed) {
          this.asking = null; // refused: a later tap can ask again
        }
      });
    }
    return this.asking;
  }

  /**
   * Ask for the compass (only iPhone asks), then start listening.
   * @returns {Promise<boolean>} false if it was refused
   */
  async askAndListen() {
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer !== 'granted') {
          return false;
        }
      }
    } catch (error) {
      return false; // refused, or not allowed here
    }
    this.listening = true;
    // 'deviceorientationabsolute' (Android Chrome) is measured from north; plain 'deviceorientation' may not be.
    let eventName = 'deviceorientation';
    if ('ondeviceorientationabsolute' in window) {
      eventName = 'deviceorientationabsolute';
    }
    window.addEventListener(eventName, (event) => this.onCompassReading(event));
    return true;
  }

  /**
   * Turn following on or off, and tell everyone watching (the Map settings toggle).
   * @param {boolean} on
   */
  changeFollow(on) {
    if (on === this.following) {
      return;
    }
    this.following = on;
    if (!on) {
      this.map.easeTo({ bearing: 0, duration: this.settings.unfollowDuration }); // back to north up, like Apple Maps
    }
    for (const listener of this.followListeners) {
      listener(on);
    }
  }

  /**
   * GPS gives a direction only while you're moving: use it when there's no compass.
   * @param {GeolocationCoordinates} coords
   */
  fromGps(coords) {
    const hasDirection = typeof coords.heading === 'number' && !Number.isNaN(coords.heading);
    const moving = hasDirection && coords.speed > 0.5;
    if (moving && !this.hasCompassReading) {
      this.heading = coords.heading;
    }
    this.drawBeam();
  }

  /**
   * Turn "Turn map with me" on or off. Call this from a tap.
   * @param {boolean} on
   * @returns {Promise<boolean>} false if it couldn't turn on (no compass, or not allowed)
   */
  async setFollow(on) {
    if (!on) {
      this.changeFollow(false);
      return true;
    }
    const allowed = await this.start();
    if (!allowed) {
      return false;
    }
    // Wait briefly for a first reading: some devices say yes but never send one.
    const waitUntil = performance.now() + this.settings.compassWaitMs;
    while (!this.hasCompassReading && performance.now() < waitUntil) {
      await wait(100);
    }
    if (!this.hasCompassReading) {
      return false;
    }
    this.changeFollow(true);
    this.lastTurn = 0;
    this.turnMap();
    return true;
  }

  /** @returns {boolean} is "Turn map with me" on? */
  isFollowing() {
    return this.following;
  }

  /** @param {(on: boolean) => void} listener - told whenever following turns on or off */
  onFollowChange(listener) {
    this.followListeners.push(listener);
  }
}
