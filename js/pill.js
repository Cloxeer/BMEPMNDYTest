/**
 * @file js/pill.js
 * @summary The one pill at the bottom of the screen. It never moves.
 *
 * WHAT IT DOES : Nothing selected          -> "Tap a building"
 *                Building selected          -> "Info ^"  (tap: open the sheet)
 *                Sheet open                 -> "Floor 1 ^" until the sheet is closed.
 *                                              Tap it: the other floors glide up
 *                                              out of the pill; pick one to switch.
 *                Directions on (map showing)-> "End route" (tap: stop directions)
 *                Search open                -> "Searching…"
 * DEPENDS ON   : ./config.js (texts), ./store.js, #pill in index.html, styles/app.css.
 * CONTROLS     : #pill-main and the #pill-choose floor stack (the location
 *                button next to it is js/locate.js).
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

  /**
   * @param {number} floor
   * @returns {string} e.g. "Floor 2"
   */
  function floorName(floor) {
    return labels.floorText + ' ' + floor;
  }

  /**
   * Change the pill's words with a quick fade, so "Info" morphs into "Floor 1".
   * @param {string} words
   */
  function setLabel(words) {
    if (label.textContent === words) return;
    const wasEmpty = label.textContent === '';
    label.textContent = words;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (wasEmpty || reduceMotion) return; // no fade on first draw
    label.animate(
      [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }],
      { duration: labels.labelSwapTime, easing: CONFIG.theme.smooth },
    );
  }

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

  /**
   * Is the pill showing "End route"? (Directions on, and you're looking at the map.)
   * @param {object} state
   * @returns {boolean}
   */
  function routeShowing(state) {
    return Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
  }

  pill.addEventListener('click', (event) => {
    event.stopPropagation();
    const state = store.get();
    if (routeShowing(state)) {
      store.endDirections();
      return;
    }
    const building = buildingsById[state.selectedId];
    if (!building) return; // nothing selected: nothing to open

    if (!state.sheetOpen) {
      store.openSheet();
    } else if (building.floors.length > 1) {
      const open = !stack.classList.contains('is-open');
      if (open) {
        buildStack(building, state.activeFloor);
        // Make the browser lay out the new pills in their closed spot first;
        // otherwise they'd appear already open, with no glide.
        void stack.offsetHeight;
      }
      setStackOpen(open);
    }
  });

  // Tapping anywhere else hides the floor stack.
  document.addEventListener('click', () => setStackOpen(false));

  store.subscribe((state) => {
    const building = buildingsById[state.selectedId];
    const sheetShowing = Boolean(building && state.sheetOpen);
    const hasOtherFloors = Boolean(building && building.floors.length > 1);

    // Screen readers hear the same words as the label, plus what tapping does.
    let words = labels.infoText;
    let spoken = labels.infoSpokenText;
    if (state.searching) {
      words = labels.searchingText;
      spoken = words;
    } else if (routeShowing(state)) {
      words = CONFIG.directions.endText;
      spoken = words;
    } else if (!building) {
      words = labels.idleText;
      spoken = words;
    } else if (sheetShowing && state.activeFloor) {
      words = floorName(state.activeFloor);
      spoken = hasOtherFloors ? words + ', ' + labels.chooseFloorSpokenText : words;
    }
    setLabel(words);
    pill.setAttribute('aria-label', spoken);

    // The ^ only appears when tapping will reveal something.
    let showChevron = Boolean(building); // "Info ^"
    if (sheetShowing) showChevron = hasOtherFloors; // "Floor 1 ^" only if there are other floors
    if (routeShowing(state)) showChevron = false; // "End route"
    pill.classList.toggle('has-chev', showChevron);
    pill.setAttribute('aria-disabled', String(!building && !routeShowing(state)));

    if (!sheetShowing) setStackOpen(false);
  });
}
