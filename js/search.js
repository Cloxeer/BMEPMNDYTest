/**
 * @file js/search.js
 * @summary The building search that drops down under the navbar.
 *
 * WHAT IT DOES : Tapping the search icon lets go of any selected building and
 *                opens a search field. Results appear only once you type
 *                (matching name, address, building code or number), with the
 *                typed letters highlighted. Tapping a result selects that
 *                building. Tapping the search icon again closes search.
 * DEPENDS ON   : ./config.js, ./store.js, ./html.js, #search-drop in index.html
 *                (a Framework7 "media list" for the results).
 * CONTROLS     : #search-drop and #search-results.
 * USED BY      : js/app.js
 */

import { CONFIG } from './config.js';
import { store } from './store.js';
import { escapeHtml } from './html.js';

/**
 * Wrap every place the typed letters appear in <mark>, e.g. "hall" in "Science Hall".
 * @param {string} text - text to show
 * @param {string} query - lowercased search text
 * @returns {string} safe HTML
 */
function highlight(text, query) {
  const lower = text.toLowerCase();
  let html = '';
  let from = 0;
  let at = lower.indexOf(query);
  while (at !== -1) {
    html += escapeHtml(text.slice(from, at)) + '<mark class="search-hit">' + escapeHtml(text.slice(at, at + query.length)) + '</mark>';
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  return html + escapeHtml(text.slice(from));
}

/**
 * Does this building match the typed text?
 * @param {object} building
 * @param {string} query - lowercased search text
 * @returns {boolean}
 */
function matches(building, query) {
  const searchable = [building.id, building.name, building.address, ...building.aka].join(' ').toLowerCase();
  return searchable.includes(query);
}

/**
 * Wire the search drop-down.
 * @param {object[]} buildings - every building, in map order
 */
export function initSearch(buildings) {
  const drop = document.querySelector('#search-drop');
  const input = document.querySelector('#search-input');
  const searchButton = document.querySelector('#search-btn');
  const results = document.querySelector('#search-results');
  const list = results.querySelector('ul');

  let showing = false; // is the drop-down on screen? Always follows state.searching.

  /**
   * One result row: bold name, grey "code · address", one chevron.
   * @param {object} building
   * @param {string} query
   * @returns {HTMLLIElement}
   */
  function resultRow(building, query) {
    const row = document.createElement('li');
    const subtitle = [building.code, building.address].filter(Boolean).join(' · ');
    row.innerHTML =
      '<a href="#" class="item-link item-content"><div class="item-inner">' +
      '<div class="item-title-row"><div class="item-title">' + highlight(building.name, query) + '</div></div>' +
      '<div class="item-subtitle">' + highlight(subtitle, query) + '</div>' +
      '</div></a>';
    row.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      store.selectBuilding(building, 'search'); // this also ends search
    });
    return row;
  }

  /**
   * Show results for the typed text. Nothing typed = no results panel.
   * @param {string} typed
   */
  function showResults(typed) {
    const query = typed.trim().toLowerCase();
    list.innerHTML = '';
    results.hidden = !query;
    if (!query) return;

    const found = buildings.filter((building) => matches(building, query)).slice(0, CONFIG.search.maxResults);
    if (!found.length) {
      const empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = CONFIG.search.noMatchText + ' "' + typed.trim() + '"';
      list.appendChild(empty);
    }
    found.forEach((building) => list.appendChild(resultRow(building, query)));
  }

  /** Empty the field and the results. */
  function clear() {
    input.value = '';
    showResults('');
  }

  searchButton.addEventListener('click', () => {
    if (store.get().searching) store.endSearch();
    else store.startSearch();
  });
  input.addEventListener('input', () => showResults(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') store.endSearch();
    if (event.key === 'Enter') {
      const firstResult = list.querySelector('a');
      if (firstResult) firstResult.click();
    }
  });

  // The store decides whether search is open; this only shows or hides it.
  // Anything that ends search (a result, the map, the icon, Escape) closes the drop-down.
  store.subscribe((state) => {
    if (state.searching === showing) return;
    showing = state.searching;
    drop.classList.toggle('is-open', showing);
    drop.setAttribute('aria-hidden', String(!showing));
    searchButton.setAttribute('aria-expanded', String(showing));
    clear();
    if (showing) setTimeout(() => input.focus(), CONFIG.search.focusDelay);
    else input.blur();
  });
}
