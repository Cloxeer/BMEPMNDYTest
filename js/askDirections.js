/**
 * @file js/askDirections.js
 * @summary The Directions button, and the "Get directions?" question before a trip starts.
 *
 * WHAT IT DOES : When a building is selected, a round Directions button takes
 *                the Map settings button's spot, left of the pill. Tapping it
 *                (or tapping a room on a floor plan, js/floorPlan.js) asks:
 *                  - no trip yet:            "Get directions to Room 228, Hardman and Jacobs…?"
 *                  - trip to somewhere else: "You're on your way to X. Get directions to Y?"
 *                  - trip already going here: no question, just shows the route.
 *                Answering yes starts directions (js/directions.js takes over).
 * DEPENDS ON   : Framework7 (dialog), ./config.js, ./store.js, #directions-btn in index.html.
 * CONTROLS     : #directions-btn.
 * USED BY      : js/app.js (ask() is also handed to js/buildingSheet.js for room taps)
 */

import { CONFIG } from './config.js';
import { store } from './store.js';

/**
 * Wire the Directions button.
 * @param {Framework7} app
 * @param {Object.<string, object>} buildingsById
 * @returns {{ ask: () => void }} ask about directions to the selected building / room
 */
export function initDirectionsButton(app, buildingsById) {
  const words = CONFIG.directions;
  const button = document.querySelector('#directions-btn');

  /**
   * How a place is named in the questions.
   * @param {string} buildingId
   * @param {object|null} room
   * @returns {string} e.g. "Room 228, Hardman and Jacobs Undergraduate Learning Center"
   */
  function placeName(buildingId, room) {
    const name = buildingsById[buildingId].name;
    return room ? CONFIG.search.roomText + ' ' + room.number + ', ' + name : name;
  }

  /**
   * One question with a "no" and a "yes" button; yes starts directions.
   * @param {string} title
   * @param {string} text
   * @param {string} no
   * @param {string} yes
   */
  function confirm(title, text, no, yes) {
    app.dialog.create({
      title,
      text,
      buttons: [{ text: no }, { text: yes, bold: true, onClick: () => store.startDirections() }],
    }).open();
  }

  /** Ask before starting (or switching) directions to the selected building and room. */
  function ask() {
    const state = store.get();
    if (!state.selectedId) return;
    const current = state.directionsTo;
    const roomNumber = (room) => (room ? room.number : '');
    const here = placeName(state.selectedId, state.selectedRoom);

    if (!current) {
      confirm(words.askTitle, words.askText + ' ' + here + '?', words.askNo, words.askYes);
    } else if (current.buildingId === state.selectedId && roomNumber(current.room) === roomNumber(state.selectedRoom)) {
      store.startDirections(); // already going here: just show the route
    } else {
      confirm(words.switchTitle,
        words.switchFromText + ' ' + placeName(current.buildingId, current.room) + '. ' + words.switchToText + ' ' + here + '?',
        words.switchNo, words.switchYes);
    }
  }

  button.addEventListener('click', ask);

  // Shown whenever a building is selected (map or sheet); the Map settings button has the spot otherwise.
  store.subscribe((state) => {
    const show = Boolean(state.selectedId);
    button.classList.toggle('is-hidden', !show);
    button.inert = !show;
  });

  return { ask };
}
