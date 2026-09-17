/**
 * @file js/core/store.js
 * @summary The app's shared memory (its "state"), and the only place that changes it.
 *
 * WHAT IT DOES : Remembers which building (and room) is chosen, whether its
 *                sheet is open, which floor is showing, whether search is open,
 *                where directions are leading, and the user's choices.
 *                Other files never change the state directly: they call one of
 *                the named actions below (selectBuilding, closeSheet, ...), so
 *                every rule about what changes together lives in this one file.
 *                Any file can call store.subscribe(listener) to be told after
 *                every change (the "observer" pattern).
 * DEPENDS ON   : nothing.
 * CONTROLS     : the app state.
 * USED BY      : almost every file (import { store } from '../core/store.js').
 */

/** Holds the state and tells listeners whenever it changes. There is only one: `store`, below. */
class Store {
  /** Start with nothing chosen and the default choices. */
  constructor() {
    this.state = {
      selectedId: null, // id of the chosen building, or null
      selectedVia: null, // how it was chosen: 'map' (tapped a badge) or 'search'
      sheetWaiting: false, // true = open the sheet once the map has flown to the building
      sheetOpen: false, // is the building sheet showing?
      activeFloor: null, // the floor shown in the sheet
      selectedRoom: null, // the chosen room (a record from data/rooms.json), or null
      directionsTo: null, // { buildingId, room } while directions are on, otherwise null
      arrived: false, // true after directions brought you inside the chosen building
      travelMode: 'walk', // how directions travel: 'walk', 'bike' or 'drive'
      showNames: true, // building names above the badges (Settings page and Map settings)
      showCompass: false, // the small compass in the top left corner (Map settings)
      units: 'imperial', // distances in 'imperial' (ft, mi) or 'metric' (m, km)
      hiddenCategories: [], // Map filters: categories switched off ('study', 'living', 'park', ...)
      filterOptions: [], // the categories that have a row in the Map filters button (Settings > Map filters)
      searching: false, // is the search drop-down open?
    };
    this.listeners = []; // functions to call after every change
  }

  /** @returns {object} the current state (read it; change it only with the actions below) */
  get() {
    return this.state;
  }

  /**
   * Call `listener` now, and again after every change.
   * @param {(state: object) => void} listener
   */
  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.state);
  }

  /**
   * Change some of the state, then tell every listener.
   * @param {object} changes - the fields to change, e.g. { sheetOpen: true }
   */
  update(changes) {
    for (const key of Object.keys(changes)) {
      this.state[key] = changes[key];
    }
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * The floor to show first for a building: the room's floor, or else the lowest floor.
   * @param {object} building
   * @param {object|null} room
   * @returns {number|null} null when the building's floors aren't known
   */
  firstFloor(building, room) {
    if (room && room.floor) {
      return room.floor;
    }
    if (building.floors.length > 0) {
      return building.floors[0];
    }
    return null;
  }

  /**
   * Choose a building. The map flies to it first; when it gets there it calls
   * sheetCanOpen(), which opens the sheet on the first floor.
   * Choosing the building that's already chosen just opens its sheet.
   * @param {object} building - a record from data/buildings.geojson
   * @param {'map'|'search'} via - where it was chosen (sets the pause before the sheet opens)
   */
  selectBuilding(building, via) {
    this.selectRoom(building, null, via);
  }

  /**
   * Choose a room: like selectBuilding, but the sheet opens on the room's floor
   * with the room highlighted.
   * @param {object} building
   * @param {object|null} room - a record from data/rooms.json (null = just the building)
   * @param {'map'|'search'} via
   */
  selectRoom(building, room, via) {
    const floor = this.firstFloor(building, room);
    if (building.id === this.state.selectedId) {
      // Already there: no flight, so open straight away.
      this.update({ selectedRoom: room, activeFloor: floor, sheetOpen: true, sheetWaiting: false, searching: false, arrived: false });
      return;
    }
    this.update({
      selectedId: building.id,
      selectedVia: via,
      selectedRoom: room,
      sheetOpen: false,
      sheetWaiting: true,
      activeFloor: floor,
      searching: false,
      arrived: false,
    });
  }

  /**
   * Choose a room by tapping it on the floor plan in the open sheet.
   * @param {object} room - a record from data/rooms.json, in the chosen building
   */
  pickRoom(room) {
    this.update({ selectedRoom: room, activeFloor: room.floor });
  }

  /**
   * The map has finished flying to a building: open its sheet, unless the
   * user has picked something else since, or already opened or closed the sheet.
   * @param {string} buildingId - the building the map flew to
   */
  sheetCanOpen(buildingId) {
    if (this.state.sheetWaiting && this.state.selectedId === buildingId) {
      this.update({ sheetOpen: true, sheetWaiting: false });
    }
  }

  /** Let go of the chosen building and close its sheet. */
  clearSelection() {
    this.update({ selectedId: null, selectedVia: null, selectedRoom: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: false, arrived: false });
  }

  /** Open the chosen building's sheet now (the Info pill). */
  openSheet() {
    this.update({ sheetOpen: true, sheetWaiting: false });
  }

  /** Close the sheet but keep the building chosen. */
  closeSheet() {
    this.update({ sheetOpen: false, sheetWaiting: false, arrived: false });
  }

  /**
   * Show a different floor.
   * @param {number} floor
   */
  showFloor(floor) {
    this.update({ activeFloor: floor });
  }

  /** Open search. Any chosen building is let go. */
  startSearch() {
    this.update({ selectedId: null, selectedVia: null, selectedRoom: null, sheetOpen: false, sheetWaiting: false, activeFloor: null, searching: true, arrived: false });
  }

  /** Close search (does nothing if it's already closed). */
  endSearch() {
    if (this.state.searching) {
      this.update({ searching: false });
    }
  }

  /** Start directions to the chosen building (and room). The sheet closes so the map shows. */
  startDirections() {
    if (!this.state.selectedId) {
      return;
    }
    const trip = { buildingId: this.state.selectedId, room: this.state.selectedRoom };
    this.update({ directionsTo: trip, sheetOpen: false, sheetWaiting: false, arrived: false });
  }

  /** Stop directions. */
  endDirections() {
    if (this.state.directionsTo) {
      this.update({ directionsTo: null });
    }
  }

  /**
   * You walked into the building: directions end and its sheet opens on the room's floor.
   * @param {object} building - the building directions led to
   */
  arrived(building) {
    let room = null;
    if (this.state.directionsTo) {
      room = this.state.directionsTo.room;
    }
    this.update({
      directionsTo: null,
      selectedId: building.id,
      selectedRoom: room,
      activeFloor: this.firstFloor(building, room),
      sheetOpen: true,
      sheetWaiting: false,
      searching: false,
      arrived: true,
    });
  }

  /**
   * Choose how to travel. Directions re-route straight away.
   * @param {'walk'|'bike'|'drive'} mode
   */
  setTravelMode(mode) {
    if (mode !== this.state.travelMode) {
      this.update({ travelMode: mode });
    }
  }

  /**
   * Show or hide building names on the map.
   * @param {boolean} on
   */
  setShowNames(on) {
    if (on !== this.state.showNames) {
      this.update({ showNames: on });
    }
  }

  /**
   * Show or hide the compass in the top left corner of the map.
   * @param {boolean} on
   */
  setShowCompass(on) {
    if (on !== this.state.showCompass) {
      this.update({ showCompass: on });
    }
  }

  /**
   * Show distances in feet and miles, or metres and kilometres.
   * @param {'imperial'|'metric'} units
   */
  setUnits(units) {
    if (units !== this.state.units) {
      this.update({ units: units });
    }
  }

  /**
   * Switch one category of places on or off the map (Map filters).
   * @param {string} category - 'study', 'living' or 'park'
   */
  toggleCategory(category) {
    const hidden = [];
    for (const name of this.state.hiddenCategories) {
      if (name !== category) {
        hidden.push(name);
      }
    }
    const wasHidden = hidden.length < this.state.hiddenCategories.length;
    if (!wasHidden) {
      hidden.push(category);
    }
    this.update({ hiddenCategories: hidden });
  }

  /**
   * Set which categories are hidden (used to bring back a saved choice).
   * @param {string[]} categories
   */
  setHiddenCategories(categories) {
    this.update({ hiddenCategories: categories });
  }

  /**
   * Set which categories have a row in the Map filters button (used to bring back a saved choice).
   * @param {string[]} categories
   */
  setFilterOptions(categories) {
    this.update({ filterOptions: categories });
  }

  /**
   * Add a category to the Map filters button, or take it out (Settings > Map filters).
   * Adding one also shows it on the map, and taking one out hides it, so the switch and the map agree.
   * @param {string} category
   * @param {boolean} inButton
   */
  setFilterOption(category, inButton, maxOptions) {
    if (inButton && this.state.filterOptions.length >= maxOptions) {
      return; // the button is full: switch one off first
    }
    const options = [];
    for (const name of this.state.filterOptions) {
      if (name !== category) {
        options.push(name);
      }
    }
    const hidden = [];
    for (const name of this.state.hiddenCategories) {
      if (name !== category) {
        hidden.push(name); // whichever way it goes, it isn't hidden by an old choice
      }
    }
    if (inButton) {
      options.push(category);
    } else {
      hidden.push(category); // off the button means off the map
    }
    this.update({ filterOptions: options, hiddenCategories: hidden });
  }
}

/** The one store the whole app shares. */
export const store = new Store();
