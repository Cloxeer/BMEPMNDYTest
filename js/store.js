/**
 * @file js/store.js
 * @summary The app's shared memory, and the only place it gets changed.
 *
 * WHAT IT DOES : Remembers which building is selected, whether its sheet is
 *                open, which floor is showing, and whether search is open.
 *                Other files change it only through the named actions below
 *                (selectBuilding, closeSheet, ...), so every rule about what
 *                changes together lives here. Anything that called
 *                store.subscribe(fn) is told after every change.
 * DEPENDS ON   : nothing.
 * CONTROLS     : the app state.
 * USED BY      : js/app.js, js/map.js, js/buildingSheet.js, js/pill.js, js/search.js
 */

const state = {
  selectedId: null, // id of the chosen building, or null
  sheetOpen: false, // is the building sheet showing?
  activeFloor: null, // floor shown in the sheet
  searching: false, // is the search drop-down open?
};

const subscribers = new Set();

/**
 * Change some state, then tell every subscriber.
 * @param {object} changes - fields to update
 */
function update(changes) {
  Object.assign(state, changes);
  subscribers.forEach((fn) => fn(state));
}

export const store = {
  /** @returns {object} the current state (read it; change it with the actions below) */
  get() {
    return state;
  },

  /**
   * Run `fn` now and after every change.
   * @param {(state: object) => void} fn
   */
  subscribe(fn) {
    subscribers.add(fn);
    fn(state);
  },

  /**
   * Choose a building: open its sheet on its first floor.
   * @param {object} building - a record from data/buildings.geojson
   */
  selectBuilding(building) {
    update({ selectedId: building.id, sheetOpen: true, activeFloor: building.floors[0] || null, searching: false });
  },

  /** Let go of the selected building and close its sheet. */
  clearSelection() {
    update({ selectedId: null, sheetOpen: false, activeFloor: null, searching: false });
  },

  /** Open the selected building's sheet. */
  openSheet() {
    update({ sheetOpen: true });
  },

  /** Close the sheet but keep the building selected. */
  closeSheet() {
    update({ sheetOpen: false });
  },

  /**
   * Show a different floor.
   * @param {number} floor
   */
  showFloor(floor) {
    update({ activeFloor: floor });
  },

  /** Open search: any selected building is let go. */
  startSearch() {
    update({ selectedId: null, sheetOpen: false, activeFloor: null, searching: true });
  },

  /** Close search (does nothing if it's already closed). */
  endSearch() {
    if (state.searching) update({ searching: false });
  },
};
