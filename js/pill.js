/**
 * @file js/pill.js
 * @summary The bottom pill: an "Info" button plus a floor drop-up.
 *
 * WHAT IT DOES : Keeps one small pill at the bottom of the screen. The left half
 *                is an Info button that opens/closes the building sheet. When a
 *                building with more than one floor is selected, a "Floor 1 ^"
 *                button appears; tapping it opens a small list of floors instead
 *                of showing them all at once. It always starts on Floor 1.
 * DEPENDS ON   : ./orb.js, ./store.js, styles/app.css (.pill rules),
 *                the #pill markup in index.html.
 * CONTROLS     : the #pill element and its floor menu.
 * USED BY      : js/app.js
 */

import { createOrb } from './orb.js';

/**
 * Build the pill and keep it in sync with the store.
 * @param {object} store - the shared state
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initPill(store, byId) {
  const pill = document.querySelector('#pill');
  const infoBtn = document.querySelector('#pill-info');
  const orbSlot = document.querySelector('#pill-orb');
  const labelEl = document.querySelector('#pill-label');
  const divider = document.querySelector('#pill-divider');
  const floorBtn = document.querySelector('#pill-floor');
  const floorLabel = document.querySelector('#pill-floor-label');
  const floorMenu = document.querySelector('#floor-menu');

  const orb = createOrb(20);
  orbSlot.appendChild(orb.el);

  /** Close the floor drop-up. */
  function closeMenu() {
    floorMenu.hidden = true;
    floorBtn.classList.remove('is-open');
  }

  /**
   * Fill the drop-up with one row per floor.
   * @param {object} b - the selected building
   * @param {number} active - the floor currently showing
   */
  function buildMenu(b, active) {
    floorMenu.innerHTML = '';
    b.floors.forEach((f) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'floor-option' + (f === active ? ' is-active' : '');
      row.textContent = 'Floor ' + f;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        store.set({ activeFloor: f });
        closeMenu();
      });
      floorMenu.appendChild(row);
    });
  }

  // Left half: open/close the building sheet.
  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = store.get();
    if (s.selectedId) store.set({ sheetOpen: !s.sheetOpen, mode: 'solving' });
  });

  // Right half: show the list of floors.
  floorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = store.get();
    if (!s.selectedId) return;
    if (floorMenu.hidden) {
      buildMenu(byId[s.selectedId], s.activeFloor);
      floorMenu.hidden = false;
      floorBtn.classList.add('is-open');
    } else {
      closeMenu();
    }
  });

  // Tapping anywhere else closes the drop-up.
  document.addEventListener('click', closeMenu);

  store.subscribe((s) => {
    const b = s.selectedId ? byId[s.selectedId] : null;
    const manyFloors = !!(b && b.floors && b.floors.length > 1);

    // The orb's mood + the short label.
    if (s.mode === 'searching') {
      orb.setState('searching');
      labelEl.textContent = 'Searching';
    } else {
      orb.setState(b ? 'solving' : 'idle');
      labelEl.textContent = 'Info';
    }

    // The floor button only exists when there is more than one floor.
    divider.hidden = !manyFloors;
    floorBtn.hidden = !manyFloors;
    if (manyFloors) floorLabel.textContent = 'Floor ' + s.activeFloor;
    else closeMenu();
  });
}
