/**
 * @file js/bottomBar/mapSettingsButton.js
 * @summary The round Map settings button left of the pill, and the options it opens.
 *
 * WHAT IT DOES : Tap the button: it turns into a close button and the options
 *                glide up out of it, one after another:
 *                  - My location        (on / off)
 *                  - Turn map with me   (on / off: the map faces the way you face)
 *                  - Building names     (on / off: the same switch as the Settings page)
 *                  - Home               (flies to Corbett Center Student Union, north up)
 *                An option that's on has a red icon; off is white. Tap outside,
 *                or the button again, to close.
 *                When a building is chosen, this spot shows the Directions button
 *                instead (./directionsButton.js).
 *                During directions the bottom bar steps aside for the turn card, so
 *                the button (with its options) moves to #route-tools, just above
 *                the card on the left, and comes back when the trip ends.
 * DEPENDS ON   : Framework7 (message box), ../core/config.js, ../core/store.js,
 *                ../core/html.js, #settings-anchor in index.html.
 * CONTROLS     : #settings-anchor (#settings-btn and #map-options), and where it sits.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/html.js';

export class MapSettingsButton {
  /**
   * @param {Framework7} app - for messages
   * @param {MyLocation} myLocation - from js/map/myLocation.js
   * @param {CampusMap} campusMap - for flying home
   * @param {Object.<string, object>} buildingsById - to find the home building
   */
  constructor(app, myLocation, campusMap, buildingsById) {
    this.app = app;
    this.myLocation = myLocation;
    this.campusMap = campusMap;
    this.buildingsById = buildingsById;
    this.settings = CONFIG.mapSettings;
    this.button = document.querySelector('#settings-btn');
    this.buttonIcon = this.button.querySelector('i');
    this.stack = document.querySelector('#map-options');
    this.anchor = document.querySelector('#settings-anchor'); // the button and its options, moved together
    this.barSpot = this.anchor.parentElement; // the bottom bar, next to the pill
    this.routeSpot = document.querySelector('#route-tools'); // above the turn card

    this.buildOptions();

    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.setOpen(!this.stack.classList.contains('is-open'));
    });
    this.stack.addEventListener('click', (event) => this.onOptionTap(event));
    document.addEventListener('click', () => this.setOpen(false)); // tap anywhere else: close

    this.myLocation.onChange(() => this.showWhatIsOn());
    this.myLocation.compass.onFollowChange(() => this.showWhatIsOn());

    store.subscribe((state) => this.update(state));
    this.setOpen(false);
  }

  /** One row per option in config.yml, top to bottom. */
  buildOptions() {
    const names = Object.keys(this.settings.options);
    let html = '';
    for (let row = 0; row < names.length; row += 1) {
      const name = names[row];
      const look = this.settings.options[name];
      const slot = names.length - 1 - row; // --i staggers the glide: the bottom row goes first
      html += '<button class="map-option" type="button" data-option="' + escapeHtml(name) + '" style="--i: ' + slot + '">' +
        '<span class="map-option-icon"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(look.icon) + '</i></span>' +
        '<span class="map-option-label">' + escapeHtml(look.label) + '</span></button>';
    }
    this.stack.innerHTML = html;
  }

  /**
   * Is an option on right now? Home is an action, so it's never "on".
   * @param {string} name - 'location', 'follow', 'names' or 'home'
   * @returns {boolean|null} null for actions
   */
  isOptionOn(name) {
    if (name === 'location') {
      return this.myLocation.isOn();
    }
    if (name === 'follow') {
      return this.myLocation.compass.isFollowing();
    }
    if (name === 'names') {
      return store.get().showNames;
    }
    return null;
  }

  /** Colour every toggle by whether it's really on (red) or off (white). */
  showWhatIsOn() {
    for (const row of this.stack.querySelectorAll('[data-option]')) {
      const on = this.isOptionOn(row.dataset.option);
      if (on === null) {
        continue; // actions have no on/off
      }
      row.classList.toggle('is-on', on);
      row.setAttribute('aria-pressed', String(on));
    }
  }

  /** @param {boolean} open - show or hide the options */
  setOpen(open) {
    this.stack.classList.toggle('is-open', open);
    this.stack.inert = !open; // hidden options can't be tapped or reached with Tab
    this.button.classList.toggle('is-open', open);
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      this.buttonIcon.textContent = 'xmark';
      this.showWhatIsOn();
    } else {
      this.buttonIcon.textContent = this.settings.icon;
    }
  }

  /**
   * An option was tapped: do what it does. The panel stays open.
   * @param {MouseEvent} event
   */
  onOptionTap(event) {
    event.stopPropagation(); // stops the "tap anywhere else" close
    const row = event.target.closest('[data-option]');
    if (row) {
      const name = row.dataset.option;
      if (name === 'location') {
        this.myLocation.setOn(!this.myLocation.isOn());
      } else if (name === 'follow') {
        this.toggleFollow();
      } else if (name === 'names') {
        store.setShowNames(!store.get().showNames);
      } else if (name === 'home') {
        this.goHome();
      }
    }
    this.showWhatIsOn();
  }

  /** "Turn map with me": it needs a compass, so explain when there isn't one. */
  async toggleFollow() {
    const compass = this.myLocation.compass;
    const turningOn = !compass.isFollowing();
    const worked = await compass.setFollow(turningOn);
    if (!worked) {
      this.app.dialog.alert(this.settings.noCompassText, this.settings.noCompassTitle);
    } else if (turningOn && !this.myLocation.isOn()) {
      this.myLocation.setOn(true); // following makes sense with your dot showing
    }
    this.showWhatIsOn();
  }

  /** Fly home to Corbett Center Student Union, facing north. */
  goHome() {
    this.myLocation.compass.setFollow(false);
    this.campusMap.showHome(this.buildingsById[CONFIG.map.homeBuilding].center);
    this.setOpen(false);
  }

  /**
   * Put the button in the right spot, and show it only when it belongs there.
   * @param {object} state
   */
  update(state) {
    // Directions on and the map in view: the turn card is up, so sit above it.
    const routing = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    let spot = this.barSpot;
    if (routing) {
      spot = this.routeSpot;
    }
    if (this.anchor.parentElement !== spot) {
      this.setOpen(false);
      // Back in the bar it goes first, where index.html has it, so the Directions button stays on top of it.
      spot.insertBefore(this.anchor, spot.firstChild);
    }

    // Otherwise, only when nothing is chosen (a chosen building shows Directions here).
    const show = routing || (!state.selectedId && !state.sheetOpen);
    this.button.classList.toggle('is-hidden', !show);
    this.button.inert = !show;
    if (!show) {
      this.setOpen(false);
    }
    this.showWhatIsOn();
  }
}
