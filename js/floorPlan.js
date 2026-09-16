/**
 * @file js/floorPlan.js
 * @summary The floor plan part of the building sheet.
 *
 * WHAT IT DOES : Two slides side by side: "Our plan" (our redrawn SVG) and
 *                "Posted map" (photo of the evacuation map in the building).
 *                Swipe between them (mid-swipe you see both) or use the switch
 *                above; the switch follows the swipe.
 *                On our plan:
 *                  - tap a room to choose it,
 *                  - the chosen room is light blue, with arrows from where you
 *                    come in (js/planArt.js).
 *                The corner button opens the picture full screen.
 * DEPENDS ON   : ./config.js, ./store.js, ./planArt.js, #bs-slides and the
 *                switch in index.html, data/rooms.json (room outlines).
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
 * @param {object[]} rooms - data/rooms.json
 * @param {(urls: string[], startAt: number) => void} openViewer - full-screen picture viewer
 * @returns {{ show: (building: object, floor: number, room: object|null) => void, reset: () => void }}
 */
export function initFloorPlan(rooms, openViewer) {
  const words = CONFIG.sheet;
  const slides = document.querySelector('#bs-slides');
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

  /** @param {'plan'|'posted'} name - highlight this tab in the switch */
  function markTab(name) {
    order.forEach((view) => {
      views[view].tab.classList.toggle('button-active', view === name);
      views[view].tab.setAttribute('aria-selected', String(view === name));
    });
  }

  /**
   * Slide to a view.
   * @param {'plan'|'posted'} name
   * @param {boolean} animate - false jumps straight there
   */
  function goTo(name, animate) {
    slides.scrollTo({ left: views[name].slide.offsetLeft, behavior: animate ? 'smooth' : 'instant' });
    markTab(name);
  }

  order.forEach((name) => views[name].tab.addEventListener('click', () => goTo(name, true)));

  // While swiping, the switch flips as soon as you're past halfway.
  slides.addEventListener('scroll', () => {
    const halfway = views.posted.slide.offsetLeft / 2;
    markTab(slides.scrollLeft > halfway ? 'posted' : 'plan');
  }, { passive: true });

  /* ---------- Pictures ---------- */

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
      return;
    }
    view.image.onerror = () => fillSlide(view, undefined, alt); // listed, but the file is missing
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
    const floorName = CONFIG.pill.floorText + ' ' + floor;
    const roomName = room ? CONFIG.search.roomText + ' ' + room.number : '';
    if (room && room.building === building.id && !room.floor) {
      return roomName + ' (' + words.roomFloorUnknownText + ') · ' + floorName;
    }
    if (room && room.building === building.id && room.floor === floor) {
      const from = room.indoorFrom === 'door' ? words.indoorFromDoorText : words.indoorFromStairsText;
      return roomName + ' · ' + floorName + (room.indoorRoute ? ' · ' + from : '');
    }
    return hasRooms ? floorName + ' · ' + words.tapRoomText : floorName;
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
    const floorName = building.name + ', ' + CONFIG.pill.floorText + ' ' + floor;

    views.plan.slide.toggleAttribute('data-rooms', roomsHere.length > 0);
    caption.textContent = captionFor(building, floor, room, roomsHere.length > 0);
    fillSlide(views.posted, building.postedImages[String(floor)], floorName + ' ' + words.postedAltText);

    let picture = planFile;
    if (planFile && room && room.plan === planFile) {
      try {
        picture = await planWithRoom(planFile, room);
      } catch (error) {
        console.error(error); // show the plain plan instead
      }
      if (thisRequest !== request) return; // something newer is already showing
    }
    fillSlide(views.plan, picture, floorName + ' ' + words.planAltText);
  }

  /* ---------- Taps on the pictures ---------- */

  // Tap a room on our plan to choose it.
  views.plan.image.addEventListener('click', (event) => {
    const { building, floor } = showing;
    if (!building) return;
    const planFile = building.floorImages[String(floor)];
    const roomsHere = rooms.filter((r) => r.plan && r.plan === planFile);
    if (!roomsHere.length) return;

    // Where the tap landed, in the plan's own units (its viewBox: "left top width height").
    const [left, top, width, height] = roomsHere[0].viewBox.split(/\s+/).map(Number);
    const box = views.plan.image.getBoundingClientRect();
    const x = left + ((event.clientX - box.left) / box.width) * width;
    const y = top + ((event.clientY - box.top) / box.height) * height;

    // Smallest room under the tap (a small room can sit inside a bigger suite).
    const hits = roomsHere.filter((r) => inside(r.points, x, y));
    if (!hits.length) return;
    const area = (r) => Math.abs(r.points.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = r.points[(i + 1) % r.points.length];
      return sum + x1 * y2 - x2 * y1;
    }, 0));
    store.pickRoom(hits.reduce((a, b) => (area(a) <= area(b) ? a : b)));
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
