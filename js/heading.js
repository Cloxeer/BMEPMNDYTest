/**
 * @file js/heading.js
 * @summary Shows which way you're facing: a soft blue beam on your location dot.
 *
 * WHAT IT DOES : Reads the phone's compass and turns a beam on the blue
 *                "you are here" dot to point where the phone is facing,
 *                keeping it right when the map is rotated.
 *                  - iPhone: the compass needs permission, which the browser
 *                    only asks for right after a tap, so start() is called
 *                    from the location button and "Get directions".
 *                  - Android: the compass works without asking.
 *                  - No compass (e.g. a laptop): while you walk, the GPS
 *                    direction of travel is used instead. No direction at all:
 *                    no beam, rather than a wrong one.
 * DEPENDS ON   : the browser's DeviceOrientation events, maplibre map, the dot
 *                drawn by MapLibre's GeolocateControl (js/locate.js).
 * CONTROLS     : the .user-heading beam inside .maplibregl-user-location-dot.
 * USED BY      : js/locate.js
 */

/**
 * Wire the heading beam.
 * @param {maplibregl.Map} map
 * @returns {{ start: () => void, fromGps: (coords: GeolocationCoordinates) => void }}
 */
export function initHeading(map) {
  let heading = null; // degrees clockwise from north, or null when unknown
  let listening = false;

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
    draw();
  }

  /** Start listening to the compass (call from a tap). */
  async function start() {
    if (listening || typeof DeviceOrientationEvent === 'undefined') return;
    try {
      // iPhone asks the user; other browsers don't have this step.
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
      }
    } catch (error) {
      return; // permission refused or not allowed here: no beam
    }
    listening = true;
    // 'deviceorientationabsolute' (Android Chrome) is measured from north; plain 'deviceorientation' may not be.
    const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventName, onOrientation);
  }

  map.on('rotate', draw);

  return {
    start,
    /**
     * GPS reports a direction only while you're moving; use it when there's no compass.
     * @param {GeolocationCoordinates} coords
     */
    fromGps(coords) {
      const moving = typeof coords.heading === 'number' && !Number.isNaN(coords.heading) && coords.speed > 0.5;
      if (moving && !listening) heading = coords.heading;
      draw();
    },
  };
}
