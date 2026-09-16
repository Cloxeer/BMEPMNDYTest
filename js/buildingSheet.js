/**
 * @file js/buildingSheet.js
 * @summary The full-page building sheet. Every building uses the same layout.
 *
 * WHAT IT DOES : The layout lives in index.html (#building-sheet): floor plan,
 *                photos, about. This file fills in each field for the selected
 *                building. A field with nothing to show yet gets a short message
 *                from config.yml, so no building's sheet looks different.
 *                A room chosen in search is filled light blue on its floor plan.
 *                "Get directions" (left of the title) starts walking directions.
 *                Tapping the floor plan or a photo opens ONE full-screen viewer
 *                with pinch-zoom; tapping again while it's open does nothing.
 *                Close the sheet with X or by pulling the crimson header down;
 *                the building stays selected.
 * DEPENDS ON   : Framework7 (sheet + photo browser), ./config.js, ./store.js,
 *                ./html.js, #building-sheet in index.html, data/floors/, data/photos/.
 * CONTROLS     : #building-sheet.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml, safeUrl } from './html.js';

/**
 * Wire the building sheet to the store.
 * @param {Framework7} app
 * @param {Object.<string, object>} buildingsById
 */
export function initBuildingSheet(app, buildingsById) {
  const words = CONFIG.sheet;

  // Pulling the header down closes the sheet; scrolling the content never does.
  const sheet = app.sheet.create({
    el: '#building-sheet', backdrop: false, swipeToClose: true, swipeHandler: '#building-sheet .bs-head',
  });

  // Every field in the sheet, by name.
  const field = {
    title: document.querySelector('#bs-name'),
    directionsButton: document.querySelector('#bs-directions'),
    planTab: document.querySelector('#bs-tab-plan'),
    postedTab: document.querySelector('#bs-tab-posted'),
    zoomButton: document.querySelector('#bs-zoom'),
    image: document.querySelector('#bs-floor-img'),
    missing: document.querySelector('#bs-missing'),
    caption: document.querySelector('#bs-caption'),
    photos: document.querySelector('#bs-photos'),
    photosEmpty: document.querySelector('#bs-photos-empty'),
    credit: document.querySelector('#bs-credit'),
    description: document.querySelector('#bs-description'),
    facts: document.querySelector('#bs-facts'),
    link: document.querySelector('#bs-link'),
    source: document.querySelector('#bs-source'),
  };

  let view = 'plan'; // 'plan' = our redrawn SVG, 'posted' = photo of the posted map
  let shownKey = ''; // "buildingId|floor|room" currently on screen
  let sheetIsOpen = false; // what Framework7 is showing right now
  let viewer = null; // the full-screen picture viewer while it's open, otherwise null
  let highlightedPlanUrl = null; // the plan-with-blue-room picture made last, so it can be freed
  let planRequest = 0; // counts plan loads, so a slow old one can't replace a newer one

  /* ---------- Section 1: floor plan ---------- */

  /**
   * Replace the floor picture with a message.
   * @param {string} floorName - e.g. "Floor 2"
   * @param {string} text
   */
  function showFloorMessage(floorName, text) {
    field.image.onerror = null;
    field.image.removeAttribute('src');
    field.image.hidden = true;
    field.zoomButton.disabled = true;
    field.missing.textContent = text;
    field.missing.hidden = false;
    field.caption.textContent = floorName;
  }

  /**
   * Our floor plan with one room filled light blue, as a picture URL an <img> can show.
   * (The room's outline comes from the same plan, via tools/build_rooms.py.)
   * @param {string} planFile - e.g. "data/floors/hjlc-1.svg"
   * @param {object} room - a record from data/rooms.json
   * @returns {Promise<string>}
   */
  async function planWithRoom(planFile, room) {
    const response = await fetch(planFile);
    if (!response.ok) throw new Error('Could not load ' + planFile);
    const plan = await response.text();
    const style = CONFIG.directions;
    const shape = '<polygon points="' + room.points.map((point) => point.join(',')).join(' ') +
      '" fill="' + style.roomColor + '" stroke="' + style.roomEdge + '" stroke-width="' + style.roomEdgeWidth + '"/>';
    // Drawn last, so it sits on top; see-through, so the room number still shows.
    const highlighted = plan.replace('</svg>', shape + '</svg>');
    if (highlightedPlanUrl) URL.revokeObjectURL(highlightedPlanUrl);
    highlightedPlanUrl = URL.createObjectURL(new Blob([highlighted], { type: 'image/svg+xml' }));
    return highlightedPlanUrl;
  }

  /**
   * Show the plan (or posted map) for one floor, or a message if there isn't one yet.
   * @param {object} building
   * @param {number} floor
   * @param {object|null} room - the chosen room, highlighted if it's on this plan
   */
  async function fillFloorPlan(building, floor, room) {
    const request = ++planRequest;
    const images = view === 'plan' ? building.floorImages : building.postedImages;
    const source = images[String(floor)];
    const missingText = view === 'plan' ? words.planMissingText : words.noOfficialPlanText;
    // The caption names the chosen room: on this floor, or (from the class schedule) floor unknown.
    const roomInBuilding = room && room.building === building.id;
    const roomHere = roomInBuilding && room.floor === floor;
    let floorName = CONFIG.pill.floorText + ' ' + floor;
    if (roomHere) floorName = CONFIG.search.roomText + ' ' + room.number + ' · ' + floorName;
    if (roomInBuilding && !room.floor) {
      floorName = CONFIG.search.roomText + ' ' + room.number + ' (' + words.roomFloorUnknownText + ') · ' + floorName;
    }

    field.planTab.classList.toggle('button-active', view === 'plan');
    field.postedTab.classList.toggle('button-active', view === 'posted');
    field.planTab.setAttribute('aria-selected', String(view === 'plan'));
    field.postedTab.setAttribute('aria-selected', String(view === 'posted'));

    if (!source) {
      showFloorMessage(floorName, missingText);
      return;
    }
    let picture = source;
    if (roomHere && view === 'plan' && room.plan === source) {
      try {
        picture = await planWithRoom(source, room);
      } catch (error) {
        console.error(error); // show the plain plan instead
      }
      if (request !== planRequest) return; // something newer is already showing
    }
    field.caption.textContent = floorName + ' · ' + words.tapToZoomText;
    field.image.onerror = () => showFloorMessage(floorName, missingText); // listed, but the file is missing
    field.image.src = picture;
    field.image.alt = building.name + ', ' + floorName + ' ' + (view === 'plan' ? words.planAltText : words.postedAltText);
    field.image.hidden = false;
    field.zoomButton.disabled = false;
    field.missing.hidden = true;
  }

  /* ---------- Section 2: photos ---------- */

  /**
   * Photo strip with credits, or a "no photos yet" message.
   * @param {object} building
   */
  function fillPhotos(building) {
    const photos = building.photos;
    field.photos.hidden = photos.length === 0;
    field.photosEmpty.hidden = photos.length > 0;
    field.photosEmpty.textContent = words.noPhotosText;

    field.photos.innerHTML = photos
      .map((photo, index) => '<button class="bs-photo" type="button" data-index="' + index + '">' +
        '<img src="' + escapeHtml(photo.file) + '" alt="' + escapeHtml(words.photoAltText + ' ' + building.name) +
        '" loading="lazy" /></button>')
      .join('');
    field.credit.innerHTML = photos
      .map((photo) => escapeHtml(words.photoCreditText + ' ' + (photo.author || words.unknownText)) +
        ', <a href="' + safeUrl(photo.sourceUrl) + '" class="external" target="_blank" rel="noopener">' +
        escapeHtml(photo.license) + '</a>')
      .join(' · ');
  }

  /* ---------- Section 3: about ---------- */

  /**
   * Description, facts, official link and where the facts come from.
   * @param {object} building
   */
  function fillAbout(building) {
    const hasDescription = building.description.length > 0;
    const paragraphs = hasDescription ? building.description : [words.noDescriptionText];
    field.description.innerHTML = paragraphs.map((text) => '<p>' + escapeHtml(text) + '</p>').join('');
    field.description.classList.toggle('muted', !hasDescription);

    const facts = [
      [words.addressLabel, building.address],
      [words.buildingLabel, building.code + ' · ' + words.numberText + ' ' + building.propertyNumber],
      [words.builtLabel, building.built],
      [words.floorsLabel, building.floors.length],
    ];
    field.facts.innerHTML = facts
      .map(([name, value]) => '<div class="bs-row"><dt>' + escapeHtml(name) + '</dt><dd>' +
        escapeHtml(value || words.unknownText) + '</dd></div>')
      .join('');

    field.link.href = safeUrl(building.nmsuUrl);

    // Name the floor-count source only when it isn't NMSU's own data.
    const floorsNote = building.floorsSource === 'NMSU Space Planning'
      ? ''
      : ' (' + words.floorCountText + ': ' + building.floorsSource + ')';
    field.source.textContent = words.codeSourceText + ': ' + building.codeSource + '. ' +
      words.factsSourceText + floorsNote + '. ' + words.plansNoteText;
  }

  /* ---------- Full-screen viewer ---------- */

  /**
   * Open pictures full screen with pinch-zoom. Only one viewer at a time.
   * @param {string[]} urls
   * @param {number} startAt - index of the first picture to show
   */
  function openViewer(urls, startAt) {
    if (viewer) return; // already open
    viewer = app.photoBrowser.create({
      photos: urls, type: 'standalone', theme: words.photoViewerTheme, toolbar: urls.length > 1,
    });
    // Throw it away once it has closed, so the next tap starts fresh.
    viewer.on('closed', () => {
      viewer.destroy();
      viewer = null;
    });
    viewer.open(startAt);
  }

  /* ---------- Taps ---------- */

  /**
   * Switch between "Our plan" and "Posted map".
   * @param {'plan'|'posted'} nextView
   */
  function switchView(nextView) {
    view = nextView;
    const state = store.get();
    const building = buildingsById[state.selectedId];
    if (building) fillFloorPlan(building, state.activeFloor, state.selectedRoom);
  }

  field.directionsButton.addEventListener('click', () => store.startDirections());
  field.planTab.addEventListener('click', () => switchView('plan'));
  field.postedTab.addEventListener('click', () => switchView('posted'));
  field.zoomButton.addEventListener('click', () => {
    if (!field.image.hidden) openViewer([field.image.src], 0);
  });
  field.photos.addEventListener('click', (event) => {
    const photoButton = event.target.closest('.bs-photo');
    const building = buildingsById[store.get().selectedId];
    if (!photoButton || !building) return;
    openViewer(building.photos.map((photo) => photo.file), Number(photoButton.dataset.index));
  });

  /* ---------- Follow the store ---------- */

  store.subscribe((state) => {
    const building = buildingsById[state.selectedId];
    if (building) {
      const roomNumber = state.selectedRoom ? state.selectedRoom.number : '';
      const key = state.selectedId + '|' + state.activeFloor + '|' + roomNumber;
      if (key !== shownKey) {
        const differentBuilding = !shownKey.startsWith(state.selectedId + '|');
        if (differentBuilding) {
          view = 'plan'; // every building starts on "Our plan"
          field.title.textContent = building.name;
          fillPhotos(building);
          fillAbout(building);
        }
        shownKey = key;
        fillFloorPlan(building, state.activeFloor, state.selectedRoom);
      }
    }

    // Only open/close when it actually changes (re-opening would replay the animation).
    if (state.sheetOpen !== sheetIsOpen) {
      sheetIsOpen = state.sheetOpen;
      if (sheetIsOpen) sheet.open();
      else sheet.close();
    }
  });

  // Framework7 says "closed" when the closing animation ENDS, which can be after
  // the sheet was already opened again (e.g. a new building picked mid-close).
  sheet.on('closed', () => {
    if (sheet.opened) return; // an old close finishing late: ignore it
    sheetIsOpen = false;
    if (store.get().sheetOpen) store.closeSheet(); // the user closed it (X or pull-down)
  });
}
