/**
 * @file js/sheet/floorPlan.js
 * @summary The floor plan part of the building sheet.
 *
 * WHAT IT DOES : Two slides side by side: "Our plan" (our redrawn SVG) and
 *                "Posted map" (a photo of the evacuation map in the building).
 *                Swipe between them, or tap the switch above. The slides are
 *                Framework7's Swiper; the switch's highlight moves with your finger.
 *                On our plan:
 *                  - tap a room to choose it (and you're asked about directions to it),
 *                  - tap an entrance marker to see a photo of that entrance (or a
 *                    note from us saying we haven't taken one yet),
 *                  - the chosen room is light blue, with arrows from where you come in
 *                    (./planPicture.js).
 *                The corner button opens the picture full screen.
 * DEPENDS ON   : Framework7's Swiper (<swiper-container>) and message box, ../core/config.js,
 *                ../core/store.js, ../logic/shapes.js, ./planPicture.js,
 *                #bs-slides and the switch in index.html,
 *                data/rooms.json (room outlines), data/entrances.json (doors).
 * CONTROLS     : the floor plan slides, the switch and #bs-caption.
 * USED BY      : js/sheet/buildingSheet.js
 */

import { CONFIG } from '../core/config.js';
import { store } from '../core/store.js';
import { isInsidePolygon, polygonArea } from '../logic/shapes.js';
import { makePlanPicture } from './planPicture.js';

const VIEW_ORDER = ['plan', 'posted']; // the slides, left to right

export class FloorPlan {
  /**
   * @param {Framework7} app - for the "no photo yet" message
   * @param {PhotoViewer} photoViewer - full-screen pictures
   * @param {() => void} askDirections - asks "Get directions to this room?"
   */
  constructor(app, photoViewer, askDirections) {
    this.app = app;
    this.rooms = []; // until setRooms(), a moment after the map
    this.entrances = [];
    this.photoViewer = photoViewer;
    this.askDirections = askDirections;
    this.words = CONFIG.sheet;
    this.slides = document.querySelector('#bs-slides'); // <swiper-container>
    this.highlight = document.querySelector('.bs-switch .segmented-highlight');
    this.caption = document.querySelector('#bs-caption');
    this.views = {
      plan: {
        tab: document.querySelector('#bs-tab-plan'),
        slide: document.querySelector('#bs-slide-plan'),
        image: document.querySelector('#bs-plan-img'),
        missing: document.querySelector('#bs-plan-missing'),
        missingText: this.words.planMissingText,
      },
      posted: {
        tab: document.querySelector('#bs-tab-posted'),
        slide: document.querySelector('#bs-slide-posted'),
        image: document.querySelector('#bs-posted-img'),
        missing: document.querySelector('#bs-posted-missing'),
        missingText: this.words.noOfficialPlanText,
      },
    };
    this.showingBuilding = null; // the building on the slides now
    this.showingFloor = null; // the floor on the slides now
    this.requestCount = 0; // counts picture loads, so a slow old one can't replace a newer one

    this.listenToSwitchAndSwipe();
    this.listenToPlanTaps();
  }

  /**
   * The rooms and doors, once they've loaded.
   * @param {object[]} rooms - data/rooms.json
   * @param {object[]} entrances - data/entrances.json
   */
  setRooms(rooms, entrances) {
    this.rooms = rooms;
    this.entrances = entrances;
  }

  /* ---------- The switch and swiping ---------- */

  /** Tapping the switch slides to that view; swiping moves the switch's highlight with your finger. */
  listenToSwitchAndSwipe() {
    for (const name of VIEW_ORDER) {
      this.views[name].tab.addEventListener('click', () => this.goTo(name, true));
    }

    // The highlight follows your finger: Swiper's progress goes from 0 (plan) to 1 (posted).
    // Framework7 places the highlight using --f7-segmented-highlight-active.
    this.slides.addEventListener('swiperprogress', (event) => {
      const progress = event.detail[1];
      this.highlight.style.setProperty('--f7-segmented-highlight-active', Math.min(1, Math.max(0, progress)));
    });
    this.slides.addEventListener('swiperslidechange', () => this.markTab(this.slides.swiper.activeIndex));
  }

  /** @param {number} index - 0 = Our plan, 1 = Posted map: bold text, and what screen readers say */
  markTab(index) {
    for (let i = 0; i < VIEW_ORDER.length; i += 1) {
      const tab = this.views[VIEW_ORDER[i]].tab;
      tab.classList.toggle('button-active', i === index);
      tab.setAttribute('aria-selected', String(i === index));
    }
  }

  /**
   * Slide to a view.
   * @param {'plan'|'posted'} name
   * @param {boolean} animate - false jumps straight there
   */
  goTo(name, animate) {
    const index = VIEW_ORDER.indexOf(name);
    if (this.slides.swiper) {
      if (animate) {
        this.slides.swiper.slideTo(index);
      } else {
        this.slides.swiper.slideTo(index, 0);
      }
    }
    this.markTab(index);
  }

  /** Every new building starts on "Our plan". */
  reset() {
    this.goTo('plan', false);
  }

  /* ---------- Pictures ---------- */

  /** Resize the slides to the shown slide (pictures and messages have different heights). */
  fitHeight() {
    if (this.slides.swiper) {
      this.slides.swiper.updateAutoHeight(0);
    }
  }

  /**
   * Put a picture (or a "not available" message) on one slide.
   * @param {object} view - this.views.plan or this.views.posted
   * @param {string|undefined} url
   * @param {string} alt - words describing the picture
   */
  fillSlide(view, url, alt) {
    view.image.onerror = null;
    if (!url) {
      view.image.removeAttribute('src');
      view.image.hidden = true;
      view.missing.textContent = view.missingText;
      view.missing.hidden = false;
      this.fitHeight();
      return;
    }
    view.image.onerror = () => this.fillSlide(view, undefined, alt); // listed, but the file is missing
    view.image.onload = () => this.fitHeight(); // the slide takes the picture's height once it has loaded
    view.image.src = url;
    view.image.alt = alt;
    view.image.hidden = false;
    view.missing.hidden = true;
  }

  /**
   * The caption under the slides, e.g. "Room 225 · Floor 2 · from the nearest stairs".
   * @param {object} building
   * @param {number} floor
   * @param {object|null} room
   * @param {boolean} hasRooms - can rooms be tapped on this plan?
   * @returns {string}
   */
  captionFor(building, floor, room, hasRooms) {
    // Some buildings have no published floor count (e.g. Devasthali Hall): don't show "Floor null".
    let floorName = this.words.floorsUnknownText;
    if (floor) {
      floorName = CONFIG.pill.floorText + ' ' + floor;
    }
    let roomName = '';
    if (room) {
      roomName = CONFIG.search.roomText + ' ' + room.number;
    }
    const roomIsHere = room && room.building === building.id;

    if (roomIsHere && !room.floor) {
      return roomName + ' (' + this.words.roomFloorUnknownText + ') · ' + floorName;
    }
    if (roomIsHere && room.floor === floor) {
      if (!room.indoorRoute) {
        return roomName + ' · ' + floorName;
      }
      let from = this.words.indoorFromStairsText;
      if (room.indoorFrom === 'door') {
        from = this.words.indoorFromDoorText;
      }
      return roomName + ' · ' + floorName + ' · ' + from;
    }
    if (hasRooms) {
      return floorName + ' · ' + this.words.tapPlanText;
    }
    return floorName;
  }

  /**
   * The rooms on one plan file.
   * @param {string|undefined} planFile
   * @returns {object[]}
   */
  roomsOnPlan(planFile) {
    const found = [];
    for (const room of this.rooms) {
      if (room.plan && room.plan === planFile) {
        found.push(room);
      }
    }
    return found;
  }

  /**
   * The entrances on one plan file.
   * @param {string|undefined} planFile
   * @returns {object[]}
   */
  entrancesOnPlan(planFile) {
    const found = [];
    for (const entrance of this.entrances) {
      if (entrance.plan === planFile) {
        found.push(entrance);
      }
    }
    return found;
  }

  /**
   * Show one floor of a building, with the chosen room drawn on our plan.
   * @param {object} building
   * @param {number} floor
   * @param {object|null} room
   */
  async show(building, floor, room) {
    this.requestCount += 1;
    const thisRequest = this.requestCount;
    this.showingBuilding = building;
    this.showingFloor = floor;
    const planFile = building.floorImages[String(floor)];
    const roomsHere = this.roomsOnPlan(planFile);
    const doorsHere = this.entrancesOnPlan(planFile);
    let floorName = building.name;
    if (floor) {
      floorName = building.name + ', ' + CONFIG.pill.floorText + ' ' + floor;
    }

    this.views.plan.slide.toggleAttribute('data-rooms', roomsHere.length > 0);
    this.caption.textContent = this.captionFor(building, floor, room, roomsHere.length > 0);
    this.fillSlide(this.views.posted, building.postedImages[String(floor)], floorName + ' ' + this.words.postedAltText);

    let picture = planFile;
    let roomOnPlan = null;
    if (room && room.plan === planFile) {
      roomOnPlan = room;
    }
    if (planFile && (roomOnPlan || doorsHere.length > 0)) {
      try {
        picture = await makePlanPicture(planFile, roomOnPlan, doorsHere);
      } catch (error) {
        console.error(error); // show the plain plan instead
      }
      if (thisRequest !== this.requestCount) {
        return; // something newer is already showing
      }
    }
    this.fillSlide(this.views.plan, picture, floorName + ' ' + this.words.planAltText);
    this.fitHeight();
  }

  /* ---------- Taps on the pictures ---------- */

  /** Taps on our plan choose rooms and entrances; the corner buttons open the picture full screen. */
  listenToPlanTaps() {
    this.views.plan.image.addEventListener('click', (event) => this.onPlanTap(event));

    for (const button of document.querySelectorAll('#bs-slides .bs-zoom')) {
      button.addEventListener('click', () => {
        const image = this.views[button.dataset.view].image;
        if (!image.hidden) {
          this.photoViewer.open([image.src], 0);
        }
      });
    }
  }

  /**
   * Show a photo of an entrance, or tell the user we haven't taken one yet.
   * @param {object} entrance - a record from data/entrances.json
   */
  openEntrance(entrance) {
    if (entrance.photo) {
      this.photoViewer.open([entrance.photo], 0);
      return;
    }
    this.app.dialog.alert(this.words.noEntrancePhotoText, this.words.entranceTitle + ' · ' + entrance.label);
  }

  /**
   * Our plan was tapped: open an entrance, or choose the room under the tap.
   * @param {MouseEvent} event
   */
  onPlanTap(event) {
    const building = this.showingBuilding;
    if (!building) {
      return;
    }
    const planFile = building.floorImages[String(this.showingFloor)];
    const roomsHere = this.roomsOnPlan(planFile);
    const doorsHere = this.entrancesOnPlan(planFile);
    const anyHere = roomsHere[0] || doorsHere[0];
    if (!anyHere) {
      return;
    }

    // Where the tap landed, in the plan's own units. Its viewBox is "left top width height".
    const viewBox = anyHere.viewBox.split(/\s+/).map(Number);
    const box = this.views.plan.image.getBoundingClientRect();
    const x = viewBox[0] + ((event.clientX - box.left) / box.width) * viewBox[2];
    const y = viewBox[1] + ((event.clientY - box.top) / box.height) * viewBox[3];

    // Entrances first: their markers sit on the building's edge, right next to rooms.
    for (const door of doorsHere) {
      if (Math.hypot(door.point[0] - x, door.point[1] - y) <= this.words.entranceTapRadius) {
        this.openEntrance(door);
        return;
      }
    }

    // The smallest room under the tap (a small room can sit inside a bigger suite).
    let smallest = null;
    for (const room of roomsHere) {
      if (!isInsidePolygon(room.points, x, y)) {
        continue;
      }
      if (smallest === null || polygonArea(room.points) < polygonArea(smallest.points)) {
        smallest = room;
      }
    }
    if (smallest === null) {
      return;
    }
    store.pickRoom(smallest);
    this.askDirections(); // "Get directions to Room 125?"
  }
}
