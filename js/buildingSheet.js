/**
 * @file js/buildingSheet.js
 * @summary The full-page building sheet.
 *
 * WHAT IT DOES : Top: a switch between "Our plan" (our redrawn SVG) and "Posted
 *                map" (a photo of the evacuation map in the building). Tapping
 *                the plan opens it full screen with pinch-zoom.
 *                Below: photos with credits, description, facts, official link.
 *                Close it with X or by pulling the crimson header down; the
 *                building stays selected.
 * DEPENDS ON   : Framework7 (sheet + photo browser), ./config.js, ./store.js, ./html.js,
 *                #building-sheet in index.html, data/floors/, data/photos/.
 * CONTROLS     : #building-sheet.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml, safeUrl } from './html.js';

/**
 * Photo strip plus credits, or nothing if the building has no photos.
 * @param {object} building
 * @returns {string} HTML
 */
function photosHtml(building) {
  const photos = building.photos;
  if (!photos.length) return '';
  const strip = photos
    .map((photo, index) => '<button class="bs-photo" type="button" data-index="' + index + '">' +
      '<img src="' + escapeHtml(photo.file) + '" alt="Photo of ' + escapeHtml(building.name) + '" loading="lazy" /></button>')
    .join('');
  const credits = photos
    .map((photo) => 'Photo: ' + escapeHtml(photo.author || 'unknown') + ', <a href="' + safeUrl(photo.sourceUrl) +
      '" class="external" target="_blank" rel="noopener">' + escapeHtml(photo.license) + '</a>')
    .join(' · ');
  return '<div class="bs-photos">' + strip + '</div><p class="bs-credit">' + credits + '</p>';
}

/**
 * The "About this building" section.
 * @param {object} building
 * @returns {string} HTML
 */
function aboutHtml(building) {
  const facts = [
    ['Address', building.address],
    ['Building', building.code + ' · No. ' + building.propertyNumber],
    ['Built', building.built],
    ['Floors', building.floors.length],
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => '<div class="bs-row"><dt>' + name + '</dt><dd>' + escapeHtml(value) + '</dd></div>')
    .join('');

  const description = building.description
    ? building.description.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join('')
    : '<p class="muted">' + CONFIG.sheet.noDescriptionText + '</p>';

  // "Other facts" names the floor-count source only when it isn't NMSU's own data.
  const floorsNote = building.floorsSource !== 'NMSU Space Planning' ? ' (floor count: ' + escapeHtml(building.floorsSource) + ')' : '';

  // "external" tells Framework7 to leave this link alone so the browser opens it.
  return '<h3 class="bs-h3">About this building</h3>' +
    description +
    '<dl class="bs-facts">' + facts + '</dl>' +
    '<a class="bs-link external" href="' + safeUrl(building.nmsuUrl) + '" target="_blank" rel="noopener">Open on NMSU’s official map ↗</a>' +
    '<p class="bs-source">Building code: ' + escapeHtml(building.codeSource) + '. Other facts: NMSU Office of Space Planning' +
    floorsNote + '. Floor plans are unofficial, redrawn from the evacuation maps posted in the building.</p>';
}

/**
 * Wire the building sheet to the store.
 * @param {Framework7} app
 * @param {Object.<string, object>} buildingsById
 */
export function initBuildingSheet(app, buildingsById) {
  // Pulling the header down closes the sheet; scrolling the content never does.
  const sheet = app.sheet.create({
    el: '#building-sheet', backdrop: false, swipeToClose: true, swipeHandler: '#building-sheet .bs-head',
  });
  const find = (selector) => document.querySelector(selector);
  const title = find('#bs-name');
  const switcher = find('.bs-switch');
  const planTab = find('#bs-tab-plan');
  const postedTab = find('#bs-tab-posted');
  const zoomButton = find('#bs-zoom');
  const image = find('#bs-floor-img');
  const message = find('#bs-missing');
  const messageText = find('#bs-missing-text');
  const caption = find('#bs-caption');
  const infoSection = find('#bs-info');

  let view = 'plan'; // 'plan' = our SVG, 'posted' = photo of the posted map
  let shownKey = ''; // "buildingId|floor" currently on screen
  let sheetIsOpen = false; // what Framework7 is showing right now

  /** @param {string} text - show this instead of an image */
  function showMessage(text) {
    image.onerror = null;
    image.hidden = true;
    zoomButton.disabled = true;
    messageText.textContent = text;
    message.hidden = false;
  }

  /**
   * Show the right image for this floor: our plan or the posted photo.
   * @param {object} building
   * @param {number} floor
   */
  function showFloorImage(building, floor) {
    switcher.hidden = !building.floorImages;
    if (!building.floorImages) {
      caption.textContent = '';
      showMessage(CONFIG.sheet.noFloorPlanText);
      return;
    }

    const images = view === 'plan' ? building.floorImages : building.postedImages;
    const source = images && images[String(floor)];
    const missingText = view === 'plan' ? CONFIG.sheet.planMissingText : CONFIG.sheet.noOfficialPlanText;
    planTab.classList.toggle('button-active', view === 'plan');
    postedTab.classList.toggle('button-active', view === 'posted');
    planTab.setAttribute('aria-selected', String(view === 'plan'));
    postedTab.setAttribute('aria-selected', String(view === 'posted'));
    caption.textContent = CONFIG.pill.floorText + ' ' + floor + (source ? ' · tap to zoom' : '');

    if (!source) {
      showMessage(missingText);
      return;
    }
    image.onerror = () => showMessage(missingText);
    image.src = source;
    image.alt = building.name + ', floor ' + floor + (view === 'plan' ? ' plan' : ' posted evacuation map');
    image.hidden = false;
    zoomButton.disabled = false;
    message.hidden = true;
  }

  /**
   * Open pictures full screen with pinch-zoom.
   * @param {string[]} urls
   * @param {number} startAt - index of the first picture to show
   */
  function openViewer(urls, startAt) {
    app.photoBrowser.create({
      photos: urls, type: 'standalone', theme: CONFIG.sheet.photoViewerTheme, toolbar: urls.length > 1,
    }).open(startAt);
  }

  /** @param {'plan'|'posted'} nextView */
  function switchView(nextView) {
    view = nextView;
    const state = store.get();
    const building = buildingsById[state.selectedId];
    if (building) showFloorImage(building, state.activeFloor);
  }

  planTab.addEventListener('click', () => switchView('plan'));
  postedTab.addEventListener('click', () => switchView('posted'));
  zoomButton.addEventListener('click', () => {
    if (!image.hidden) openViewer([image.src], 0);
  });
  infoSection.addEventListener('click', (event) => {
    const photoButton = event.target.closest('.bs-photo');
    if (!photoButton) return;
    const building = buildingsById[store.get().selectedId];
    if (!building) return;
    openViewer(building.photos.map((photo) => photo.file), Number(photoButton.dataset.index));
  });

  store.subscribe((state) => {
    const building = buildingsById[state.selectedId];
    if (building) {
      const key = state.selectedId + '|' + state.activeFloor;
      if (key !== shownKey) {
        const differentBuilding = !shownKey.startsWith(state.selectedId + '|');
        if (differentBuilding) {
          title.textContent = building.name;
          infoSection.innerHTML = photosHtml(building) + aboutHtml(building);
        }
        shownKey = key;
        showFloorImage(building, state.activeFloor);
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
