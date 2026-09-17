/**
 * @file js/buildingSheet.js
 * @summary The full-page building sheet. Every building uses the same layout.
 *
 * WHAT IT DOES : The layout lives in index.html (#building-sheet): floor plan,
 *                photos, about. This file fills in each field for the selected
 *                building; a field with nothing to show yet gets a short message
 *                from config.yml, so no building's sheet looks different.
 *                  - Floor plan slides, room taps and indoor arrows: js/floorPlan.js
 *                  - Directions: the round button at the bottom (js/askDirections.js);
 *                    tapping a room on the plan asks about directions to it too.
 *                  - After directions bring you inside, a green "You've arrived"
 *                    banner shows at the top.
 *                Photos and plans open in ONE full-screen viewer with pinch-zoom.
 *                Close the sheet with X or by pulling the crimson header down;
 *                the building stays selected.
 * DEPENDS ON   : Framework7 (sheet + photo browser), ./config.js, ./store.js,
 *                ./html.js, ./floorPlan.js, #building-sheet in index.html.
 * CONTROLS     : #building-sheet.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml, safeUrl } from './html.js';
import { initFloorPlan } from './floorPlan.js';

/**
 * Wire the building sheet to the store.
 * @param {Framework7} app
 * @param {Object.<string, object>} buildingsById
 * @param {object[]} rooms - data/rooms.json
 * @param {() => void} askDirections - from js/askDirections.js, asked after a room is tapped
 */
export function initBuildingSheet(app, buildingsById, rooms, askDirections) {
  const words = CONFIG.sheet;

  // Pulling the header down closes the sheet; scrolling the content never does.
  const sheet = app.sheet.create({
    el: '#building-sheet', backdrop: false, swipeToClose: true, swipeHandler: '#building-sheet .bs-head',
  });

  // Every field in the sheet, by name.
  const field = {
    title: document.querySelector('#bs-name'),
    arrived: document.querySelector('#bs-arrived'),
    arrivedTitle: document.querySelector('#bs-arrived-title'),
    arrivedText: document.querySelector('#bs-arrived-text'),
    photos: document.querySelector('#bs-photos'),
    photosEmpty: document.querySelector('#bs-photos-empty'),
    credit: document.querySelector('#bs-credit'),
    description: document.querySelector('#bs-description'),
    facts: document.querySelector('#bs-facts'),
    link: document.querySelector('#bs-link'),
    source: document.querySelector('#bs-source'),
  };

  let shownKey = ''; // "buildingId|floor|room" currently on screen
  let sheetIsOpen = false; // what Framework7 is showing right now
  let viewer = null; // the full-screen picture viewer while it's open, otherwise null

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

  /* ---------- Section 1: floor plan (js/floorPlan.js) ---------- */

  const floorPlan = initFloorPlan(rooms, openViewer, askDirections);

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

  /* ---------- "You've arrived" banner ---------- */

  /**
   * Show the banner after directions brought you inside; hide it otherwise.
   * @param {object} state
   */
  function fillArrived(state) {
    field.arrived.hidden = !state.arrived;
    if (!state.arrived) return;
    const room = state.selectedRoom;
    const building = buildingsById[state.selectedId];
    const hasPlans = Object.keys(building.floorImages).length > 0;

    // Only point to things that are really on the sheet.
    let text = ''; // no plan and no room: the title says it all
    if (room && room.indoorRoute) text = words.arrivedRoomText + ' ' + room.number + '.';
    else if (room) text = CONFIG.search.roomText + ' ' + room.number + ': ' + words.arrivedNoRoomPlanText;
    else if (hasPlans) text = words.arrivedBuildingText;

    field.arrivedTitle.textContent = words.arrivedTitleText + ' ' + building.name;
    field.arrivedText.textContent = text;
  }

  /* ---------- Taps ---------- */

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
          floorPlan.reset();
          field.title.textContent = building.name;
          fillPhotos(building);
          fillAbout(building);
        }
        shownKey = key;
        floorPlan.show(building, state.activeFloor, state.selectedRoom);
      }
    }
    fillArrived(state);

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
