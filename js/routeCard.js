/**
 * @file js/routeCard.js
 * @summary The turn-by-turn card at the bottom of the map while directions are on.
 *
 * WHAT IT DOES : Shows the next turn ("590 ft · Turn right onto the path") with
 *                its arrow, and a walking figure with the time, distance and
 *                arrival time.
 *                  - Tap the card: it grows to list every step (like Apple Maps);
 *                    tap again to fold it back.
 *                  - X asks "Are you sure you want to end your trip?" first.
 *                It only shows while you're looking at the map (not over the
 *                sheet or search); the pill hides while it's up (js/pill.js).
 * DEPENDS ON   : Framework7 (confirm dialog), ./config.js, ./store.js, ./html.js,
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

  /** Show the card only with a trip to show, directions on, and the map in view. */
  function updateVisibility() {
    const state = store.get();
    const onMap = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    card.hidden = !(onMap && hasTrip);
  }

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
