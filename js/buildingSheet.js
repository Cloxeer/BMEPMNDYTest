/**
 * @file js/buildingSheet.js
 * @summary The FULL-PAGE building view that slides up when a building is picked.
 *
 * WHAT IT DOES : Uses a Framework7 sheet (sized to full screen) to show the
 *                selected building's name and the floor-plan photo for the
 *                active floor. Closing it keeps the building selected.
 * DEPENDS ON   : Framework7 (the app object), ./store.js, the #building-sheet
 *                markup in index.html, and the floor images in data/floors/.
 * CONTROLS     : the #building-sheet element's content + open/close.
 * USED BY      : js/app.js
 */

/**
 * Wire the full-page sheet to the store.
 * @param {Framework7} app - the running Framework7 instance
 * @param {object} store - the shared state
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initSheet(app, store, byId) {
  const sheet = app.sheet.create({ el: '#building-sheet', backdrop: false, swipeToClose: true });

  const nameEl = document.querySelector('#bs-name');
  const img = document.querySelector('#bs-floor-img');
  const missing = document.querySelector('#bs-missing');
  const cap = document.querySelector('#bs-caption');

  let syncing = false;

  /**
   * Show the floor-plan photo for one floor (or a placeholder if it's missing).
   * @param {object} b - the selected building
   * @param {number|null} floor - the active floor
   */
  function fill(b, floor) {
    nameEl.textContent = b.name;
    cap.textContent = b.name + ' — Floor ' + floor;

    const src = b.floorImages && b.floorImages[String(floor)];
    if (src) {
      img.src = src;
      img.alt = cap.textContent;
      img.hidden = false;
      missing.hidden = true;
      // If the photo file hasn't been added yet, fall back to the placeholder.
      img.onerror = () => {
        img.hidden = true;
        missing.hidden = false;
      };
    } else {
      img.hidden = true;
      missing.hidden = false;
    }
  }

  store.subscribe((s) => {
    if (s.selectedId) fill(byId[s.selectedId], s.activeFloor);

    syncing = true;
    if (s.sheetOpen) sheet.open();
    else sheet.close();
    syncing = false;
  });

  // If the user swipes/taps the sheet closed, remember it (stay selected).
  sheet.on('closed', () => {
    if (!syncing) store.set({ sheetOpen: false });
  });
}
