/**
 * @file js/pill.js
 * @summary The one pill at the bottom of the screen. It never moves.
 *
 * WHAT IT DOES : Nothing selected          -> "Tap a building"
 *                Building selected          -> "Info ^"  (tap: open the sheet)
 *                Sheet open, has floor plan -> "Floor 1 ^" until the sheet is closed.
 *                                              Tap it: the other floors appear
 *                                              stacked above; pick one to switch.
 *                Search open                -> "Searching…"
 * DEPENDS ON   : ./config.js (texts), ./store.js, #pill in index.html, styles/app.css.
 * CONTROLS     : #pill-main and the #pill-choose floor stack.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';

/**
 * Wire the pill to the store.
 * @param {Object.<string, object>} buildingsById
 */
export function initPill(buildingsById) {
  const pill = document.querySelector('#pill-main');
  const label = document.querySelector('#pill-label');
  const stack = document.querySelector('#pill-choose');
  const labels = CONFIG.pill;

  /** @param {number} floor  @returns {string} e.g. "Floor 2" */
  const floorName = (floor) => labels.floorText + ' ' + floor;

  /** @param {boolean} open - show or hide the stack of other floors */
  function setStackOpen(open) {
    stack.classList.toggle('is-open', open);
    stack.inert = !open; // hidden floor buttons can't be reached with Tab
    pill.classList.toggle('is-stack-open', open);
    pill.setAttribute('aria-expanded', String(open));
  }

  /**
   * Fill the stack with every floor except the one showing now.
   * Lower floors sit closest to the pill.
   * @param {object} building
   * @param {number} currentFloor
   */
  function buildStack(building, currentFloor) {
    stack.innerHTML = '';
    building.floors
      .filter((floor) => floor !== currentFloor)
      .forEach((floor, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pill pill--floor';
        button.style.setProperty('--i', index); // staggers the reveal
        button.textContent = floorName(floor);
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          setStackOpen(false);
          store.showFloor(floor);
        });
        stack.appendChild(button);
      });
  }

  pill.addEventListener('click', (event) => {
    event.stopPropagation();
    const state = store.get();
    const building = buildingsById[state.selectedId];
    if (!building) return; // nothing selected: nothing to open

    if (!state.sheetOpen) {
      store.openSheet();
    } else if (building.floorImages && building.floors.length > 1) {
      const open = !stack.classList.contains('is-open');
      if (open) buildStack(building, state.activeFloor);
      setStackOpen(open);
    }
  });

  // Tapping anywhere else hides the floor stack.
  document.addEventListener('click', () => setStackOpen(false));

  store.subscribe((state) => {
    const building = buildingsById[state.selectedId];
    const sheetShowing = Boolean(building && state.sheetOpen);
    const hasPlans = Boolean(building && building.floorImages); // only drawn plans get floor buttons
    const hasOtherFloors = hasPlans && building.floors.length > 1;

    // Screen readers hear the same words as the label, plus what tapping does.
    let words = labels.infoText;
    let spoken = 'Building info';
    if (state.searching) {
      words = labels.searchingText;
      spoken = words;
    } else if (!building) {
      words = labels.idleText;
      spoken = words;
    } else if (sheetShowing && hasPlans) {
      words = floorName(state.activeFloor || 1);
      spoken = hasOtherFloors ? words + ', choose another floor' : words;
    }
    label.textContent = words;
    pill.setAttribute('aria-label', spoken);

    // The ^ only appears when tapping will reveal something.
    pill.classList.toggle('has-chev', sheetShowing ? hasOtherFloors : Boolean(building));
    pill.setAttribute('aria-disabled', String(!building));

    if (!sheetShowing) setStackOpen(false);
  });
}
