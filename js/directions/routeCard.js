/**
 * @file js/directions/routeCard.js
 * @summary The turn-by-turn card at the bottom of the map while directions are on.
 *
 * WHAT IT DOES : Shows the next turn ("590 ft · Turn right onto the path") with its
 *                arrow, and a walking figure with the time, distance and arrival time.
 *                  - Tap the card: it grows to show a Walk / Bike / Drive switch and
 *                    every step (like Apple Maps). Tap again to fold it back.
 *                    The mode is remembered on this device (js/pages/settings.js).
 *                  - X asks "Are you sure you want to end your trip?" first.
 *                It only shows while you're looking at the map (not over the sheet
 *                or search); the pill hides while it's up (js/bottomBar/bottomPill.js).
 * DEPENDS ON   : Framework7 (question box, segmented switch), ../core/config.js,
 *                ../core/store.js, ../core/html.js, #route-card in index.html.
 * CONTROLS     : #route-card.
 * USED BY      : js/main.js (makes it and hands it to js/directions/directions.js)
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/html.js';

export class RouteCard {
  /**
   * @param {Framework7} app - for the "end trip?" question
   */
  constructor(app) {
    this.app = app;
    this.words = CONFIG.directions;
    this.card = document.querySelector('#route-card');
    this.toggle = document.querySelector('#route-toggle');
    this.turnIcon = document.querySelector('#route-turn-icon');
    this.instruction = document.querySelector('#route-instruction');
    this.summary = document.querySelector('#route-summary');
    this.stepList = document.querySelector('#route-steps');
    this.hasTrip = false; // nothing to show until the first route is worked out
    this.modeIcon = document.querySelector('#route-mode-icon');
    this.modeSwitch = document.querySelector('#route-modes');

    this.buildModeSwitch();
    this.modeSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]');
      if (button) {
        store.setTravelMode(button.dataset.mode); // js/pages/settings.js remembers it
      }
    });

    // The card grows while it expands: keep its height up to date the whole time.
    new ResizeObserver(() => this.shareHeight()).observe(this.card);

    this.toggle.addEventListener('click', () => this.setExpanded(!this.card.classList.contains('is-expanded')));
    document.querySelector('#route-end').addEventListener('click', () => this.confirmEnd());

    store.subscribe((state) => this.update(state));
  }

  /** One button per travel mode in config.yml, plus Framework7's sliding highlight. */
  buildModeSwitch() {
    let html = '';
    for (const mode of Object.keys(this.words.modes)) {
      const look = this.words.modes[mode];
      html += '<button class="button" type="button" role="radio" data-mode="' + escapeHtml(mode) + '">' +
        '<span class="material-symbols-rounded" aria-hidden="true">' + escapeHtml(look.icon) + '</span>' +
        '<span>' + escapeHtml(look.label) + '</span></button>';
    }
    this.modeSwitch.innerHTML = html + '<span class="segmented-highlight"></span>';
  }

  /** Show the card only when there's a trip to show, directions are on, and the map is in view. */
  updateVisibility() {
    const state = store.get();
    const onMap = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    this.card.hidden = !(onMap && this.hasTrip);
    this.shareHeight();
  }

  /** Tell the page how tall the card is, so Map settings can sit just above it (styles/bottomBar.css). */
  shareHeight() {
    let height = 0;
    if (!this.card.hidden) {
      height = this.card.offsetHeight;
    }
    document.documentElement.style.setProperty('--route-card-height', height + 'px');
  }

  /** @param {boolean} expanded - show every step, or just the next one */
  setExpanded(expanded) {
    this.card.classList.toggle('is-expanded', expanded);
    this.toggle.setAttribute('aria-expanded', String(expanded));
  }

  /** Ask before ending the trip, so a stray tap doesn't lose the route. */
  confirmEnd() {
    const dialog = this.app.dialog.create({
      title: this.words.endTripTitle,
      text: this.words.endTripText,
      buttons: [
        { text: this.words.endTripNo },
        { text: this.words.endTripYes, bold: true, color: 'red', onClick: () => store.endDirections() },
      ],
    });
    dialog.open();
  }

  /**
   * Show the chosen travel mode, and fold the card away when directions end.
   * @param {object} state
   */
  update(state) {
    // The chosen mode: highlighted in the switch, and its figure next to the time.
    for (const button of this.modeSwitch.querySelectorAll('[data-mode]')) {
      const chosen = button.dataset.mode === state.travelMode;
      button.classList.toggle('button-active', chosen);
      button.setAttribute('aria-checked', String(chosen));
    }
    this.modeIcon.textContent = this.words.modes[state.travelMode].icon;

    if (!state.directionsTo) {
      this.hasTrip = false; // the next trip starts with a fresh, folded card
      this.setExpanded(false);
    }
    this.updateVisibility();
  }

  /**
   * Put a trip on the card.
   * @param {{ instruction: string, icon: string, summary: string, steps: object[] }} trip - from planTrip() in js/logic/turns.js
   */
  show(trip) {
    this.turnIcon.textContent = trip.icon;
    this.instruction.textContent = trip.instruction;
    this.summary.textContent = trip.summary;

    let html = '';
    for (const step of trip.steps) {
      html += '<li class="route-step"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(step.icon) + '</i>' +
        '<span><span class="route-step-text">' + escapeHtml(step.text) + '</span>';
      if (step.distance) {
        html += '<span class="route-step-distance">' + escapeHtml(step.distance) + '</span>';
      }
      html += '</span></li>';
    }
    this.stepList.innerHTML = html;

    this.hasTrip = true;
    this.updateVisibility();
  }
}
