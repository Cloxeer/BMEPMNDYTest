/**
 * @file js/pill.js
 * @summary The always-visible bottom pill: an orb + text that morphs into a
 *          floor selector.
 *
 * WHAT IT DOES : Shows one small pill at the bottom center. When nothing is
 *                selected it says "Tap a building". When a building is selected
 *                the orb goes to "solving"; when its sheet is open and it has
 *                more than one floor, the pill morphs into floor buttons.
 *                During search the orb goes to "searching". The orb icon is
 *                always the constant; only the text/buttons change.
 * DEPENDS ON   : ./orb.js, ./store.js, styles/app.css (.pill rules),
 *                the #pill markup in index.html.
 * CONTROLS     : the #pill element.
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
  const orbSlot = document.querySelector('#pill-orb');
  const labelEl = document.querySelector('#pill-label');
  const floorsEl = document.querySelector('#pill-floors');

  const orb = createOrb(20);
  orbSlot.appendChild(orb.el);

  /**
   * Draw floor buttons for a multi-floor building.
   * @param {object} b - the selected building
   * @param {number} active - the active floor
   */
  function renderFloors(b, active) {
    floorsEl.innerHTML = '';
    b.floors.forEach((f) => {
      const btn = document.createElement('button');
      btn.className = 'pill-floor' + (f === active ? ' is-active' : '');
      btn.textContent = 'Floor ' + f;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.set({ activeFloor: f });
      });
      floorsEl.appendChild(btn);
    });
  }

  // Tapping the pill (not a floor button) opens/closes the sheet.
  pill.addEventListener('click', () => {
    const s = store.get();
    if (s.selectedId) store.set({ sheetOpen: !s.sheetOpen, mode: 'solving' });
  });

  store.subscribe((s) => {
    const b = s.selectedId ? byId[s.selectedId] : null;
    const showFloors = b && s.sheetOpen && b.floors && b.floors.length > 1;

    // Show either the floor buttons OR the orb+label, never both.
    pill.classList.toggle('pill--floors', !!showFloors);

    if (showFloors) {
      renderFloors(b, s.activeFloor);
      return;
    }

    if (s.mode === 'searching') {
      orb.setState('searching');
      labelEl.textContent = 'Searching';
    } else {
      // Short + clear, like a button. The building name lives in the sheet header.
      orb.setState(b ? 'solving' : 'idle');
      labelEl.textContent = 'Info';
    }
  });
}
