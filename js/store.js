/**
 * @file js/store.js
 * @summary The app's tiny shared memory (the "single source of truth").
 *
 * WHAT IT DOES : Remembers what is selected and what is open, and lets any file
 *                (map, sheet, pill, search) react when that changes.
 * DEPENDS ON   : nothing.
 * CONTROLS     : which building is selected, whether the sheet is open, the
 *                orb "mode", and the active floor.
 * USED BY      : js/map.js, js/buildingSheet.js, js/pill.js, js/search.js, js/app.js
 *
 * HOW IT WORKS : call store.set({...}) to change something; every function that
 *                called store.subscribe(fn) then runs with the new state.
 */

const state = {
  selectedId: null, // id of the building the user tapped, or null
  sheetOpen: false, // is the bottom info sheet showing?
  mode: 'idle', // 'idle' | 'solving' | 'searching'  (drives the orb)
  activeFloor: null, // which floor is chosen for the selected building
};

const subscribers = new Set();

export const store = {
  /** @returns {object} the current state (read-only — change it with set()) */
  get() {
    return state;
  },

  /**
   * Change one or more pieces of state, then tell everyone who is listening.
   * @param {object} patch - the fields to update, e.g. { sheetOpen: true }
   */
  set(patch) {
    Object.assign(state, patch);
    subscribers.forEach((fn) => fn(state));
  },

  /**
   * Listen for state changes. Runs your function once right away, too.
   * @param {(state: object) => void} fn - what to run when state changes
   * @returns {() => void} call this to stop listening
   */
  subscribe(fn) {
    subscribers.add(fn);
    fn(state);
    return () => subscribers.delete(fn);
  },
};
