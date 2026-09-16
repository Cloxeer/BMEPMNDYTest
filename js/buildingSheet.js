/**
 * @file js/buildingSheet.js
 * @summary The FULL-PAGE building view that slides up when a building is picked.
 *
 * WHAT IT DOES : Top: a switch between "Our plan" (our redrawn SVG) and
 *                "Posted map" (a photo of the evacuation map in the building).
 *                Tap the plan to open it full screen with pinch-zoom.
 *                Below: building photos (with credits), description, facts, links.
 *                Closing it keeps the building selected.
 * DEPENDS ON   : Framework7 (sheet + photoBrowser), ./store.js, the
 *                #building-sheet markup in index.html, data/floors/, data/photos/.
 * CONTROLS     : the #building-sheet contents + open/close.
 * USED BY      : js/app.js
 */

const NO_OFFICIAL_PLAN =
  'NMSU does not publish floor plans online. “Our plan” is redrawn from the evacuation map posted inside the building.';

/**
 * Wire the full-page sheet to the store.
 * @param {Framework7} app - running Framework7 instance
 * @param {object} store - shared state
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initSheet(app, store, byId) {
  // swipeToClose is OFF: scrolling or tapping inside must never close it by
  // accident. The sheet opens from the pill/badge and closes only with X.
  const sheet = app.sheet.create({ el: '#building-sheet', backdrop: false, swipeToClose: false });
  const $ = (sel) => document.querySelector(sel);
  const nameEl = $('#bs-name');
  const img = $('#bs-floor-img');
  const zoomBtn = $('#bs-zoom');
  const missing = $('#bs-missing');
  const missingText = $('#bs-missing-text');
  const cap = $('#bs-caption');
  const info = $('#bs-info');
  const tabPlan = $('#bs-tab-plan');
  const tabPosted = $('#bs-tab-posted');

  let view = 'plan'; // 'plan' = our SVG, 'posted' = photo of the posted map
  let lastKey = '';
  let syncing = false;
  let isOpen = false; // what the sheet is showing right now

  /** Show a message instead of an image. */
  function showMissing(text) {
    img.hidden = true;
    zoomBtn.disabled = true;
    missingText.textContent = text;
    missing.hidden = false;
  }

  /**
   * Put the right image (ours or the posted photo) for this floor on screen.
   * @param {object} b - selected building
   * @param {number} floor - active floor
   */
  function showPlan(b, floor) {
    // Buildings we haven't drawn yet: hide the switch, say so plainly.
    const hasPlans = !!b.floorImages;
    document.querySelector('.bs-switch').hidden = !hasPlans;
    if (!hasPlans) {
      cap.textContent = '';
      return showMissing('Indoor floor plan coming soon.');
    }
    const list = view === 'plan' ? b.floorImages : b.postedImages;
    const src = list && list[String(floor)];
    tabPlan.classList.toggle('button-active', view === 'plan');
    tabPosted.classList.toggle('button-active', view === 'posted');
    tabPlan.setAttribute('aria-selected', String(view === 'plan'));
    tabPosted.setAttribute('aria-selected', String(view === 'posted'));
    cap.textContent = 'Floor ' + floor + (src ? ' · tap to zoom' : '');

    if (!src) return showMissing(view === 'plan' ? 'Floor plan not available yet.' : NO_OFFICIAL_PLAN);
    img.onerror = () => showMissing(view === 'plan' ? 'Floor plan not available yet.' : NO_OFFICIAL_PLAN);
    img.src = src;
    img.alt = b.name + ', floor ' + floor + (view === 'plan' ? ' plan' : ' posted evacuation map');
    img.hidden = false;
    zoomBtn.disabled = false;
    missing.hidden = true;
  }

  /**
   * Build the photos + "About" part under the plan.
   * @param {object} b - selected building
   * @returns {string} HTML
   */
  function infoHtml(b) {
    const photos = (b.photos || []).filter((p) => p.file);
    const gallery = photos.length
      ? '<div class="bs-photos">' +
        photos.map((p, i) => '<button class="bs-photo" type="button" data-i="' + i + '"><img src="' + p.file +
          '" alt="Photo of ' + b.name + '" loading="lazy" /></button>').join('') +
        '</div><p class="bs-credit">' +
        photos.map((p) => 'Photo: ' + (p.author || 'unknown') + ', <a href="' + p.sourceUrl +
          '" target="_blank" rel="noopener">' + p.license + '</a>').join(' · ') + '</p>'
      : '';

    const facts = [
      ['Address', b.address],
      ['Building', b.code && b.code + ' · No. ' + b.propertyNumber],
      ['Built', b.built],
      ['Floors', b.floors && b.floors.length],
    ].filter((r) => r[1]).map((r) => '<div class="bs-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('');

    return (
      gallery +
      '<h3 class="bs-h3">About this building</h3>' +
      ((b.description || []).map((p) => '<p>' + p + '</p>').join('') ||
        '<p class="muted">A full description for this building is coming soon.</p>') +
      '<dl class="bs-facts">' + facts + '</dl>' +
      (b.nmsuUrl ? '<a class="bs-link" href="' + b.nmsuUrl + '" target="_blank" rel="noopener">Open on NMSU’s official map ↗</a>' : '') +
      '<p class="bs-source">Building facts: NMSU Office of Space Planning' +
      (b.floorsSource && b.floorsSource !== 'NMSU Space Planning' ? ' (floor count: ' + b.floorsSource + ')' : '') +
      '. Floor plans are unofficial, redrawn from the evacuation maps posted in the building.</p>'
    );
  }

  /** Open images full screen with pinch-zoom (Framework7 Photo Browser). */
  function openZoom(urls, index) {
    app.photoBrowser.create({ photos: urls, type: 'standalone', theme: 'light', toolbar: urls.length > 1 }).open(index || 0);
  }

  tabPlan.addEventListener('click', () => { view = 'plan'; const s = store.get(); showPlan(byId[s.selectedId], s.activeFloor); });
  tabPosted.addEventListener('click', () => { view = 'posted'; const s = store.get(); showPlan(byId[s.selectedId], s.activeFloor); });
  zoomBtn.addEventListener('click', () => { if (!img.hidden) openZoom([img.src]); });
  info.addEventListener('click', (e) => {
    const btn = e.target.closest('.bs-photo');
    if (!btn) return;
    const b = byId[store.get().selectedId];
    openZoom(b.photos.filter((p) => p.file).map((p) => p.file), Number(btn.dataset.i));
  });

  store.subscribe((s) => {
    if (s.selectedId) {
      const key = s.selectedId + '|' + s.activeFloor;
      if (key !== lastKey) {
        const b = byId[s.selectedId];
        if (!lastKey.startsWith(s.selectedId + '|')) {
          nameEl.textContent = b.name;
          info.innerHTML = infoHtml(b);
        }
        lastKey = key;
        showPlan(b, s.activeFloor);
      }
    }
    // Only open/close when that actually changed (re-opening an open sheet
    // would replay its animation every time you switch floors).
    if (s.sheetOpen !== isOpen) {
      isOpen = s.sheetOpen;
      syncing = true;
      if (isOpen) sheet.open();
      else sheet.close();
      syncing = false;
    }
  });

  // X closes the sheet (Framework7's .sheet-close); keep the store in step.
  sheet.on('closed', () => {
    isOpen = false;
    if (!syncing) store.set({ sheetOpen: false });
  });
}
