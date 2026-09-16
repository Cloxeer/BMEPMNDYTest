/**
 * @file js/pill.js
 * @summary The small pills at the bottom of the screen.
 *
 * WHAT IT DOES : [Info ^] opens/closes the building sheet (the ^ flips when it
 *                is open). While the sheet is open, buildings with several floors
 *                also get a [Floor 1] pill. Tapping it splits it into one pill
 *                per floor, stacked like the building (top floor on top); tapping
 *                one picks that floor and the pills join back up.
 * DEPENDS ON   : ./store.js, the #pill markup in index.html, styles/app.css.
 * CONTROLS     : the #pill bar.
 * USED BY      : js/app.js
 */

/**
 * Wire the pills to the store.
 * @param {object} store - shared state
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initPill(store, byId) {
  const bar = document.querySelector('#pill');
  const info = document.querySelector('#pill-info');
  const infoLabel = document.querySelector('#pill-info-label');
  const floorPill = document.querySelector('#pill-floor');
  const choose = document.querySelector('#pill-choose');

  /** Switch between the normal pills and the one-pill-per-floor view. */
  function setChoosing(on) {
    bar.classList.toggle('is-choosing', on);
    floorPill.setAttribute('aria-expanded', String(on));
  }

  /**
   * Make one pill per floor. The current floor is shown filled in.
   * @param {object} b - the selected building
   * @param {number} active - the floor on screen now
   */
  function buildFloorPills(b, active) {
    choose.innerHTML = '';
    b.floors.forEach((f, i) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.className = 'pill' + (f === active ? ' is-active' : '');
      p.style.setProperty('--i', i); // used to stagger the animation
      p.textContent = 'Floor ' + f;
      p.setAttribute('aria-pressed', String(f === active));
      p.addEventListener('click', (e) => {
        e.stopPropagation();
        store.set({ activeFloor: f });
        setChoosing(false);
      });
      choose.appendChild(p);
    });
  }

  info.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = store.get();
    if (s.selectedId) store.set({ sheetOpen: !s.sheetOpen });
  });

  floorPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = store.get();
    buildFloorPills(byId[s.selectedId], s.activeFloor);
    setChoosing(true);
  });

  // Tapping anywhere else puts the pills back together.
  document.addEventListener('click', () => setChoosing(false));

  let lastId = null;
  store.subscribe((s) => {
    const b = s.selectedId ? byId[s.selectedId] : null;
    const manyFloors = !!(b && b.floors && b.floors.length > 1);

    infoLabel.textContent = s.mode === 'searching' ? 'Searching…' : 'Info';
    info.setAttribute('aria-disabled', String(!b));
    info.classList.toggle('has-target', !!b); // shows the ^ only when there is something to open
    info.classList.toggle('is-open', !!(b && s.sheetOpen));
    info.setAttribute('aria-expanded', String(!!(b && s.sheetOpen)));

    // The floor pill only makes sense while you're looking at the floor plan.
    const showFloor = manyFloors && s.sheetOpen;
    floorPill.hidden = !showFloor;
    if (showFloor) floorPill.textContent = 'Floor ' + s.activeFloor;

    if (s.selectedId !== lastId || !showFloor) setChoosing(false); // start fresh
    lastId = s.selectedId;
  });
}
