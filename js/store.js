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
  selectedVia: null, // how it was chosen: 'map' (tapped a badge) or 'search'
  sheetWaiting: false, // true = open the sheet once the map has flown to the building
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
   * Choose a building. The map flies to it first; when it arrives it calls
   * sheetCanOpen(), which opens the sheet on the first floor.
   * Choosing the building that's already selected just opens its sheet.
   * @param {object} building - a record from data/buildings.geojson
   * @param {'map'|'search'} via - where it was chosen (sets the pause before the sheet opens)
   */
  selectBuilding(building, via) {
    if (building.id === state.selectedId) {
      update({ sheetOpen: true, sheetWaiting: false, searching: false });
      return;
    }
    update({
      selectedId: building.id,
      selectedVia: via,
      sheetOpen: false,
      sheetWaiting: true,
      activeFloor: building.floors[0] ?? null,
      searching: false,
    });
  },

  /**
   * The map has finished flying to a building: open its sheet, unless the
   * user has since picked something else or already opened/closed the sheet.
   * @param {string} buildingId - the building the map flew to
   */
  sheetCanOpen(buildingId) {
    if (state.sheetWaiting && state.selectedId === buildingId) update({ sheetOpen: true, sheetWaiting: false });
  },

  /** Let go of the selected building and close its sheet. */
  clearSelection() {
    update({ selectedId: null, selectedVia: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: false });
  },

  /** Open the selected building's sheet now (the Info pill). */
  openSheet() {
    update({ sheetOpen: true, sheetWaiting: false });
  },

  /** Close the sheet but keep the building selected. */
  closeSheet() {
    update({ sheetOpen: false, sheetWaiting: false });
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
    update({ selectedId: null, selectedVia: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: true });
  },

  /** Close search (does nothing if it's already closed). */
  endSearch() {
    if (state.searching) update({ searching: false });
  },
};
