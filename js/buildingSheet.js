/**
 * @file js/buildingSheet.js
 * @summary The FULL-PAGE building view that slides up when a building is picked.
 *
 * WHAT IT DOES : Shows the floor plan for the active floor at the top, then the
 *                building's description, address and official links underneath.
 *                Closing it keeps the building selected.
 * DEPENDS ON   : Framework7 (the app object), ./store.js, the #building-sheet
 *                markup in index.html, and the plans in data/floors/.
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
  const info = document.querySelector('#bs-info');

  let syncing = false;
  let lastKey = ''; // so we only rebuild when something actually changed

  /**
   * Build the "about this building" block shown under the floor plan.
   * @param {object} b - the selected building
   * @returns {string} HTML
   */
  function infoHtml(b) {
    const paras = (b.description || []).map((p) => '<p>' + p + '</p>').join('');
    const rows = [];
    if (b.address) rows.push('<div class="bs-row"><dt>Address</dt><dd>' + b.address + '</dd></div>');
    if (b.propertyNumber) rows.push('<div class="bs-row"><dt>Property</dt><dd>' + b.propertyNumber + '</dd></div>');
    if (b.floors) rows.push('<div class="bs-row"><dt>Floors</dt><dd>' + b.floors.join(', ') + '</dd></div>');

    const link = b.nmsuUrl
      ? '<a class="bs-link" href="' + b.nmsuUrl + '" target="_blank" rel="noopener">' +
        'Official NMSU page &amp; floor plans ↗</a>'
      : '';

    return (
      '<h3 class="bs-h3">About this building</h3>' +
      paras +
      '<dl class="bs-facts">' + rows.join('') + '</dl>' +
      link +
      '<p class="bs-source">Floor plans redrawn from the building’s posted evacuation maps. ' +
      'Building location from OpenStreetMap.</p>'
    );
  }

  /**
   * Show one floor's plan plus the building info.
   * @param {object} b - the selected building
   * @param {number|null} floor - the active floor
   */
  function fill(b, floor) {
    nameEl.textContent = b.name;
    cap.textContent = 'Floor ' + floor;

    const src = b.floorImages && b.floorImages[String(floor)];
    if (src) {
      img.src = src;
      img.alt = b.name + ' floor ' + floor + ' plan';
      img.hidden = false;
      missing.hidden = true;
      img.onerror = () => {
        img.hidden = true;
        missing.hidden = false;
      };
    } else {
      img.hidden = true;
      missing.hidden = false;
    }

    info.innerHTML = infoHtml(b);
  }

  store.subscribe((s) => {
    if (s.selectedId) {
      const key = s.selectedId + '|' + s.activeFloor;
      if (key !== lastKey) {
        lastKey = key;
        fill(byId[s.selectedId], s.activeFloor);
      }
    }

    syncing = true;
    if (s.sheetOpen) sheet.open();
    else sheet.close();
    syncing = false;
  });

  // If the user swipes/taps it closed, remember that (but stay selected).
  sheet.on('closed', () => {
    if (!syncing) store.set({ sheetOpen: false });
  });
}
