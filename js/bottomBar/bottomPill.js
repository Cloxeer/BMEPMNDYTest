/**
 * @file js/bottomBar/bottomPill.js
 * @summary The pill at the bottom of the screen. It never moves; only its words change.
 *
 * WHAT IT DOES : Nothing chosen            -> "Tap a building"
 *                A building chosen          -> "Info ^"     (tap: open the sheet)
 *                Sheet open                 -> "Floor 1 ^"  until the sheet is closed.
 *                                              Tap it: the other floors glide up out
 *                                              of the pill; pick one to switch.
 *                Directions on (map showing)-> the whole bar steps aside for the
 *                                              turn-by-turn card (js/directions/routeCard.js)
 *                Search open                -> "Searching…"
 * DEPENDS ON   : ../core/config.js (words), ../core/store.js, #pill in index.html,
 *                styles/bottomBar.css.
 * CONTROLS     : #pill-main, and the #pill-choose stack of floors.
 * USED BY      : js/main.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';

export class BottomPill {
  /**
   * @param {Object.<string, object>} buildingsById
   */
  constructor(buildingsById) {
    this.buildingsById = buildingsById;
    this.words = CONFIG.pill;
    this.bar = document.querySelector('#pill');
    this.pill = document.querySelector('#pill-main');
    this.label = document.querySelector('#pill-label');
    this.stack = document.querySelector('#pill-choose');

    this.pill.addEventListener('click', (event) => this.onPillTap(event));
    // Tapping anywhere else hides the floor stack.
    document.addEventListener('click', () => this.setStackOpen(false));
    store.subscribe((state) => this.update(state));
  }

  /**
   * @param {number} floor
   * @returns {string} e.g. "Floor 2"
   */
  floorName(floor) {
    return this.words.floorText + ' ' + floor;
  }

  /**
   * Change the pill's words with a quick fade, so "Info" morphs into "Floor 1".
   * @param {string} text
   */
  setLabel(text) {
    if (this.label.textContent === text) {
      return;
    }
    const wasEmpty = this.label.textContent === '';
    this.label.textContent = text;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (wasEmpty || reduceMotion) {
      return; // no fade the first time, or when the phone asks for less motion
    }
    const frames = [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }];
    this.label.animate(frames, { duration: this.words.labelSwapTime, easing: CONFIG.theme.smooth });
  }

  /** @param {boolean} open - show or hide the stack of other floors */
  setStackOpen(open) {
    if (open === this.stackOpen) {
      return; // already so: every tap on the page asks to close, so this must cost nothing
    }
    this.stackOpen = open;
    this.stack.classList.toggle('is-open', open);
    this.stack.inert = !open; // hidden floor buttons can't be reached with the Tab key
    this.pill.classList.toggle('is-stack-open', open);
    this.pill.setAttribute('aria-expanded', String(open));
  }

  /**
   * Fill the stack with a button for every floor except the one showing now.
   * Lower floors sit closest to the pill.
   * @param {object} building
   * @param {number} currentFloor
   */
  buildStack(building, currentFloor) {
    this.stack.innerHTML = '';
    let slot = 0; // 0 is the slot closest to the pill
    for (const floor of building.floors) {
      if (floor === currentFloor) {
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pill pill--floor';
      button.style.setProperty('--i', slot); // its slot, which also staggers the glide
      button.textContent = this.floorName(floor);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.setStackOpen(false);
        store.showFloor(floor);
      });
      this.stack.appendChild(button);
      slot += 1;
    }
  }

  /**
   * The pill was tapped: open the sheet, or show the other floors.
   * @param {MouseEvent} event
   */
  onPillTap(event) {
    event.stopPropagation();
    const state = store.get();
    const building = this.buildingsById[state.selectedId];
    if (!building) {
      return; // nothing chosen: nothing to open
    }

    if (!state.sheetOpen) {
      store.openSheet();
      return;
    }
    if (building.floors.length <= 1) {
      return; // no other floors to show
    }
    const open = !this.stack.classList.contains('is-open');
    if (open) {
      this.buildStack(building, state.activeFloor);
      // Make the browser lay out the new buttons in their closed spot first;
      // otherwise they'd appear already open, with no glide.
      this.stack.getBoundingClientRect();
    }
    this.setStackOpen(open);
  }

  /**
   * Show the right words, arrow and spot for the current state.
   * @param {object} state
   */
  update(state) {
    const building = this.buildingsById[state.selectedId];
    const sheetShowing = Boolean(building && state.sheetOpen);
    const hasOtherFloors = Boolean(building && building.floors.length > 1);

    // Screen readers hear the same words as the label, plus what tapping does.
    let text = this.words.infoText;
    let spoken = this.words.infoSpokenText;
    if (state.searching) {
      text = this.words.searchingText;
      spoken = text;
    } else if (!building) {
      text = this.words.idleText;
      spoken = text;
    } else if (sheetShowing && state.activeFloor) {
      text = this.floorName(state.activeFloor);
      spoken = text;
      if (hasOtherFloors) {
        spoken = text + ', ' + this.words.chooseFloorSpokenText;
      }
    }
    this.setLabel(text);
    this.pill.setAttribute('aria-label', spoken);

    // The ^ only shows when tapping will reveal something.
    let showArrow = Boolean(building); // "Info ^"
    if (sheetShowing) {
      showArrow = hasOtherFloors; // "Floor 1 ^" only when there are other floors
    }
    this.pill.classList.toggle('has-chev', showArrow);
    this.pill.setAttribute('aria-disabled', String(!building));

    // Directions on and the map in view: the turn card takes this spot.
    const routeCardShowing = Boolean(state.directionsTo && !state.sheetOpen && !state.searching);
    this.bar.classList.toggle('is-routing', routeCardShowing);

    if (!sheetShowing) {
      this.setStackOpen(false);
    }
  }
}
