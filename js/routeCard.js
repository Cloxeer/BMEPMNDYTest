/**
 * @file js/routeCard.js
 * @summary The turn-by-turn card at the bottom of the map while directions are on.
 *
 * WHAT IT DOES : Shows the next turn ("590 ft · Turn right onto the path") with
 *                its arrow, and a walking figure with the time, distance and
 *                arrival time.
 *                  - Tap the card: it grows to show a Walk / Bike / Drive switch
 *                    and every step (like Apple Maps); tap again to fold it back.
 *                    The mode is remembered on this device (js/settings.js).
 *                  - X asks "Are you sure you want to end your trip?" first.
 *                It only shows while you're looking at the map (not over the
 *                sheet or search); the pill hides while it's up (js/pill.js).
 * DEPENDS ON   : Framework7 (confirm dialog, segmented switch), ./config.js, ./store.js, ./html.js,
 *                #route-card in index.html.
 * CONTROLS     : #route-card.
 * USED BY      : js/app.js (made there, handed to js/directions.js)
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';

/**
 * Wire the card.
 * @param {Framework7} app - for the "end trip?" dialog
 * @returns {{ show: (trip: object) => void }} show() puts a trip from js/turns.js (planTrip) on the card
 */
export function initRouteCard(app) {
  const words = CONFIG.directions;
  const card = document.querySelector('#route-card');
  const toggle = document.querySelector('#route-toggle');
  const icon = document.querySelector('#route-turn-icon');
  const instruction = document.querySelector('#route-instruction');
  const summary = document.querySelector('#route-summary');
  const stepList = document.querySelector('#route-steps');
  let hasTrip = false; // nothing to show until the first route is worked out
  const modeIcon = document.querySelector('#route-mode-icon');
  const modeSwitch = document.querySelector('#route-modes');

  /* ---------- Walk / Bike / Drive ---------- */

  // One button per mode in config.yml, plus Framework7's sliding highlight.
  modeSwitch.innerHTML = Object.entries(words.modes)
    .map(([mode, look]) => '<button class="button" type="button" role="radio" data-mode="' + escapeHtml(mode) + '">' +
      '<span class="material-symbols-rounded" aria-hidden="true">' + escapeHtml(look.icon) + '</span>' +
      '<span>' + escapeHtml(look.label) + '</span></button>')
    .join('') + '<span class="segmented-highlight"></span>';

  modeSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    store.setTravelMode(button.dataset.mode); // js/settings.js remembers it
  });


  /** Show the card only with a trip to show, directions on, and the map in view. */
  function updateVisibility() {
    const state = store.get();
    const onMap = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    card.hidden = !(onMap && hasTrip);
    shareHeight();
  }

  /** Tell the page how tall the card is, so the Map settings button can sit just above it (styles/app.css). */
  function shareHeight() {
    const height = card.hidden ? 0 : card.offsetHeight;
    document.documentElement.style.setProperty('--route-card-height', height + 'px');
  }
  // The card grows while it expands: keep the height current the whole time.
  new ResizeObserver(shareHeight).observe(card);

  /** @param {boolean} expanded - show every step, or just the next one */
  function setExpanded(expanded) {
    card.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  /** Ask before ending the trip, so a stray tap doesn't lose the route. */
  function confirmEnd() {
    app.dialog.create({
      title: words.endTripTitle,
      text: words.endTripText,
      buttons: [
        { text: words.endTripNo },
        { text: words.endTripYes, bold: true, color: 'red', onClick: () => store.endDirections() },
      ],
    }).open();
  }

  toggle.addEventListener('click', () => setExpanded(!card.classList.contains('is-expanded')));
  document.querySelector('#route-end').addEventListener('click', confirmEnd);

  store.subscribe((state) => {
    // Show the chosen mode: highlighted in the switch, and its figure next to the time.
    modeSwitch.querySelectorAll('[data-mode]').forEach((button) => {
      const chosen = button.dataset.mode === state.travelMode;
      button.classList.toggle('button-active', chosen);
      button.setAttribute('aria-checked', String(chosen));
    });
    modeIcon.textContent = words.modes[state.travelMode].icon;

    if (!state.directionsTo) {
      hasTrip = false; // the next trip starts with a fresh, folded card
      setExpanded(false);
    }
    updateVisibility();
  });

  return {
    /** @param {{ instruction: string, icon: string, summary: string, steps: object[] }} trip */
    show(trip) {
      icon.textContent = trip.icon;
      instruction.textContent = trip.instruction;
      summary.textContent = trip.summary;
      stepList.innerHTML = trip.steps
        .map((step) => '<li class="route-step"><i class="icon f7-icons" aria-hidden="true">' + escapeHtml(step.icon) + '</i>' +
          '<span><span class="route-step-text">' + escapeHtml(step.text) + '</span>' +
          (step.distance ? '<span class="route-step-distance">' + escapeHtml(step.distance) + '</span>' : '') +
          '</span></li>')
        .join('');
      hasTrip = true;
      updateVisibility();
    },
  };
}
