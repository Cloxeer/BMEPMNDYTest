/**
 * @file js/map/campusMap.js
 * @summary The map: NMSU's class places highlighted, and a tappable badge on every place.
 *
 * WHAT IT DOES : 1. Creates the MapLibre map on the colour OpenFreeMap basemap.
 *                2. Draws the campus shapes (./campusLayers.js) and the badges
 *                   and names (./badges.js) once the map has loaded.
 *                3. Keeps dragging inside the Las Cruces places (the "fence").
 *                4. Tapping a badge chooses its place; tapping anywhere else lets go.
 *                5. Flies to a place whenever a different one is chosen, then
 *                   lets its sheet open.
 *                Other files use its methods: showHome, showPlace,
 *                setBuildingNames, setShownCategories, and `ready`.
 * DEPENDS ON   : maplibre-gl (the global `maplibregl`), ../core/config.js,
 *                ../core/store.js, ../logic/shapes.js, ./campusLayers.js, ./badges.js
 * CONTROLS     : the #map element.
 * USED BY      : js/main.js (makes it and hands it to the files that need it)
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { allPointsOf, boxAround } from '../logic/shapes.js';
import { addCampusLayers, hideBasemapBusinesses } from './campusLayers.js';
import { addBadges, categoryFilter, badgePictureRule, nameColorRule } from './badges.js';

/**
 * Starts fast and settles softly ("ease-out"), used for flying to places.
 * @param {number} progress - 0 at the start of the move, 1 at the end
 * @returns {number}
 */
function easeOut(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * MapLibre shows its credits opened up at first; start them folded into the (i) button.
 * (MapLibre has no setting for this, so we close its <details> element.)
 */
function foldCredits() {
  const credits = document.querySelector('.maplibregl-ctrl-attrib');
  if (!credits) {
    return;
  }
  credits.removeAttribute('open');
  credits.classList.remove('maplibregl-compact-show');
}

export class CampusMap {
  /**
   * Create the map.
   * @param {Object.<string, object>} buildingsById - every building and park, by id (each has .center)
   * @param {object} campuses - data/campuses.geojson
   * @param {object} labels - data/campus-labels.geojson
   * @param {object} outside - data/outside-mask.geojson
   */
  constructor(buildingsById, campuses, labels, outside) {
    const settings = CONFIG.map;
    this.buildingsById = buildingsById;
    this.namesVisible = true; // the Building names setting
    this.shownCategories = Object.keys(CONFIG.categories); // Map filters: which categories are on the map

    // `ready` finishes once the map has loaded and the badges are drawn (directions wait for it).
    this.ready = new Promise((resolve) => {
      this.markReady = resolve;
    });

    // The fence: a box around every NMSU place in Las Cruces. Dragging stays inside it.
    const nearbyPoints = [];
    for (const place of campuses.features) {
      if (place.properties.km <= settings.nearbyKm) {
        for (const point of allPointsOf(place.geometry)) {
          nearbyPoints.push(point);
        }
      }
    }
    this.fence = boxAround(nearbyPoints, settings.fencePadding);

    this.map = new maplibregl.Map({
      container: 'map',
      style: settings.styleUrl,
      center: settings.center,
      zoom: settings.zoom,
      minZoom: settings.minZoom,
      maxZoom: settings.maxZoom,
      maxBounds: this.fence,
      // Very sharp phone screens draw at most 2x: it looks the same, and cheaper phones stay smooth.
      pixelRatio: Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio),
      dragRotate: true,
      attributionControl: { compact: true },
    });
    this.map.touchZoomRotate.enable();
    this.map.touchPitch.enable();

    this.map.on('load', () => this.drawEverything(campuses, labels, outside));
    this.followSelection();
  }

  /**
   * The map has loaded: draw our layers and start listening for taps.
   * @param {object} campuses
   * @param {object} labels
   * @param {object} outside
   */
  drawEverything(campuses, labels, outside) {
    foldCredits();
    hideBasemapBusinesses(this.map);
    addCampusLayers(this.map, campuses, labels, outside);
    addBadges(this.map, this.buildingsById, this.shownCategories, this.namesVisible);
    this.markSelected(store.get().selectedId);
    this.listenForTaps();
    this.markReady();
  }

  /**
   * Are the badge layers drawn yet? (Not until the map has loaded.)
   * @returns {boolean}
   */
  hasBadges() {
    return Boolean(this.map.getLayer('building-pins'));
  }

  /**
   * Show only some categories of places (the Map filters button).
   * @param {string[]} categories - e.g. ['study', 'park']
   */
  setShownCategories(categories) {
    this.shownCategories = categories;
    if (!this.hasBadges()) {
      return; // still loading: the badges are drawn with this choice
    }
    this.map.setFilter('building-pins', categoryFilter(categories));
    this.map.setFilter('building-names', categoryFilter(categories));
  }

  /**
   * Show or hide the names above the badges (the Building names setting).
   * @param {boolean} visible
   */
  setBuildingNames(visible) {
    this.namesVisible = visible;
    if (!this.hasBadges()) {
      return; // still loading: the names are drawn with this choice
    }
    if (visible) {
      this.map.setLayoutProperty('building-names', 'visibility', 'visible');
    } else {
      this.map.setLayoutProperty('building-names', 'visibility', 'none');
    }
  }

  /**
   * Give the chosen place the blue-ringed badge and a blue name; every other place keeps the white ring.
   * @param {string|null} buildingId
   */
  markSelected(buildingId) {
    if (!this.hasBadges()) {
      return; // still loading: drawEverything calls this again
    }
    this.map.setLayoutProperty('building-pins', 'icon-image', badgePictureRule(buildingId));
    this.map.setPaintProperty('building-names', 'text-color', nameColorRule(buildingId));
  }

  /** Tapping a badge (or its name) chooses its place; tapping anywhere else lets go. */
  listenForTaps() {
    this.map.on('click', (event) => {
      const hits = this.map.queryRenderedFeatures(event.point, { layers: ['building-pins', 'building-names'] });
      if (hits.length > 0) {
        store.selectBuilding(this.buildingsById[hits[0].properties.id], 'map');
      } else {
        store.clearSelection();
      }
    });

    // A pointing hand over badges and names (computers with a mouse).
    for (const layer of ['building-pins', 'building-names']) {
      this.map.on('mouseenter', layer, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layer, () => {
        this.map.getCanvas().style.cursor = '';
      });
    }
  }

  /**
   * Fly to a place whenever a different one is chosen. When the flight ends,
   * pause a moment (so you see where it is), then let its sheet open.
   */
  followSelection() {
    // flyTo passes { flightTo, via } on to its 'moveend' event, so we know which flight ended.
    // A flight cut short by dragging has no flightTo, so the sheet waits for the Info pill instead.
    this.map.on('moveend', (event) => {
      if (!event.flightTo) {
        return;
      }
      let pause = CONFIG.map.sheetPauseAfterTap;
      if (event.via === 'search') {
        pause = CONFIG.map.sheetPauseAfterSearch;
      }
      setTimeout(() => store.sheetCanOpen(event.flightTo), pause);
    });

    let lastSelectedId = null;
    store.subscribe((state) => {
      if (state.selectedId === lastSelectedId) {
        return;
      }
      lastSelectedId = state.selectedId;
      this.markSelected(state.selectedId);
      const building = this.buildingsById[state.selectedId];
      if (!building) {
        return; // nothing chosen
      }
      this.map.setMaxBounds(this.fence);
      // A short flight that starts quick and settles softly.
      this.map.flyTo({
        center: building.center,
        zoom: Math.max(this.map.getZoom(), CONFIG.map.selectZoom),
        duration: CONFIG.map.flyDuration,
        curve: CONFIG.map.flyCurve,
        easing: easeOut,
        essential: true,
      }, { flightTo: building.id, via: state.selectedVia });
    });
  }

  /**
   * Fly "home" to Corbett Center Student Union, facing north (Map settings > Home).
   * @param {number[]} center - Corbett Center's [lng, lat]
   */
  showHome(center) {
    this.map.setMaxBounds(this.fence);
    this.map.easeTo({
      center: center,
      zoom: CONFIG.map.homeZoom,
      bearing: 0,
      pitch: 0,
      duration: CONFIG.map.flyDuration,
      easing: easeOut,
    });
  }

  /**
   * Move the map to one NMSU place (the Locations page). Far places lift the fence; nearby ones put it back.
   * @param {object} place - one feature from data/campuses.geojson
   */
  showPlace(place) {
    if (place.properties.km <= CONFIG.map.nearbyKm) {
      this.map.setMaxBounds(this.fence);
    } else {
      this.map.setMaxBounds(null);
    }
    this.map.fitBounds(boxAround(allPointsOf(place.geometry), 0), {
      padding: CONFIG.map.fitPadding,
      maxZoom: CONFIG.map.fitMaxZoom,
      duration: CONFIG.map.fitDuration,
    });
  }
}
