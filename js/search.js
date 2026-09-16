/**
 * @file js/search.js
 * @summary The drop-down building search.
 *
 * WHAT IT DOES : Tapping the navbar search icon lets go of any selected building
 *                and drops a search field down. Results appear only once you
 *                type (matching name, address, building code or number), in a
 *                stock Framework7 list. Tapping a result flies there and opens
 *                its sheet. Tapping the search icon again closes search.
 * DEPENDS ON   : ./store.js, the #search-drop markup in index.html.
 * CONTROLS     : #search-drop, #search-results, and the pill's "Searching..." label.
 * USED BY      : js/app.js
 */

/**
 * Does this building match the typed text?
 * @param {object} b - a building record
 * @param {string} q - lowercased search text
 * @returns {boolean}
 */
function matches(b, q) {
  const hay = [b.id, b.name, b.address, ...(b.aka || [])].join(' ').toLowerCase();
  return hay.includes(q);
}

/**
 * Wire the search drop-down to the store.
 * @param {Framework7} app - the running Framework7 instance
 * @param {object} store - the shared state
 * @param {Array} buildings - the list of building records
 * @param {Object.<string, object>} byId - buildings keyed by id
 */
export function initSearch(app, store, buildings, byId) {
  const drop = document.querySelector('#search-drop');
  const input = document.querySelector('#search-input');
  const openBtn = document.querySelector('#search-btn');
  const results = document.querySelector('#search-results');
  const list = results.querySelector('ul');

  const isOpen = () => drop.classList.contains('is-open');

  /** Open search. Any selected building is let go so the map is a clean slate. */
  function open() {
    drop.classList.add('is-open');
    drop.setAttribute('aria-hidden', 'false');
    store.set({ selectedId: null, sheetOpen: false, activeFloor: null, mode: 'searching' });
    input.value = '';
    render('');
    setTimeout(() => input.focus(), 60);
  }

  /** Close search and reset it. */
  function close() {
    drop.classList.remove('is-open');
    drop.setAttribute('aria-hidden', 'true');
    input.value = '';
    render('');
    input.blur();
    if (store.get().mode === 'searching') store.set({ mode: store.get().selectedId ? 'solving' : 'idle' });
  }

  /**
   * Pick a building: close search, select it, open its sheet.
   * @param {string} id - building id
   */
  function pick(id) {
    close();
    const b = byId[id];
    store.set({ selectedId: id, sheetOpen: true, mode: 'solving', activeFloor: (b.floors && b.floors[0]) || null });
  }

  /**
   * Show results for the typed text. Nothing typed = no results panel at all.
   * @param {string} text - what's in the box
   */
  function render(text) {
    const q = text.trim().toLowerCase();
    list.innerHTML = '';
    if (!q) {
      results.hidden = true;
      return;
    }
    const found = buildings.filter((b) => matches(b, q)).slice(0, 8);
    if (!found.length) {
      const li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = 'No buildings match "' + text.trim() + '"';
      list.appendChild(li);
    }
    found.forEach((b) => {
      const li = document.createElement('li');
      li.innerHTML =
        // Framework7 "media list" row: bold title, one-line grey subtitle, one chevron.
        '<a href="#" class="item-link item-content"><div class="item-inner">' +
        '<div class="item-title-row"><div class="item-title">' + b.name + '</div></div>' +
        '<div class="item-subtitle">' + [b.code, b.address].filter(Boolean).join(' · ') + '</div>' +
        '</div></a>';
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        pick(b.id);
      });
      list.appendChild(li);
    });
    results.hidden = false;
  }

  // Search icon: open, or close if already open.
  openBtn.addEventListener('click', () => (isOpen() ? close() : open()));
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') {
      const first = list.querySelector('a');
      if (first) first.click();
    }
  });

  // If a building gets selected some other way (e.g. tapping the map), close search.
  store.subscribe((s) => {
    if (isOpen() && s.selectedId) close();
  });
}
