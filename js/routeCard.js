/**
 * @file js/routeCard.js
 * @summary The turn-by-turn card at the bottom of the map while directions are on.
 *
 * WHAT IT DOES : Shows the next turn ("350 ft · Turn left onto Williams Avenue")
 *                with its arrow, and a walking figure with the time, distance
 *                and arrival time. X ends the route. It only shows while you're
 *                looking at the map (not over the sheet or search); the pill
 *                hides while it's up (js/pill.js).
 * DEPENDS ON   : ./store.js, #route-card in index.html.
 * CONTROLS     : #route-card.
 * USED BY      : js/app.js (made there, handed to js/directions.js)
 */

import { store } from './store.js';

/**
 * Wire the card.
 * @returns {{ show: (step: object) => void }} show() puts a step from js/turns.js on the card
 */
export function initRouteCard() {
  const card = document.querySelector('#route-card');
  const icon = document.querySelector('#route-turn-icon');
  const instruction = document.querySelector('#route-instruction');
  const summary = document.querySelector('#route-summary');
  let hasStep = false; // nothing to show until the first route is worked out

  /** Show the card only with a step to show, directions on, and the map in view. */
  function updateVisibility() {
    const state = store.get();
    const onMap = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    card.hidden = !(onMap && hasStep);
  }

  document.querySelector('#route-end').addEventListener('click', () => store.endDirections());

  store.subscribe((state) => {
    if (!state.directionsTo) hasStep = false; // the next route starts with a fresh card
    updateVisibility();
  });

  return {
    /** @param {{ instruction: string, icon: string, summary: string }} step */
    show(step) {
      icon.textContent = step.icon;
      instruction.textContent = step.instruction;
      summary.textContent = step.summary;
      hasStep = true;
      updateVisibility();
    },
  };
}
