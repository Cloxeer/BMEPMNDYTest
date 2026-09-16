/**
 * @file js/search.js
 * @summary The drop-down building search.
 *
 * WHAT IT DOES : Tapping the navbar search icon drops a search bar down. As you
 *                type, it filters buildings by name, address, acronym, or id
 *                using Framework7's Autocomplete (a proven dropdown component).
 *                Picking a result flies there, drops the pin, and opens the sheet.
 * DEPENDS ON   : Framework7 (the app object), ./store.js, the #search-drop
 *                markup in index.html.
 * CONTROLS     : the #search-drop element and the pill's "Searching…" label.
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
  const cancelBtn = document.querySelector('#search-cancel');

  /** Open the search drop-down and switch the pill to "Searching…". */
  function open() {
    drop.classList.add('is-open');
    store.set({ mode: 'searching' });
    setTimeout(() => input.focus(), 60);
  }

  /** Close search and put the pill label back. */
  function close() {
    drop.classList.remove('is-open');
    input.value = '';
    store.set({ mode: store.get().selectedId ? 'solving' : 'idle' });
  }

  /**
   * Pick a building from the results: select it, open its sheet, close search.
   * @param {string} id - building id
   */
  function pick(id) {
    const b = byId[id];
    store.set({
      selectedId: id,
      sheetOpen: true,
      mode: 'solving',
      activeFloor: (b.floors && b.floors[0]) || null,
    });
    close();
  }

  // Tapping the search icon opens the drop-down; tapping it again closes it.
  openBtn.addEventListener('click', () => {
    if (drop.classList.contains('is-open')) close();
    else open();
  });
  cancelBtn.addEventListener('click', close);

  // Framework7 Autocomplete draws + positions the results dropdown for us.
  app.autocomplete.create({
    inputEl: '#search-input',
    openIn: 'dropdown',
    dropdownPlaceholderText: 'Type a building name…',
    valueProperty: 'id',
    textProperty: 'text',
    source(query, render) {
      const q = query.trim().toLowerCase();
      if (!q) return render([]);
      const list = buildings
        .filter((b) => matches(b, q))
        .slice(0, 8)
        .map((b) => ({ id: b.id, text: b.name }));
      render(list);
    },
    on: {
      change(value) {
        if (value[0]) pick(value[0].id);
      },
    },
  });
}
