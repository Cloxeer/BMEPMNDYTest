/**
 * @file js/pill.js
 * @summary The one pill at the bottom of the screen. It never moves.
 *
 * WHAT IT DOES : Sheet closed  → the pill says "Info ^". Tap it to open the
 *                               building sheet.
 *                Sheet open    → the SAME pill says "Floor 1 ^" and stays that
 *                               way until the user closes the sheet with X.
 *                               Tap it and the other floors appear stacked
 *                               above it (Floor 2 on top). Pick one: it
 *                               becomes the pill and the stack hides again.
 * DEPENDS ON   : ./store.js, the #pill markup in index.html, styles/app.css.
 * CONTROLS     : #pill-main and the #pill-choose floor stack.
 * USED BY      : js/app.js
 */

/**
 * Wire the pill to the store.
 * @param {object} store - shared state
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initPill(store, byId) {
  const main = document.querySelector('#pill-main');
  const label = document.querySelector('#pill-label');
  const stack = document.querySelector('#pill-choose');

  /** Show or hide the stack of other floors. */
  function setStackOpen(open) {
    stack.classList.toggle('is-open', open);
    main.classList.toggle('is-stack-open', open);
    main.setAttribute('aria-expanded', String(open));
  }

  /**
   * Fill the stack with every floor EXCEPT the one showing now.
   * Lower floors sit closest to the pill, higher floors further up.
   * @param {object} b - selected building
   * @param {number} current - floor on screen now
   */
  function buildStack(b, current) {
    stack.innerHTML = '';
    b.floors.filter((f) => f !== current).forEach((f, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill pill--floor';
      btn.style.setProperty('--i', i); // staggers the reveal
      btn.textContent = 'Floor ' + f;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setStackOpen(false);
        store.set({ activeFloor: f });
      });
      stack.appendChild(btn);
    });
  }

  main.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = store.get();
    const b = s.selectedId ? byId[s.selectedId] : null;
    if (!b) return; // nothing selected yet: nothing to open

    if (!s.sheetOpen) {
      store.set({ sheetOpen: true }); // "Info" opens the sheet
    } else if (b.floorImages && b.floors.length > 1) {
      const open = !stack.classList.contains('is-open'); // "Floor N" shows the other floors
      if (open) buildStack(b, s.activeFloor);
      setStackOpen(open);
    }
  });

  // Tapping anywhere else hides the floor stack.
  document.addEventListener('click', () => setStackOpen(false));

  store.subscribe((s) => {
    const b = s.selectedId ? byId[s.selectedId] : null;
    const floorMode = !!(b && s.sheetOpen);
    // Only buildings with drawn floor plans get a floor button.
    const hasPlans = !!(b && b.floorImages);
    const manyFloors = hasPlans && b.floors.length > 1;

    if (s.mode === 'searching') label.textContent = 'Searching…';
    else label.textContent = floorMode && hasPlans ? 'Floor ' + (s.activeFloor || 1) : 'Info';

    // The ^ only appears when tapping will actually reveal something.
    main.classList.toggle('has-chev', floorMode ? manyFloors : !!b);
    main.setAttribute('aria-disabled', String(!b));
    main.setAttribute('aria-label', floorMode ? 'Floor ' + s.activeFloor + ', choose another floor' : 'Building info');

    if (!floorMode) setStackOpen(false);
  });
}
