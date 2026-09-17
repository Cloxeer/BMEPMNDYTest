/**
 * @file js/store.js
 * @summary The app's shared memory, and the only place it gets changed.
 *
 * WHAT IT DOES : Remembers which building (and room) is selected, whether its
 *                sheet is open, which floor is showing, whether search is open,
 *                and where directions are leading.
 *                Other files change it only through the named actions below
 *                (selectBuilding, closeSheet, ...), so every rule about what
 *                changes together lives here. Anything that called
 *                store.subscribe(fn) is told after every change.
 * DEPENDS ON   : nothing.
 * CONTROLS     : the app state.
 * USED BY      : js/app.js, js/map.js, js/buildingSheet.js, js/pill.js, js/search.js,
 *                js/directions.js
 */

const state = {
  selectedId: null, // id of the chosen building, or null
  selectedVia: null, // how it was chosen: 'map' (tapped a badge) or 'search'
  sheetWaiting: false, // true = open the sheet once the map has flown to the building
  sheetOpen: false, // is the building sheet showing?
  activeFloor: null, // floor shown in the sheet
  selectedRoom: null, // the room chosen in search (a record from data/rooms.json), or null
  directionsTo: null, // { buildingId, room } while directions are on, otherwise null
  arrived: false, // true after directions brought you inside the selected building
  travelMode: 'walk', // how directions travel: 'walk', 'bike' or 'drive'
  showNames: true, // building names above the badges (Settings page and Map settings)
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
    this.selectRoom(building, null, via);
  },

  /**
   * Choose a room: like selectBuilding, but the sheet opens on the room's floor
   * with the room highlighted.
   * @param {object} building
   * @param {object|null} room - a record from data/rooms.json (null = just the building)
   * @param {'map'|'search'} via
   */
  selectRoom(building, room, via) {
    const floor = room && room.floor ? room.floor : building.floors[0] ?? null;
    if (building.id === state.selectedId) {
      // Already there: no flight, so open straight away.
      update({ selectedRoom: room, activeFloor: floor, sheetOpen: true, sheetWaiting: false, searching: false, arrived: false });
      return;
    }
    update({
      selectedId: building.id,
      selectedVia: via,
      selectedRoom: room,
      sheetOpen: false,
      sheetWaiting: true,
      activeFloor: floor,
      searching: false,
      arrived: false,
    });
  },

  /**
   * Choose a room by tapping it on the floor plan in the open sheet.
   * @param {object} room - a record from data/rooms.json, on the selected building
   */
  pickRoom(room) {
    update({ selectedRoom: room, activeFloor: room.floor });
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
    update({ selectedId: null, selectedVia: null, selectedRoom: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: false, arrived: false });
  },

  /** Open the selected building's sheet now (the Info pill). */
  openSheet() {
    update({ sheetOpen: true, sheetWaiting: false });
  },

  /** Close the sheet but keep the building selected. */
  closeSheet() {
    update({ sheetOpen: false, sheetWaiting: false, arrived: false });
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
    update({ selectedId: null, selectedVia: null, selectedRoom: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: true, arrived: false });
  },

  /** Start directions to the selected building (and room). The sheet closes so the map shows. */
  startDirections() {
    if (!state.selectedId) return;
    update({ directionsTo: { buildingId: state.selectedId, room: state.selectedRoom }, sheetOpen: false, sheetWaiting: false, arrived: false });
  },

  /**
   * Choose how to travel (walking, biking or driving). Directions re-route straight away.
   * @param {'walk'|'bike'|'drive'} mode
   */
  setTravelMode(mode) {
    if (mode !== state.travelMode) update({ travelMode: mode });
  },

  /**
   * Show or hide building names on the map.
   * @param {boolean} on
   */
  setShowNames(on) {
    if (on !== state.showNames) update({ showNames: on });
  },

  /** Stop directions. */
  endDirections() {
    if (state.directionsTo) update({ directionsTo: null });
  },

  /**
   * You walked into the building: directions end and its sheet opens on the room's floor.
   * @param {object} building - the building directions led to
   */
  arrived(building) {
    const room = state.directionsTo ? state.directionsTo.room : null;
    update({
      directionsTo: null,
      selectedId: building.id,
      selectedRoom: room,
      activeFloor: room && room.floor ? room.floor : building.floors[0] ?? null,
      sheetOpen: true,
      sheetWaiting: false,
      searching: false,
      arrived: true,
    });
  },

  /** Close search (does nothing if it's already closed). */
  endSearch() {
    if (state.searching) update({ searching: false });
  },
};
