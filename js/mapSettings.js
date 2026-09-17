/**
 * @file js/mapSettings.js
 * @summary The round Map settings button left of the pill, and the options it opens.
 *
 * WHAT IT DOES : Tap the button: it morphs open and the options glide up out
 *                of it, one after another:
 *                  - My location        (on / off)
 *                  - Turn map with me   (on / off: the map faces the way you face)
 *                  - Building names     (on / off: same switch as the Settings page)
 *                  - Home               (flies to Corbett Center Student Union, north up)
 *                An option that's on has a red icon; off is white. Tap outside,
 *                or the button again, to close.
 *                When a building is selected, this spot shows the Directions
 *                button instead (js/askDirections.js).
 *                During directions the bottom bar steps aside for the turn card,
 *                so the button (with its options) moves to #route-tools, just
 *                above the card on the left, and comes back when the trip ends.
 * DEPENDS ON   : Framework7 (alert dialog), ./config.js, ./store.js, ./html.js, ./map.js (showHome),
 *                js/locate.js (handed in), #map-settings in index.html.
 * CONTROLS     : #settings-anchor (#settings-btn and #map-options), and where it sits.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';
import { showHome } from './map.js';

/**
 * Wire the Map settings button.
 * @param {Framework7} app - for messages
 * @param {object} locate - from js/locate.js
 * @param {Object.<string, object>} buildingsById - to find the home building
 */
export function initMapSettings(app, locate, buildingsById) {
  const settings = CONFIG.mapSettings;
  const button = document.querySelector('#settings-btn');
  const buttonIcon = button.querySelector('i');
  const stack = document.querySelector('#map-options');
  const anchor = document.querySelector('#settings-anchor'); // button + options, moved as one
  const homeSpot = anchor.parentElement; // the bottom bar, next to the pill
  const routeSpot = document.querySelector('#route-tools'); // above the turn card

  // What each option does. "isOn" is null for one-tap actions (they're never "on").
  const options = {
    location: { isOn: () => locate.isOn(), tap: () => locate.setOn(!locate.isOn()) },
    follow: { isOn: () => locate.heading.isFollowing(), tap: toggleFollow },
    names: { isOn: () => store.get().showNames, tap: () => store.setShowNames(!store.get().showNames) },
    home: { isOn: null, tap: goHome },
  };

  // One row per option in config.yml, top to bottom; --i staggers the glide (bottom row first).
  const names = Object.keys(settings.options);
  stack.innerHTML = names
    .map((name, row) => {
      const look = settings.options[name];
      return '<button class="map-option" type="button" data-option="' + escapeHtml(name) + '" style="--i: ' + (names.length - 1 - row) + '">' +
        '<span class="map-option-icon"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(look.icon) + '</i></span>' +
        '<span class="map-option-label">' + escapeHtml(look.label) + '</span></button>';
    })
    .join('');

  /** Colour every toggle by whether it's really on (red) or off (white). */
  function refresh() {
    stack.querySelectorAll('[data-option]').forEach((row) => {
      const option = options[row.dataset.option];
      if (!option.isOn) return; // actions have no on/off
      const on = option.isOn();
      row.classList.toggle('is-on', on);
      row.setAttribute('aria-pressed', String(on));
    });
  }

  /** @param {boolean} open - show or hide the options */
  function setOpen(open) {
    stack.classList.toggle('is-open', open);
    stack.inert = !open; // hidden options can't be tapped or tabbed to
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    buttonIcon.textContent = open ? 'xmark' : settings.icon;
    if (open) refresh();
  }

  /** "Turn map with me": needs a compass, so explain if there isn't one. */
  async function toggleFollow() {
    const turningOn = !locate.heading.isFollowing();
    const worked = await locate.heading.setFollow(turningOn);
    if (!worked) app.dialog.alert(settings.noCompassText, settings.noCompassTitle);
    else if (turningOn && !locate.isOn()) locate.setOn(true); // following makes sense with the dot showing
    refresh();
  }

  /** Fly home to Corbett Center Student Union, facing north. */
  function goHome() {
    locate.heading.setFollow(false);
    showHome(buildingsById[CONFIG.map.homeBuilding].center);
    setOpen(false);
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!stack.classList.contains('is-open'));
  });
  stack.addEventListener('click', (event) => {
    event.stopPropagation(); // tapping an option keeps the panel open
    const row = event.target.closest('[data-option]');
    if (row) options[row.dataset.option].tap();
    refresh();
  });
  document.addEventListener('click', () => setOpen(false)); // tap anywhere else: close

  locate.onChange(refresh);
  locate.heading.onFollowChange(refresh);

  store.subscribe((state) => {
    // Directions on and the map in view: the turn card is up, so sit above it.
    const routing = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    const spot = routing ? routeSpot : homeSpot;
    if (anchor.parentElement !== spot) {
      setOpen(false);
      // Back in the bar it goes first, where index.html has it, so the Directions button stays on top of it.
      spot.insertBefore(anchor, spot.firstChild);
    }

    // Otherwise only with nothing selected (a selected building shows Directions here).
    const show = routing || (!state.selectedId && !state.sheetOpen);
    button.classList.toggle('is-hidden', !show);
    button.inert = !show;
    if (!show) setOpen(false);
    refresh();
  });
  setOpen(false);
}
