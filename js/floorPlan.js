/**
 * @file js/floorPlan.js
 * @summary The floor plan part of the building sheet.
 *
 * WHAT IT DOES : Two slides side by side: "Our plan" (our redrawn SVG) and
 *                "Posted map" (photo of the evacuation map in the building).
 *                Swipe between them (mid-swipe you see both) or tap the switch
 *                above. The slides are Framework7's Swiper; the switch's
 *                highlight slides along with your finger.
 *                On our plan:
 *                  - tap a room to choose it (and you're asked if you want directions to it),
 *                  - tap an entrance marker to see a photo of that entrance (or, if we
 *                    haven't taken one, a note from us saying so),
 *                  - the chosen room is light blue, with arrows from where you
 *                    come in (js/planArt.js).
 *                The corner button opens the picture full screen.
 * DEPENDS ON   : Framework7's Swiper (<swiper-container>), ./config.js, ./store.js,
 *                ./planArt.js, #bs-slides and the switch in index.html,
 *                data/rooms.json (room outlines), data/entrances.json (doors),
 *                Framework7 (message when an entrance has no photo).
 * CONTROLS     : the floor plan slides, the switch and #bs-caption.
 * USED BY      : js/buildingSheet.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { planWithRoom } from './planArt.js';

/**
 * Is (x, y) inside the polygon? (ray casting)
 * @param {number[][]} points
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function inside(points, x, y) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) result = !result;
  }
  return result;
}

/**
 * Wire the floor plan slides.
 * @param {Framework7} app - for the "no photo yet" message
 * @param {object[]} rooms - data/rooms.json
 * @param {object[]} entrances - data/entrances.json
 * @param {(urls: string[], startAt: number) => void} openViewer - full-screen picture viewer
 * @param {() => void} askDirections - asks "Get directions to this room?" (js/askDirections.js)
 * @returns {{ show: (building: object, floor: number, room: object|null) => void, reset: () => void }}
 */
export function initFloorPlan(app, rooms, entrances, openViewer, askDirections) {
  const words = CONFIG.sheet;
  const slides = document.querySelector('#bs-slides'); // <swiper-container>
  const highlight = document.querySelector('.bs-switch .segmented-highlight');
  const caption = document.querySelector('#bs-caption');
  const views = {
    plan: {
      tab: document.querySelector('#bs-tab-plan'),
      slide: document.querySelector('#bs-slide-plan'),
      image: document.querySelector('#bs-plan-img'),
      missing: document.querySelector('#bs-plan-missing'),
      missingText: words.planMissingText,
    },
    posted: {
      tab: document.querySelector('#bs-tab-posted'),
      slide: document.querySelector('#bs-slide-posted'),
      image: document.querySelector('#bs-posted-img'),
      missing: document.querySelector('#bs-posted-missing'),
      missingText: words.noOfficialPlanText,
    },
  };
  const order = ['plan', 'posted']; // left to right

  let showing = { building: null, floor: null }; // what's on the slides now
  let request = 0; // counts picture loads, so a slow old one can't replace a newer one

  /* ---------- Switch and swipe ---------- */

  /** @param {number} index - 0 = Our plan, 1 = Posted map: bold text + screen readers */
  function markTab(index) {
    order.forEach((view, i) => {
      views[view].tab.classList.toggle('button-active', i === index);
      views[view].tab.setAttribute('aria-selected', String(i === index));
    });
  }

  /**
   * Slide to a view.
   * @param {'plan'|'posted'} name
   * @param {boolean} animate - false jumps straight there
   */
  function goTo(name, animate) {
    const index = order.indexOf(name);
    if (slides.swiper) slides.swiper.slideTo(index, animate ? undefined : 0);
    markTab(index);
  }

  order.forEach((name) => views[name].tab.addEventListener('click', () => goTo(name, true)));

  // The highlight follows the swipe: Swiper's progress goes 0 (plan) to 1 (posted).
  // Framework7 positions the highlight from --f7-segmented-highlight-active.
  slides.addEventListener('swiperprogress', (event) => {
    const [, progress] = event.detail;
    highlight.style.setProperty('--f7-segmented-highlight-active', Math.min(1, Math.max(0, progress)));
  });
  slides.addEventListener('swiperslidechange', () => markTab(slides.swiper.activeIndex));

  /* ---------- Pictures ---------- */

  /** Resize the slides to the shown slide's content (pictures and messages differ in height). */
  function fitHeight() {
    if (slides.swiper) slides.swiper.updateAutoHeight(0);
  }

  /**
   * Put a picture (or a "not available" message) on one slide.
   * @param {object} view - views.plan or views.posted
   * @param {string|undefined} url
   * @param {string} alt
   */
  function fillSlide(view, url, alt) {
    view.image.onerror = null;
    if (!url) {
      view.image.removeAttribute('src');
      view.image.hidden = true;
      view.missing.textContent = view.missingText;
      view.missing.hidden = false;
      fitHeight();
      return;
    }
    view.image.onerror = () => fillSlide(view, undefined, alt); // listed, but the file is missing
    view.image.onload = fitHeight; // the slide takes the picture's height once it has loaded
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
  function captionFor(building, floor, room, hasRooms) {
    // Some buildings have no published floor count (e.g. Devasthali Hall): don't show "Floor null".
    const floorName = floor ? CONFIG.pill.floorText + ' ' + floor : words.floorsUnknownText;
    const roomName = room ? CONFIG.search.roomText + ' ' + room.number : '';
    if (room && room.building === building.id && !room.floor) {
      return roomName + ' (' + words.roomFloorUnknownText + ') · ' + floorName;
    }
    if (room && room.building === building.id && room.floor === floor) {
      const from = room.indoorFrom === 'door' ? words.indoorFromDoorText : words.indoorFromStairsText;
      return roomName + ' · ' + floorName + (room.indoorRoute ? ' · ' + from : '');
    }
    return hasRooms ? floorName + ' · ' + words.tapPlanText : floorName;
  }

  /**
   * Show one floor of a building, with the chosen room drawn on our plan.
   * @param {object} building
   * @param {number} floor
   * @param {object|null} room
   */
  async function show(building, floor, room) {
    const thisRequest = ++request;
    showing = { building, floor };
    const planFile = building.floorImages[String(floor)];
    const roomsHere = rooms.filter((r) => r.plan && r.plan === planFile);
    const doorsHere = entrances.filter((e) => e.plan === planFile);
    const floorName = building.name + (floor ? ', ' + CONFIG.pill.floorText + ' ' + floor : '');

    views.plan.slide.toggleAttribute('data-rooms', roomsHere.length > 0);
    caption.textContent = captionFor(building, floor, room, roomsHere.length > 0);
    fillSlide(views.posted, building.postedImages[String(floor)], floorName + ' ' + words.postedAltText);

    let picture = planFile;
    const roomOnPlan = room && room.plan === planFile ? room : null;
    if (planFile && (roomOnPlan || doorsHere.length)) {
      try {
        picture = await planWithRoom(planFile, roomOnPlan, doorsHere);
      } catch (error) {
        console.error(error); // show the plain plan instead
      }
      if (thisRequest !== request) return; // something newer is already showing
    }
    fillSlide(views.plan, picture, floorName + ' ' + words.planAltText);
    fitHeight();
  }

  /* ---------- Taps on the pictures ---------- */

  /**
   * Show a photo of an entrance, or tell the user we haven't taken one yet.
   * @param {object} entrance - a record from data/entrances.json
   */
  function openEntrance(entrance) {
    if (entrance.photo) {
      openViewer([entrance.photo], 0);
      return;
    }
    app.dialog.alert(words.noEntrancePhotoText, words.entranceTitle + ' · ' + entrance.label);
  }

  // Tap an entrance to see it, or a room on our plan to choose it.
  views.plan.image.addEventListener('click', (event) => {
    const { building, floor } = showing;
    if (!building) return;
    const planFile = building.floorImages[String(floor)];
    const roomsHere = rooms.filter((r) => r.plan && r.plan === planFile);
    const doorsHere = entrances.filter((e) => e.plan === planFile);
    const anyHere = roomsHere[0] || doorsHere[0];
    if (!anyHere) return;

    // Where the tap landed, in the plan's own units (its viewBox: "left top width height").
    const [left, top, width, height] = anyHere.viewBox.split(/\s+/).map(Number);
    const box = views.plan.image.getBoundingClientRect();
    const x = left + ((event.clientX - box.left) / box.width) * width;
    const y = top + ((event.clientY - box.top) / box.height) * height;

    // Entrances first: their markers sit on the building's edge, next to rooms.
    const door = doorsHere.find((e) => Math.hypot(e.point[0] - x, e.point[1] - y) <= words.entranceTapRadius);
    if (door) {
      openEntrance(door);
      return;
    }

    // Smallest room under the tap (a small room can sit inside a bigger suite).
    const hits = roomsHere.filter((r) => inside(r.points, x, y));
    if (!hits.length) return;
    const area = (r) => Math.abs(r.points.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = r.points[(i + 1) % r.points.length];
      return sum + x1 * y2 - x2 * y1;
    }, 0));
    store.pickRoom(hits.reduce((a, b) => (area(a) <= area(b) ? a : b)));
    askDirections(); // "Get directions to Room 125?"
  });

  document.querySelectorAll('#bs-slides .bs-zoom').forEach((button) => {
    button.addEventListener('click', () => {
      const image = views[button.dataset.view].image;
      if (!image.hidden) openViewer([image.src], 0);
    });
  });

  return {
    show,
    /** Every new building starts on "Our plan". */
    reset() {
      goTo('plan', false);
    },
  };
}
